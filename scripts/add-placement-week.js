// Inserts beginning-of-year placement screeners as the FIRST items of days 1-2:
//   Day 1: Delta math readiness screener (auto-graded — answer keys exist)
//   Day 2: DIBELS reading check (parent-administered; parent versions -> keys/)
// Luke & Layla get the Algebra 1 readiness screener (feeds remediation tailoring).
// Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/add-placement-week.js

import admin from 'firebase-admin';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

admin.initializeApp({ projectId: 'wireman-homeschool', storageBucket: 'wireman-homeschool.firebasestorage.app' });
const db = admin.firestore();
const bucket = admin.storage().bucket();
const ROOT = fileURLToPath(new URL('../Hillsdale/Delta and DIBELS Screeners/', import.meta.url));

const UP = [
  ['Delta Math Screeners - Spring/Delta Algebra 1 Readiness.pdf', 'curriculum/placement/delta-algebra1.pdf'],
  ['Delta Math Screeners - Spring/Delta Algebra 1 Readiness Answer Key.pdf', 'keys/placement/delta-algebra1-key.pdf'],
  ['Delta Math Screeners - Spring/Delta 5th Grade Readiness.pdf', 'curriculum/placement/delta-5th.pdf'],
  ['Delta Math Screeners - Spring/Delta 5th Grade Readiness Answer Key.pdf', 'keys/placement/delta-5th-key.pdf'],
  ['Delta Math Screeners - Spring/Delta 3rd Grade Readiness.pdf', 'curriculum/placement/delta-3rd.pdf'],
  ['Delta Math Screeners - Spring/Delta 3rd Grade Readiness Answer Key.pdf', 'keys/placement/delta-3rd-key.pdf'],
  ['Dibels ELA Screeners - Spring/Dibels 8th grade Spring- student.pdf', 'curriculum/placement/dibels-8th-student.pdf'],
  ['Dibels ELA Screeners - Spring/Dibels 8th grade Spring- parent.pdf', 'keys/placement/dibels-8th-parent.pdf'],
  ['Dibels ELA Screeners - Spring/Dibels 5th grade Spring-student.pdf', 'curriculum/placement/dibels-5th-student.pdf'],
  ['Dibels ELA Screeners - Spring/Dibels 5th garde Spring- parent.pdf', 'keys/placement/dibels-5th-parent.pdf'],
  ['Dibels ELA Screeners - Spring/Dibels 3rd grade Spring- student.pdf', 'curriculum/placement/dibels-3rd-student.pdf'],
  ['Dibels ELA Screeners - Spring/Dibels 3rd grade Spring- parent.pdf', 'keys/placement/dibels-3rd-parent.pdf'],
];

const MATH = {
  luke: ['curriculum/placement/delta-algebra1.pdf', 'keys/placement/delta-algebra1-key.pdf', 'Algebra 1 readiness screener'],
  layla: ['curriculum/placement/delta-algebra1.pdf', 'keys/placement/delta-algebra1-key.pdf', 'Algebra 1 readiness screener'],
  logan: ['curriculum/placement/delta-5th.pdf', 'keys/placement/delta-5th-key.pdf', '5th grade math screener'],
  lazarus: ['curriculum/placement/delta-3rd.pdf', 'keys/placement/delta-3rd-key.pdf', '3rd grade math screener'],
};
const DIBELS = {
  luke: 'curriculum/placement/dibels-8th-student.pdf',
  layla: 'curriculum/placement/dibels-8th-student.pdf',
  logan: 'curriculum/placement/dibels-5th-student.pdf',
  lazarus: 'curriculum/placement/dibels-3rd-student.pdf',
};

async function main() {
  for (const [local, dest] of UP) {
    const p = `${ROOT}${local}`;
    if (!existsSync(p)) { console.warn(`MISSING: ${local}`); continue; }
    const [exists] = await bucket.file(dest).exists();
    if (!exists) { await bucket.upload(p, { destination: dest }); console.log(`up: ${dest}`); }
  }

  // find day-1/day-2 dates from any existing doc
  const d1 = (await db.doc('assignments/logan-d001-2').get()).data();
  const d2 = (await db.doc('assignments/logan-d002-1').get()).data();

  const batch = db.batch();
  for (const kid of ['luke', 'layla', 'logan', 'lazarus']) {
    const [mathPath, keyPath, label] = MATH[kid];
    // sequence 0 sorts before everything -> it's the first thing they do
    batch.set(db.doc(`assignments/${kid}-d001-0`), {
      studentId: kid, dayIndex: 1, sequence: 0,
      scheduledDate: d1.scheduledDate, originalDate: d1.scheduledDate,
      subjectId: 'math', itemType: 'test', estimatedMinutes: 30,
      title: `Start-of-year checkup: ${label}`,
      contentPath: mathPath, keyPath, externalUrl: null,
      status: 'not_started', waivedReason: null,
      instructions: 'Not a grade — this just shows us where to start! Do what you can on paper, skip what you don\'t know, and snap a photo. Then type "done" below and turn it in.',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(db.doc(`assignments/${kid}-d002-0`), {
      studentId: kid, dayIndex: 2, sequence: 0,
      scheduledDate: d2.scheduledDate, originalDate: d2.scheduledDate,
      subjectId: 'ela', itemType: 'reading', estimatedMinutes: 15,
      title: 'Start-of-year reading check with Mom',
      contentPath: DIBELS[kid], keyPath: null, externalUrl: null,
      status: 'not_started', waivedReason: null,
      assessment: 'reading', // marks this for the Reading Assessment results panel
      instructions: 'Read the passage out loud to Mom — she has the timing sheet. Check it off when you\'re done.',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log('Placement screeners inserted as the first items of days 1 and 2.');
}

main().catch((e) => { console.error(e); process.exit(1); });
