import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentUpdated, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';

admin.initializeApp();

// The Anthropic API key lives only here, as a Firebase secret — never in
// frontend code. Set it with: firebase functions:secrets:set ANTHROPIC_API_KEY
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const GRADING_MODEL = 'claude-sonnet-5';

export const health = onRequest((req, res) => {
  res.json({ ok: true });
});

async function fetchStorageBase64(path) {
  const clean = path.split('#')[0];
  const [buf] = await admin.storage().bucket().file(clean).download();
  return buf.toString('base64');
}

function mediaTypeFor(path) {
  const p = path.split('#')[0].toLowerCase();
  if (p.endsWith('.pdf')) return 'application/pdf';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function gradeWithClaude({ apiKey, assignment, submission, student, keyB64 }) {
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
    max_tokens: 2000,
    messages: [{ role: 'user', content }],
  });

  const text = msg.content.find((b) => b.type === 'text')?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in grading response: ${text.slice(0, 200)}`);
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
    const keyB64 = await fetchStorageBase64(assignment.keyPath);
    const result = await gradeWithClaude({
      apiKey: ANTHROPIC_API_KEY.value(),
      assignment,
      submission,
      student,
      keyB64,
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
