// Puts the Story of the World 2 chapter tests on the kids' lists as tests they
// answer ON SCREEN (answer boxes on the test page, autosaved, turned in to Mom).
//
// What it does:
//   1. Uploads each chapter's files from a local folder to Storage under
//      curriculum/history/shared/sotw2-tests/ — chNN.pdf (the fillable PDF, kept
//      as the paper copy) and chNN-pN.png (the page pictures the app shows).
//   2. Adds one "test" item per chapter per kid, right after that kid's last
//      history item for the chapter (the review/map day). If that day has
//      already passed, the test lands on the kid's next history day instead —
//      a past-dated test would sit in "overdue" and lock today's list.
//
// The folder is curriculum content: it is NOT in this repo (see CONTRIBUTING.md).
// It holds chNN.pdf, chNN-pN.png and layout.json (box positions only).
//
// Safe to re-run: doc ids are {kid}-history-sotw2-test-chNN; a test a kid has
// already started, turned in or had graded/waived is never touched.
//
// DRY RUN by default — prints what it would do and changes nothing.
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
//     node scripts/add-sotw2-fillable-tests.js ~/Downloads/sotw2-fillable-tests
// Add --apply to really do it. Options:
//   --from=14 --to=42          chapters (default 14..42)
//   --kids=luke,layla,logan    which kids (default all four)
//   --skip-upload              files are already in Storage; only (re)write the items

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : true;
};
const dirArg = args.find((a) => !a.startsWith('--'));
if (!dirArg) {
  console.error('Usage: node scripts/add-sotw2-fillable-tests.js <folder with chNN.pdf, chNN-pN.png, layout.json> [--apply]');
  process.exit(1);
}
const DIR = resolve(dirArg.replace(/^~(?=\/|$)/, homedir()));
const APPLY = flag('apply', false) === true;
const SKIP_UPLOAD = flag('skip-upload', false) === true;
const FROM = Number(flag('from', 14));
const TO = Number(flag('to', 42));
const KIDS = String(flag('kids', 'luke,layla,logan,lazarus')).split(',').map((k) => k.trim()).filter(Boolean);
const LITTLE = new Set(['lazarus']);
const KEY_BOOK = 'keys/history/sotw2-tests.pdf';
const UNTOUCHED = new Set(['not_started']);

admin.initializeApp({ projectId: 'wireman-homeschool', storageBucket: 'wireman-homeschool.firebasestorage.app' });
const db = admin.firestore();
const bucket = admin.storage().bucket();

const layout = JSON.parse(readFileSync(join(DIR, 'layout.json'), 'utf8'));
const pad = (n) => String(n).padStart(2, '0');
const localName = (storagePath) => storagePath.split('/').pop();

function todayISO() {
  // the family's calendar day, not UTC
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Detroit' });
}

async function uploadChapter(ch) {
  const files = [ch.pdf, ...ch.pages];
  for (const dest of files) {
    const local = join(DIR, localName(dest));
    if (!existsSync(local)) throw new Error(`Missing file: ${local}`);
    if (!APPLY) continue;
    await bucket.upload(local, {
      destination: dest,
      metadata: {
        contentType: dest.endsWith('.pdf') ? 'application/pdf' : 'image/png',
        cacheControl: 'private, max-age=86400',
      },
    });
  }
  return files.length;
}

async function main() {
  const today = todayISO();
  const chapters = [];
  for (let n = FROM; n <= TO; n++) {
    if (!layout[n]) throw new Error(`layout.json has no chapter ${n}`);
    chapters.push(layout[n]);
  }
  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN (nothing will change — add --apply)'}: chapters ${FROM}-${TO} for ${KIDS.join(', ')}; today is ${today}\n`);

  if (!SKIP_UPLOAD) {
    let count = 0;
    for (const ch of chapters) count += await uploadChapter(ch);
    console.log(`${APPLY ? 'Uploaded' : 'Would upload'} ${count} files to gs://${bucket.name}/curriculum/history/shared/sotw2-tests/\n`);
  }

  let batch = db.batch();
  let pending = 0;
  let written = 0;
  const skipped = [];

  for (const kid of KIDS) {
    // Two equality filters only — needs no composite index.
    const snap = await db.collection('assignments')
      .where('studentId', '==', kid)
      .where('subjectId', '==', 'history')
      .get();
    const history = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => !/-sotw2-test-ch\d+$/.test(a.id) && a.scheduledDate)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || (a.sequence ?? 0) - (b.sequence ?? 0));
    const nextHistoryDay = history.find((a) => a.scheduledDate >= today);

    for (const ch of chapters) {
      const n = ch.chapter;
      const id = `${kid}-history-sotw2-test-ch${pad(n)}`;
      const forChapter = history.filter(
        (a) => Number(a.title?.match(/Ch(?:apter|\.)\s*(\d+)/)?.[1]) === n
      );
      if (forChapter.length === 0) {
        skipped.push(`${id}: no history item for chapter ${n} on ${kid}'s plan`);
        continue;
      }
      const last = forChapter[forChapter.length - 1];
      const anchor = last.scheduledDate >= today ? last : nextHistoryDay;
      if (!anchor) {
        skipped.push(`${id}: chapter ${n} is in the past and ${kid} has no upcoming history day`);
        continue;
      }

      const ref = db.doc(`assignments/${id}`);
      const existing = await ref.get();
      if (existing.exists && !UNTOUCHED.has(existing.data().status)) {
        skipped.push(`${id}: already ${existing.data().status} — left alone`);
        continue;
      }

      const doc = {
        studentId: kid,
        subjectId: 'history',
        itemType: 'test',
        title: `Story of the World 2 — Chapter ${n} Test`,
        estimatedMinutes: LITTLE.has(kid) ? 30 : 25,
        instructions: LITTLE.has(kid)
          ? 'Chapter test! Mom can read the questions to you. Type in the blue boxes and tap the letter you pick, then turn it in.'
          : 'Chapter test — closed book. Type in the blue boxes, tap the letter of your choice, and write the last answer in complete sentences. Then turn it in.',
        contentPath: ch.pdf, // the fillable PDF: the "Paper copy" link
        keyPath: ch.keyPage ? `${KEY_BOOK}#page=${ch.keyPage}` : KEY_BOOK,
        externalUrl: null,
        fillable: { pages: ch.pages, fields: ch.fields },
        dayIndex: anchor.dayIndex ?? null,
        scheduledDate: anchor.scheduledDate,
        originalDate: anchor.scheduledDate,
        // straight after the day's history item
        sequence: (anchor.sequence ?? 50) + 0.5,
        status: 'not_started',
        waivedReason: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(existing.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
      };
      const moved = anchor === last ? '' : `  (chapter's last history day was ${last.scheduledDate} — moved to the next history day)`;
      console.log(`${id}  →  ${doc.scheduledDate}, after "${anchor.title}"${moved}`);
      if (APPLY) {
        batch.set(ref, doc, { merge: true });
        if (++pending === 100) { await batch.commit(); batch = db.batch(); pending = 0; }
      }
      written++;
    }
  }
  if (APPLY && pending) await batch.commit();

  if (skipped.length) console.log(`\nSkipped:\n  ${skipped.join('\n  ')}`);
  console.log(`\n${APPLY ? 'Wrote' : 'Would write'} ${written} test items.${APPLY ? '' : ' Re-run with --apply to do it.'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
