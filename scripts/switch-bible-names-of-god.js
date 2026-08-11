// Abi swapped the Bible curriculum: Answers in Genesis -> The Names of God,
// the 36-week track from her Memory & Recitation plan (already seeded in
// memoryItems). Each day's Bible item now carries the WEEK'S Name, so the
// daily study and the weekly memory verse are the same thing.
// Idempotent — rewrites title/instructions on every subjectId=='bible' doc.
// Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/switch-bible-names-of-god.js

import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'wireman-homeschool' });
const db = admin.firestore();

async function main() {
  const mem = await db.collection('memoryItems').where('track', '==', 'bible').get();
  const byWeek = {};
  mem.forEach((d) => {
    const m = d.data();
    if (m.week) byWeek[m.week] = m;
  });
  console.log(`Names of God weeks loaded: ${Object.keys(byWeek).length}`);

  const snap = await db.collection('assignments').where('subjectId', '==', 'bible').get();
  let batch = db.batch();
  let n = 0;
  let updated = 0;
  for (const d of snap.docs) {
    const a = d.data();
    if (!a.dayIndex) continue; // hand-added items keep their titles
    const week = Math.min(36, Math.ceil(a.dayIndex / 4));
    const m = byWeek[week];
    const isReviewWeek = Math.ceil(a.dayIndex / 4) > 36;
    batch.update(d.ref, {
      title: isReviewWeek
        ? 'Names of God — review your favorite Names'
        : `Names of God — ${m.title}`,
      instructions: isReviewWeek
        ? 'Last stretch! Pick your favorite Names of God from the year and talk through them with Mom.'
        : `This week's Name of God${m.reference ? ` (${m.reference})` : ''}. Do your Bible time with Mom on this Name, then check it off. The memory verse lives in your Memory work list too!`,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    updated++;
    if (++n === 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();
  console.log(`Bible items rewired to Names of God: ${updated}`);
  console.log(`Sample week 1: "Names of God — ${byWeek[1].title}"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
