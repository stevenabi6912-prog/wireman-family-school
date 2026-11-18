// Day packet (one merged PDF of the pages Abi approved on screen) and web
// push notifications to the parents' browsers.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import admin from 'firebase-admin';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as webpush from 'web-push';

const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = 'BHTVPqb-u2_GUetttDuSMs69zf1GOanH7lgtkaeIyJmS1SidcRwohiMYCHTH0QtCuLxldt0M2pKwC8CviPxJEwU';
const SITE = 'https://stevenabi6912-prog.github.io/wireman-family-school/';
const DONE = new Set(['submitted', 'graded', 'waived']);
const db = () => admin.firestore();

// ---- print packet ----
export const buildDayPacket = onCall({ invoker: 'public', memory: '1GiB', timeoutSeconds: 300 }, async (request) => {
  if (request.auth?.token?.role !== 'parent') throw new HttpsError('permission-denied', 'Parent only.');
  const { date, items } = request.data ?? {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !Array.isArray(items) || !items.length || items.length > 60) {
    throw new HttpsError('invalid-argument', 'Nothing to print.');
  }
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.HelveticaBold);
  const sources = {};
  const skipped = [];
  for (const it of items) {
    const path = String(it.path ?? '').replace(/^\/+/, '');
    const from = Math.floor(Number(it.from));
    const count = Math.min(40, Math.floor(Number(it.count)));
    if (!path.startsWith('curriculum/') || !(from >= 1) || !(count >= 1)) { skipped.push(`${it.kid}: ${it.title}`); continue; }
    try {
      if (!sources[path]) {
        const [buf] = await admin.storage().bucket().file(path).download();
        sources[path] = await PDFDocument.load(buf, { ignoreEncryption: true });
      }
      const src = sources[path];
      const idx = [];
      for (let p = from; p < from + count && p <= src.getPageCount(); p++) idx.push(p - 1);
      if (!idx.length) { skipped.push(`${it.kid}: ${it.title} (page ${from} is past the end)`); continue; }
      const pages = await out.copyPages(src, idx);
      pages.forEach((page) => {
        out.addPage(page);
        // whose sheet this is, so the stack can be dealt out off the printer
        page.drawText(String(it.kid ?? '').slice(0, 20), { x: 14, y: page.getHeight() - 16, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
      });
    } catch (err) {
      console.error('packet item failed', path, err);
      skipped.push(`${it.kid}: ${it.title}`);
    }
  }
  if (!out.getPageCount()) throw new HttpsError('not-found', 'None of those pages could be read.');
  const bytes = await out.save();
  const dest = `reports/day-packet-${date}.pdf`;
  await admin.storage().bucket().file(dest).save(bytes, { contentType: 'application/pdf', metadata: { cacheControl: 'no-store' } });
  return { path: dest, pageCount: out.getPageCount(), skipped };
});

// ---- push ----
async function pushParents(title, body, tag) {
  const snap = await db().collection('pushSubs').get();
  if (snap.empty) return;
  webpush.setVapidDetails(SITE, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.value().trim());
  const payload = JSON.stringify({ title, body, tag, url: SITE });
  await Promise.all(snap.docs.map(async (d) => {
    try {
      await webpush.sendNotification(d.data().sub, payload, { TTL: 6 * 3600 });
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await d.ref.delete(); // browser dropped it
      else console.error('push failed', err.statusCode, err.body);
    }
  }));
}

async function kidName(id) {
  const s = await db().doc(`students/${id}`).get();
  return s.data()?.name ?? id;
}

function todayEastern() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
}

// A test turned in, or the last item of a kid's day checked off.
export const pushOnAssignment = onDocumentUpdated(
  { document: 'assignments/{id}', secrets: [VAPID_PRIVATE_KEY] },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (DONE.has(before.status) || !DONE.has(after.status) || after.status === 'waived') return;
    const name = await kidName(after.studentId);
    if (after.itemType === 'test') {
      await pushParents(`${name} turned in a test`, after.title ?? '', `test-${event.params.id}`);
    }
    if (after.scheduledDate !== todayEastern()) return;
    const day = await db().collection('assignments')
      .where('studentId', '==', after.studentId).where('scheduledDate', '==', after.scheduledDate).get();
    const left = day.docs.filter((d) => !DONE.has(d.data().status)).length;
    if (left === 0) {
      await pushParents(`${name} finished the day! 🎉`, `All ${day.size} items done.`, `done-${after.studentId}-${after.scheduledDate}`);
    }
  }
);

// A grade newly flagged for a parent to look at.
export const pushOnGrade = onDocumentWritten(
  { document: 'grades/{id}', secrets: [VAPID_PRIVATE_KEY] },
  async (event) => {
    const after = event.data.after.exists ? event.data.after.data() : null;
    const before = event.data.before.exists ? event.data.before.data() : null;
    if (!after?.needsManualReview || before?.needsManualReview) return;
    const [name, a] = await Promise.all([kidName(after.studentId), db().doc(`assignments/${event.params.id}`).get()]);
    await pushParents('Needs your eyes 👀', `${name}: ${a.data()?.title ?? 'a graded item'}`, `review-${event.params.id}`);
  }
);
