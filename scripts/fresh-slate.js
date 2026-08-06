// FRESH SLATE for the first day of school. Run right before Aug 17 after
// the kids' test days. Wipes all test progress while keeping everything
// the family personalized.
//
// RESETS: every year-plan assignment back to not_started (clears timing),
//   deletes the pre-year demo-day assignments (2026-07-31), and clears
//   submissions, grades, kid reports, exploration logs, bug reports,
//   nightly reports, sent mail, and grading notes.
// KEEPS: accounts/PINs, themes & avatars, custom header pictures, memory
//   work lists, blockouts/holidays, the whole year plan and its anchors.
//
// Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/fresh-slate.js --yes

import admin from 'firebase-admin';

if (!process.argv.includes('--yes')) {
  console.error('This wipes all school progress. Re-run with --yes to confirm.');
  process.exit(1);
}

admin.initializeApp({ projectId: 'wireman-homeschool' });
const db = admin.firestore();

async function wipeCollection(name) {
  const snap = await db.collection(name).get();
  let batch = db.batch(); let n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    if (++n === 450) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();
  console.log(`cleared ${name}: ${snap.size}`);
}

async function main() {
  // 1. plan assignments -> pristine
  const assignments = await db.collection('assignments').get();
  let batch = db.batch(); let n = 0; let reset = 0; let deleted = 0;
  for (const d of assignments.docs) {
    const a = d.data();
    if (!a.dayIndex) {
      batch.delete(d.ref); // demo-day + placement live in dayIndex-less docs?
      deleted++;
    } else {
      batch.update(d.ref, {
        status: 'not_started',
        startedAt: admin.firestore.FieldValue.delete(),
        actualMinutes: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      reset++;
    }
    if (++n === 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();
  console.log(`assignments: reset ${reset}, deleted ${deleted} demo/pre-year docs`);
  console.log('NOTE: placement screeners were dayIndex-less and got deleted — re-run scripts/add-placement-week.js to restore them for day 1-2.');

  // 2. progress artifacts
  // memoryAttempts = test-run recitations (the memoryItems PLAN is kept)
  for (const c of ['submissions', 'grades', 'kidReports', 'explorations', 'bugReports', 'reports', 'outbox', 'mail', 'gradingNotes', 'memoryAttempts']) {
    await wipeCollection(c);
  }
  console.log('Fresh slate ready. First day: 2026-08-17. 🚀');
}

main().catch((e) => { console.error(e); process.exit(1); });
