import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';
import { PDFDocument } from 'pdf-lib';
import nodemailer from 'nodemailer';

admin.initializeApp();

// The Claude API caps PDF documents at ~100 pages; curriculum teacher guides
// run to 300+. keyPath/contentPath carry a "#page=N" anchor pointing at the
// relevant answers, so slice a window of pages around the anchor instead of
// sending the whole book.
const KEY_PAGE_WINDOW = 10;

async function sliceKeyPdf(buf, anchorPage) {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  const total = src.getPageCount();
  if (total <= 95 && !anchorPage) return buf; // small enough to send whole

  const start = Math.max(0, (anchorPage ? anchorPage - 1 : 0));
  const end = Math.min(total, start + KEY_PAGE_WINDOW);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, Array.from({ length: end - start }, (_, i) => start + i));
  pages.forEach((p) => out.addPage(p));
  return Buffer.from(await out.save());
}

// The Anthropic API key lives only here, as a Firebase secret — never in
// frontend code. Set it with: firebase functions:secrets:set ANTHROPIC_API_KEY
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
// Gmail app password for outbound mail — set with:
//   firebase functions:secrets:set SMTP_PASSWORD
const SMTP_PASSWORD = defineSecret('SMTP_PASSWORD');
const SMTP_USER = 'stevenabi6912@gmail.com';

const GRADING_MODEL = 'claude-sonnet-5';

export const health = onRequest((req, res) => {
  res.json({ ok: true });
});

async function fetchStorageBase64(path) {
  const clean = path.split('#')[0];
  const [buf] = await admin.storage().bucket().file(clean).download();
  return buf.toString('base64');
}

async function fetchKeyPdfBase64(keyPath) {
  const [clean, anchor] = keyPath.split('#');
  const [buf] = await admin.storage().bucket().file(clean).download();
  const pageMatch = anchor?.match(/page=(\d+)/);
  const anchorPage = pageMatch ? Number(pageMatch[1]) : null;
  const sliced = await sliceKeyPdf(buf, anchorPage);
  return sliced.toString('base64');
}

function mediaTypeFor(path) {
  const p = path.split('#')[0].toLowerCase();
  if (p.endsWith('.pdf')) return 'application/pdf';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function gradeWithClaude({ apiKey, assignment, submission, student, keyB64, parentNotes }) {
  const client = new Anthropic({ apiKey });

  const content = [
    {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: keyB64 },
      title: 'Answer key / teacher guide',
    },
  ];

  // Photos of paper work, if any
  for (const filePath of submission.fileUrls ?? []) {
    const mt = mediaTypeFor(filePath);
    const b64 = await fetchStorageBase64(filePath);
    if (mt === 'application/pdf') {
      content.push({ type: 'document', source: { type: 'base64', media_type: mt, data: b64 } });
    } else {
      content.push({ type: 'image', source: { type: 'base64', media_type: mt, data: b64 } });
    }
  }

  content.push({
    type: 'text',
    text: [
      `You are grading a homeschool assignment for a grade ${student.grade} student.`,
      `Assignment: ${assignment.title}`,
      assignment.instructions ? `Instructions given to the student: ${assignment.instructions}` : '',
      assignment.contentPath ? `The assignment came from: ${assignment.contentPath}` : '',
      '',
      'Typed answers from the student:',
      submission.text || '(none — see attached photos of paper work)',
      '',
      'Use the attached answer key / teacher guide to grade. Be encouraging but accurate,',
      'and calibrate expectations to the student\'s grade level.',
      parentNotes ? `\nThe parent has set these grading preferences — follow them:\n${parentNotes}` : '',
      '',
      'Respond with ONLY a JSON object, no other text, in this exact shape:',
      '{"score": <number correct>, "maxScore": <number of questions graded>,',
      ' "perQuestion": [{"questionNumber": "<n>", "correct": true|false, "note": "<short note if wrong, else empty>"}],',
      ' "misunderstandingSummary": "<1-2 sentences on what the student misunderstood, or empty string if nothing>",',
      ' "confidence": "high"|"low"}',
      'Use "low" confidence when the answer key doesn\'t clearly cover this material,',
      'the student\'s work is illegible/ambiguous, or you had to guess which exercise was assigned.',
    ].filter(Boolean).join('\n'),
  });

  const msg = await client.messages.create({
    model: GRADING_MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content }],
  });

  const text = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `No JSON in grading response (stop_reason=${msg.stop_reason}, blocks=${msg.content.map((b) => b.type).join(',')}): ${text.slice(0, 200)}`
    );
  }
  return JSON.parse(jsonMatch[0]);
}

