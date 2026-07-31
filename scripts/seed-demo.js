// Seeds the EMULATOR suite with demo data: family config, students, subjects,
// and one day of real assignments for Logan (grade 5), so the checklist flow
// can be exercised end-to-end locally. Never run against the live project —
// it refuses unless the emulator env vars are set.
//
// Usage (with `npm run emulators` already running):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
//     node scripts/seed-demo.js

import admin from 'firebase-admin';
import { existsSync } from 'node:fs';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('Refusing to run: emulator env vars not set. This script is emulator-only.');
  process.exit(1);
}

admin.initializeApp({
  projectId: 'wireman-homeschool',
  storageBucket: 'wireman-homeschool.firebasestorage.app',
});

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CURRICULUM_ROOT = new URL('../Hillsdale/', import.meta.url).pathname;

async function uploadIfPresent(localRelPath, storagePath) {
  const local = `${CURRICULUM_ROOT}${localRelPath}`;
  if (!existsSync(local)) {
    console.warn(`  (skipping upload, not found locally: ${localRelPath})`);
    return false;
  }
  await bucket.upload(local, { destination: storagePath });
  console.log(`  uploaded ${storagePath}`);
  return true;
}

async function main() {
  const date = todayISO();

  // ---- auth accounts (same PINs the login screen will use locally) ----
  const accounts = [
    { id: 'luke', claims: { role: 'student', studentId: 'luke' }, pin: '040313' },
    { id: 'layla', claims: { role: 'student', studentId: 'layla' }, pin: '071114' },
    { id: 'logan', claims: { role: 'student', studentId: 'logan' }, pin: '061416' },
    { id: 'lazarus', claims: { role: 'student', studentId: 'lazarus' }, pin: '011618' },
    { id: 'abi', claims: { role: 'parent' }, pin: '04298900' }, // emulator-only placeholder
  ];
  for (const { id, claims, pin } of accounts) {
    const email = `${id}@wireman.local`;
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch {
      user = await auth.createUser({ email, password: pin, emailVerified: true });
    }
    await auth.setCustomUserClaims(user.uid, claims);
    await db.doc(`users/${user.uid}`).set(claims, { merge: true });
    console.log(`account ready: ${id}`);
  }

  // ---- family + students + subjects ----
  await db.doc('families/wireman').set({
    schoolYearStart: '2026-08-17',
    schoolYearEnd: '2027-06-03',
    schoolDays: [1, 2, 3, 4],
    dailySubjectOrder: ['bible', 'math', 'ela', 'history', 'science', 'writing'],
    holidays: [
      { start: '2026-09-07', end: '2026-09-07', label: "Labor Day" },
      { start: '2026-11-23', end: '2026-11-27', label: 'Thanksgiving' },
      { start: '2026-12-21', end: '2027-01-02', label: 'Christmas' },
      { start: '2027-02-15', end: '2027-02-15', label: "Presidents' Day" },
      { start: '2027-03-29', end: '2027-04-02', label: 'Easter/Spring' },
    ],
    blockouts: [],
  });

  const students = [
    { id: 'luke', name: 'Luke', grade: 8, dailyHoursBudget: 6, uiDensity: 'standard' },
    { id: 'layla', name: 'Layla', grade: 8, dailyHoursBudget: 6, uiDensity: 'standard' },
    { id: 'logan', name: 'Logan', grade: 5, dailyHoursBudget: 5, uiDensity: 'standard' },
    { id: 'lazarus', name: 'Lazarus', grade: 3, dailyHoursBudget: 4, uiDensity: 'large-low-word' },
  ];
  for (const s of students) {
    await db.doc(`students/${s.id}`).set({ ...s, subjectOrder: null, active: true });
  }

  const subjects = [
    { id: 'bible', name: 'Bible', contentSource: 'physical-book', gradable: false },
    { id: 'math', name: 'Math', contentSource: 'video-link-placeholder', gradable: true, platformUrl: 'https://digital.demmelearning.com/' },
    { id: 'ela', name: 'Grammar & Writing', contentSource: 'storage-pdf', gradable: true },
    { id: 'history', name: 'History', contentSource: 'storage-pdf', gradable: false },
    { id: 'science', name: 'Science', contentSource: 'storage-pdf', gradable: false },
    { id: 'writing', name: 'Writing', contentSource: 'storage-pdf', gradable: true },
  ];
  for (const s of subjects) {
    await db.doc(`subjects/${s.id}`).set(s);
  }

  // ---- curriculum uploads (Logan's real materials) ----
  console.log('uploading curriculum PDFs to the storage emulator…');
  const workbookUp = await uploadIfPresent(
    'HC Curriculum/5th Grade/ELA 5/Additional ELA Curriculum/Grammar and Writing 5 Student Workbook.pdf',
    'curriculum/ela/5/grammar-writing-5-student-workbook.pdf'
  );
  const sotwUp = await uploadIfPresent(
    'HC Curriculum/History/SOTW Volume 1 - ANCIENT History/SOTW1_ActivityBook.pdf',
    'curriculum/history/shared/sotw1-activity-book.pdf'
  );
  await uploadIfPresent(
    'HC Curriculum/5th Grade/ELA 5/Additional ELA Curriculum/Grammar and Writing 5 - Teacher Guide.pdf',
    'keys/ela/5/grammar-writing-5-teacher-guide.pdf'
  );

  // ---- one real day of assignments for Logan ----
  const assignments = [
    {
      id: `logan-${date}-1`,
      subjectId: 'bible',
      sequence: 1,
      title: 'Answers in Genesis — today\'s lesson (with Mom)',
      itemType: 'bible',
      estimatedMinutes: 20,
      instructions: 'Do today\'s Bible lesson from your book, then tap the button when you\'re done.',
    },
    {
      id: `logan-${date}-2`,
      subjectId: 'math',
      sequence: 2,
      title: 'Math-U-See — today\'s video lesson',
      itemType: 'video',
      estimatedMinutes: 45,
      externalUrl: null, // Demme Learning link added per-lesson later
      instructions: 'Watch today\'s lesson, then do the practice page on paper and snap a photo.',
    },
    {
      id: `logan-${date}-3`,
      subjectId: 'ela',
      sequence: 3,
      title: 'Grammar and Writing 5 — Lesson 1',
      itemType: 'worksheet',
      estimatedMinutes: 40,
      contentPath: workbookUp ? 'curriculum/ela/5/grammar-writing-5-student-workbook.pdf#page=9' : null,
      keyPath: 'keys/ela/5/grammar-writing-5-teacher-guide.pdf',
      instructions: 'Read the lesson pages, then type your answers to the Review Set below.',
    },
    {
      id: `logan-${date}-4`,
      subjectId: 'history',
      sequence: 4,
      title: 'Story of the World Ch. 1 — The Earliest People',
      itemType: 'reading',
      estimatedMinutes: 30,
      contentPath: sotwUp ? 'curriculum/history/shared/sotw1-activity-book.pdf#page=27' : null,
      instructions: 'Read the chapter pages, then tell Mom two things you remember.',
    },
    {
      id: `logan-${date}-5`,
      subjectId: 'science',
      sequence: 5,
      title: 'Memorize: the 4 jobs of the nervous system',
      itemType: 'memorization',
      estimatedMinutes: 15,
      instructions: 'Practice saying them out loud, then recite to Mom.',
    },
  ];

  for (const a of assignments) {
    const { id, ...data } = a;
    await db.doc(`assignments/${id}`).set({
      studentId: 'logan',
      scheduledDate: date,
      originalDate: date,
      status: 'not_started',
      waivedReason: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      contentPath: null,
      keyPath: null,
      externalUrl: null,
      ...data,
    });
  }
  console.log(`Seeded ${assignments.length} assignments for logan on ${date}.`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