async function runGrading(submissionId, submission) {
  const db = admin.firestore();

  const assignmentSnap = await db.doc(`assignments/${submission.assignmentId}`).get();
  if (!assignmentSnap.exists) {
    console.error(`Assignment ${submission.assignmentId} not found for submission ${submissionId}`);
    return;
  }
  const assignment = assignmentSnap.data();

  const studentSnap = await db.doc(`students/${submission.studentId}`).get();
  const student = studentSnap.exists ? studentSnap.data() : { grade: 5 };

  const gradeRef = db.doc(`grades/${submission.assignmentId}`);

  // Abi's learned grading preferences for this subject (see gradingTuneUp)
  const notesSnap = await db.doc(`gradingNotes/${assignment.subjectId}`).get();
  const parentNotes = notesSnap.exists ? notesSnap.data().notes : null;

  // No answer key → route to Abi's manual review queue instead of guessing.
  if (!assignment.keyPath) {
    await gradeRef.set({
      assignmentId: submission.assignmentId,
      studentId: submission.studentId,
      subjectId: assignment.subjectId,
      score: null,
      maxScore: null,
      perQuestion: [],
      misunderstandingSummary: '',
      confidence: 'low',
      needsManualReview: true,
      reviewReason: 'No answer key on file for this assignment',
      gradedBy: null,
      overriddenScore: null,
      gradedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await assignmentSnap.ref.update({ status: 'graded' });
    return;
  }

  try {
    const keyB64 = await fetchKeyPdfBase64(assignment.keyPath);
    const result = await gradeWithClaude({
      apiKey: ANTHROPIC_API_KEY.value(),
      assignment,
      submission,
      student,
      keyB64,
      parentNotes,
    });

    await gradeRef.set({
      assignmentId: submission.assignmentId,
      studentId: submission.studentId,
      subjectId: assignment.subjectId,
      score: result.score,
      maxScore: result.maxScore,
      perQuestion: result.perQuestion ?? [],
      misunderstandingSummary: result.misunderstandingSummary ?? '',
      confidence: result.confidence === 'low' ? 'low' : 'high',
      needsManualReview: result.confidence === 'low',
      reviewReason: result.confidence === 'low' ? 'Grader was not confident — please spot-check' : null,
      gradedBy: GRADING_MODEL,
      overriddenScore: null,
      gradedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await assignmentSnap.ref.update({ status: 'graded' });
  } catch (err) {
    console.error(`Grading failed for ${submissionId}:`, err);
    await gradeRef.set({
      assignmentId: submission.assignmentId,
      studentId: submission.studentId,
      subjectId: assignment.subjectId,
      score: null,
      maxScore: null,
      perQuestion: [],
      misunderstandingSummary: '',
      confidence: 'low',
      needsManualReview: true,
      reviewReason: `Auto-grading errored (${String(err).slice(0, 140)}) — grade manually`,
      gradedBy: null,
      overriddenScore: null,
      gradedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

// Draft -> submitted transition on update
export const gradeSubmission = onDocumentUpdated(
  { document: 'submissions/{submissionId}', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: '512MiB' },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (before.isDraft === false || after.isDraft !== false) return;
    await runGrading(event.params.submissionId, after);
  }
);

// Direct submit with no prior draft (created already submitted)
export const gradeSubmissionOnCreate = onDocumentCreated(
  { document: 'submissions/{submissionId}', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: '512MiB' },
  async (event) => {
    const data = event.data.data();
    if (data.isDraft !== false) return;
    await runGrading(event.params.submissionId, data);
  }
);

// ---------------------------------------------------------------------------
// Nightly report: what each kid finished, what's missing, grades posted today.
// Runs school evenings; writes reports/{date} (parent-readable) and queues an
// email doc for the firestore-send-email extension (no-op until installed).
// ---------------------------------------------------------------------------

const REPORT_EMAIL = 'stevenabi6912@gmail.com';
const STUDENT_ORDER = ['luke', 'layla', 'logan', 'lazarus'];
const DONE = new Set(['submitted', 'graded', 'waived']);

function isoToday(tz = 'America/Detroit') {
  return new Date().toLocaleDateString('sv-SE', { timeZone: tz }); // YYYY-MM-DD
}

async function buildNightlyReport() {
  const db = admin.firestore();
  const today = isoToday();

  const [assignSnap, gradeSnap, studentSnap] = await Promise.all([
    db.collection('assignments').where('scheduledDate', '<=', today).get(),
    db.collection('grades').get(),
    db.collection('students').get(),
  ]);
  const students = {};
  studentSnap.docs.forEach((d) => { students[d.id] = d.data(); });

  const perStudent = {};
  for (const id of STUDENT_ORDER) {
    perStudent[id] = { name: students[id]?.name ?? id, completedToday: [], missing: [], gradesToday: [] };
  }
  assignSnap.docs.forEach((d) => {
    const a = d.data();
    const bucket = perStudent[a.studentId];
    if (!bucket) return;
    if (a.scheduledDate === today && DONE.has(a.status)) bucket.completedToday.push(a.title);
    if (!DONE.has(a.status) && a.scheduledDate <= today) bucket.missing.push(`${a.title} (${a.scheduledDate})`);
  });
  gradeSnap.docs.forEach((d) => {
    const g = d.data();
    const when = g.gradedAt?.toDate?.()?.toLocaleDateString?.('sv-SE', { timeZone: 'America/Detroit' });
    if (when !== today) return;
    const bucket = perStudent[g.studentId];
    if (!bucket) return;
    const score = g.overriddenScore ?? g.score;
    bucket.gradesToday.push(
      score == null
        ? `${g.assignmentId}: waiting for your review`
        : `${g.assignmentId}: ${score}/${g.maxScore}${g.needsManualReview ? ' (flagged for review)' : ''}`
    );
  });

  const lines = [`Wireman Family School — evening report for ${today}`, ''];
  for (const id of STUDENT_ORDER) {
    const s = perStudent[id];
    lines.push(`${s.name}:`);
    lines.push(`  Done today: ${s.completedToday.length ? s.completedToday.join('; ') : 'nothing completed'}`);
    if (s.missing.length) lines.push(`  Missing (${s.missing.length}): ${s.missing.slice(0, 5).join('; ')}${s.missing.length > 5 ? '…' : ''}`);
    if (s.gradesToday.length) lines.push(`  Grades posted: ${s.gradesToday.join('; ')}`);
    lines.push('');
  }
  const text = lines.join('\n');

  // Pretty HTML version — one colored card per kid (inline styles for email clients)
  const KID_STYLE = {
    luke: { color: '#0076B6', emoji: '🦁' },
    layla: { color: '#12939b', emoji: '🐬' },
    logan: { color: '#4a6b3a', emoji: '🎣' },
    lazarus: { color: '#1f9e46', emoji: '🎯' },
  };
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const list = (items, icon, color) => items.length
    ? `<ul style="margin:6px 0;padding-left:4px;list-style:none;">${items.map((i) => `<li style="margin:3px 0;color:${color};font-size:14px;">${icon} ${esc(i)}</li>`).join('')}</ul>`
    : '';
  const cards = STUDENT_ORDER.map((id) => {
    const s = perStudent[id];
    const k = KID_STYLE[id];
    const av = students[id]?.theme?.avatar ?? k.emoji;
    const allClear = s.missing.length === 0 && s.completedToday.length > 0;
    return `
    <div style="background:#ffffff;border-radius:14px;border-top:5px solid ${k.color};box-shadow:0 2px 6px rgba(0,0,0,0.08);padding:14px 18px;margin:0 0 14px;">
      <div style="font-size:18px;font-weight:800;color:#222;">${av} ${esc(s.name)}
        ${allClear ? '<span style="background:#def0e3;color:#2c7a48;border-radius:999px;padding:2px 10px;font-size:12px;margin-left:8px;">Day done 🎉</span>' : ''}
        ${s.missing.length ? `<span style="background:#fde3df;color:#b3402f;border-radius:999px;padding:2px 10px;font-size:12px;margin-left:8px;">${s.missing.length} not done</span>` : ''}
      </div>
      ${list(s.completedToday, '✅', '#2c7a48')}
      ${s.completedToday.length === 0 ? '<p style="color:#999;font-size:13px;margin:6px 0;">Nothing finished today.</p>' : ''}
      ${list(s.missing.slice(0, 6).map((m) => m.replace(/ \(\d{4}-\d{2}-\d{2}\)$/, '')), '⏰', '#9c5518')}
      ${s.missing.length > 6 ? `<p style="color:#9c5518;font-size:12px;">…and ${s.missing.length - 6} more</p>` : ''}
      ${list(s.gradesToday, '📊', '#3b6ea8')}
    </div>`;
  }).join('');
  const html = `
  <div style="background:#f4f2ee;padding:22px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <h1 style="font-size:20px;color:#2a2a2a;margin:0 0 4px;">🏫 Wireman Family School</h1>
    <p style="color:#777;margin:0 0 16px;">Evening report — ${new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    ${cards}
    <p style="color:#aaa;font-size:12px;">Open the <a href="https://stevenabi6912-prog.github.io/wireman-family-school/" style="color:#5b4b8a;">dashboard</a> to reschedule, waive, or review grades.</p>
  </div>`;

  await db.doc(`reports/${today}`).set({
    date: today,
    perStudent,
    text,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Our own outbound queue (see sendOutbox below).
  await db.collection('outbox').add({
    to: REPORT_EMAIL,
    subject: `School report ${today} — ${STUDENT_ORDER.map((id) => {
      const s = perStudent[id];
      return `${s.name} ${s.completedToday.length}✓${s.missing.length ? ` ${s.missing.length}!` : ''}`;
    }).join(', ')}`,
    text,
    html,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return today;
}

export const nightlyReport = onSchedule(
  { schedule: '30 17 * * 1-4', timeZone: 'America/Detroit' },
  async () => {
    await buildNightlyReport();
  }
);

// Our own mail sender — no extension needed. Writes delivery state back so
// failures are visible in the outbox collection.
export const sendOutbox = onDocumentCreated(
  { document: 'outbox/{mailId}', secrets: [SMTP_PASSWORD] },
  async (event) => {
    const data = event.data.data();
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD.value() },
    });
    try {
      await transporter.sendMail({
        from: `Wireman Family School <${SMTP_USER}>`,
        to: data.to,
        subject: data.subject,
        text: data.text,
        html: data.html,
        attachments: data.attachmentB64
          ? [{ filename: data.attachmentName ?? 'attachment.pdf', content: Buffer.from(data.attachmentB64, 'base64') }]
          : data.attachmentUrl
            ? [{ filename: data.attachmentName ?? 'attachment.pdf', path: data.attachmentUrl }]
            : undefined,
      });
      await event.data.ref.update({ state: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (err) {
      console.error('sendOutbox failed:', err);
      await event.data.ref.update({ state: 'error', error: String(err).slice(0, 300) });
    }
  }
);

// ---------------------------------------------------------------------------
// Sunday packet: merge the coming week's printable pages (everything with a
// page anchor) into one PDF per family and email it for one print run.
// ---------------------------------------------------------------------------

function nextSchoolWeek(todayIso) {
  // Monday..Sunday window starting the first Monday >= today
  const d = new Date(todayIso + 'T12:00:00');
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const daysToMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + daysToMonday);
  const start = d.toLocaleDateString('sv-SE');
  d.setDate(d.getDate() + 6);
  return [start, d.toLocaleDateString('sv-SE')];
}

const PRINTABLE_TYPES = new Set(['worksheet', 'test']);
const KID_NAMES = { luke: 'Luke', layla: 'Layla', logan: 'Logan', lazarus: 'Lazarus' };

async function buildSundayPacket() {
  const db = admin.firestore();
  const [weekStart, weekEnd] = nextSchoolWeek(isoToday());
  const snap = await db.collection('assignments')
    .where('scheduledDate', '>=', weekStart)
    .where('scheduledDate', '<=', weekEnd)
    .get();

  const byKid = {};
  snap.docs.forEach((d) => {
    const a = d.data();
    if (!PRINTABLE_TYPES.has(a.itemType) || !a.contentPath?.includes('#page=')) return;
    (byKid[a.studentId] = byKid[a.studentId] ?? []).push(a);
  });

  const out = await PDFDocument.create();
  const font = await out.embedFont('Helvetica-Bold');
  const srcCache = new Map();
  let pageCount = 0;
  const skipped = [];

  for (const kid of STUDENT_ORDER) {
    const items = (byKid[kid] ?? []).sort((a, b) => a.dayIndex - b.dayIndex || a.sequence - b.sequence);
    if (!items.length) continue;
    const cover = out.addPage([612, 792]);
    cover.drawText(`${KID_NAMES[kid]} — week of ${weekStart}`, { x: 60, y: 700, size: 24, font });
    cover.drawText(`${items.length} printable items`, { x: 60, y: 665, size: 14, font });
    for (const a of items) {
      try {
        const [path, anchor] = a.contentPath.split('#');
        const page = Number(anchor.match(/page=(\d+)/)?.[1]);
        if (!srcCache.has(path)) {
          const [buf] = await admin.storage().bucket().file(path).download();
          srcCache.set(path, await PDFDocument.load(buf, { ignoreEncryption: true }));
        }
        const src = srcCache.get(path);
        const take = Math.min(2, src.getPageCount() - (page - 1)); // anchor page + 1
        const pages = await out.copyPages(src, Array.from({ length: take }, (_, i) => page - 1 + i));
        pages.forEach((p) => out.addPage(p));
        pageCount += take;
      } catch (err) {
        skipped.push(`${KID_NAMES[kid]}: ${a.title}`);
        console.warn('packet skip', a.title, String(err).slice(0, 120));
      }
    }
  }

  if (pageCount === 0) return { weekStart, pageCount: 0, skipped: 'no school days that week — no email sent' };

  const bytes = Buffer.from(await out.save());
  const dest = `reports/packet-${weekStart}.pdf`;
  await admin.storage().bucket().file(dest).save(bytes, { contentType: 'application/pdf' });

  const mail = {
    to: REPORT_EMAIL,
    subject: `🖨️ Print packet — week of ${weekStart} (${pageCount} pages)`,
    text: `The week's printable worksheets and tests for all four kids are attached.${skipped.length ? `\n\nCouldn't include: ${skipped.join('; ')}` : ''}`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (bytes.length < 18 * 1024 * 1024) {
    mail.attachmentB64 = bytes.toString('base64');
    mail.attachmentName = `wireman-week-${weekStart}.pdf`;
  } else {
    mail.text += '\n\n(The packet was too large to attach — open the dashboard Records page to print it.)';
  }
  await db.collection('outbox').add(mail);
  return { weekStart, pageCount, bytes: bytes.length };
}

export const sundayPacket = onSchedule(
  { schedule: '0 7 * * 0', timeZone: 'America/Detroit', memory: '1GiB', timeoutSeconds: 300 },
  async () => {
    await buildSundayPacket();
  }
);

export const runPacketNow = onCall({ invoker: 'public', memory: '1GiB', timeoutSeconds: 300 }, async (request) => {
  if (request.auth?.token?.role !== 'parent') throw new HttpsError('permission-denied', 'Parent only.');
  return await buildSundayPacket();
});

// ---------------------------------------------------------------------------
// Grading feedback loop: monthly, learn from Abi's overrides so the grader
// drifts toward how she actually grades. Writes gradingNotes/{subjectId}.
// ---------------------------------------------------------------------------

export const gradingTuneUp = onSchedule(
  { schedule: '0 6 1 * *', timeZone: 'America/Detroit', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300 },
  async () => {
    const db = admin.firestore();
    const snap = await db.collection('grades').where('overriddenScore', '>=', 0).get();
    const bySubject = {};
    snap.docs.forEach((d) => {
      const g = d.data();
      if (g.overriddenScore === g.score) return;
      (bySubject[g.subjectId] = bySubject[g.subjectId] ?? []).push(
        `auto ${g.score}/${g.maxScore} -> Abi set ${g.overriddenScore}/${g.maxScore}; grader note: ${g.misunderstandingSummary ?? 'none'}`
      );
    });
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    for (const [subjectId, cases] of Object.entries(bySubject)) {
      if (cases.length < 2) continue;
      const msg = await client.messages.create({
        model: GRADING_MODEL,
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `A parent regrades her kids' homeschool work when the auto-grader misses her standards. Here are recent ${subjectId} corrections:\n${cases.join('\n')}\n\nWrite 2-4 short imperative rules the grader should follow next time to match her grading (e.g. "Accept phonetic spelling", "Give half credit for right method with arithmetic slips"). Reply with ONLY the rules, one per line.`,
        }],
      });
      const notes = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      if (notes) {
        await db.doc(`gradingNotes/${subjectId}`).set({
          notes,
          casesConsidered: cases.length,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }
);

// Manual trigger so Abi (or a test) can generate tonight's report on demand.
// invoker 'public' opens the HTTPS gateway; the parent-role check inside is
// the real gate (same model as every Firebase callable).
export const runReportNow = onCall({ invoker: 'public' }, async (request) => {
  if (request.auth?.token?.role !== 'parent') {
    throw new HttpsError('permission-denied', 'Parent only.');
  }
  const date = await buildNightlyReport();
  return { ok: true, date };
});
