// Seeds ONE example day of real assignments for all four students into the
// LIVE project, uploading the needed curriculum PDFs to Storage first.
// Uses only material that actually exists in the Homeschool folder.
//
// Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/seed-example-day.js

import admin from 'firebase-admin';
import { existsSync } from 'node:fs';

admin.initializeApp({
  projectId: 'wireman-homeschool',
  storageBucket: 'wireman-homeschool.firebasestorage.app',
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ROOT = new URL('../Hillsdale/', import.meta.url).pathname;
const MATH_URL = 'https://digital.demmelearning.com/';

const UPLOADS = [
  ['HC Curriculum/8th Grade/ELA 8/Additional ELA Curriculum/Grammar and Writing 8 - Writing Wookbook.pdf', 'curriculum/ela/8/grammar-writing-8-writing-workbook.pdf'],
  ['HC Curriculum/History/SOTW Volume 2 - MEDIEVAL History/SOTW Volume 2 ActivityBook.pdf', 'curriculum/history/shared/sotw2-activity-book.pdf'],
  ['HC Curriculum/Science/Biology/Science 5th - 8th Grade - Biology/Science Encyclopedias/Usborne Science Encyclopedia pg 1-122.pdf', 'curriculum/science/5-8/usborne-science-1-122.pdf'],
  ['HC Curriculum/5th Grade/ELA 5/Additional ELA Curriculum/Grammar and Writing 5 Student Workbook.pdf', 'curriculum/ela/5/grammar-writing-5-student-workbook.pdf'],
  ['HC Curriculum/5th Grade/ELA 5/Additional ELA Curriculum/Grammar and Writing 5 - Teacher Guide.pdf', 'keys/ela/5/grammar-writing-5-teacher-guide.pdf'],
  ['HC Curriculum/History/SOTW Volume 1 - ANCIENT History/SOTW1_ActivityBook.pdf', 'curriculum/history/shared/sotw1-activity-book.pdf'],
  ['HC Curriculum/3rd Grade/ELA 3/Additional ELA Curriculum/Charlotte_s Web - Teacher Guide.pdf', 'curriculum/ela/3/charlottes-web-teacher-guide.pdf'],
  ['HC Curriculum/Science/Biology/Science DK-4th Grade - Biology/Biology Coloring Pages.pdf', 'curriculum/science/dk-4/biology-coloring-pages.pdf'],
];

function day(studentId, date, items) {
  return items.map((item, i) => ({
    id: `${studentId}-${date}-${i + 1}`,
    doc: {
      studentId,
      scheduledDate: date,
      originalDate: date,
      sequence: i + 1,
      status: 'not_started',
      waivedReason: null,
      contentPath: null,
      keyPath: null,
      externalUrl: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...item,
    },
  }));
}

async function main() {
  const date = todayISO();

  console.log('Uploading curriculum PDFs to live Storage (a few are large — be patient)…');
  for (const [local, dest] of UPLOADS) {
    const path = `${ROOT}${local}`;
    if (!existsSync(path)) {
      console.warn(`  MISSING locally, skipped: ${local}`);
      continue;
    }
    const [exists] = await bucket.file(dest).exists();
    if (exists) {
      console.log(`  already uploaded: ${dest}`);
      continue;
    }
    await bucket.upload(path, { destination: dest });
    console.log(`  uploaded: ${dest}`);
  }

  const eighthGradeDay = (studentId) => day(studentId, date, [
    { subjectId: 'bible', title: "Answers in Genesis — today's lesson", itemType: 'bible', estimatedMinutes: 25,
      instructions: 'Do today\'s Bible lesson from your book, then check it off.' },
    { subjectId: 'math', title: 'Math-U-See — today\'s video lesson + practice page', itemType: 'video', estimatedMinutes: 60,
      externalUrl: MATH_URL,
      instructions: 'Watch today\'s lesson on Demme Learning, do the practice page on paper, and snap a photo when you turn in your next written assignment.' },
    { subjectId: 'ela', title: 'Grammar & Writing 8 — Writing Lesson 1', itemType: 'worksheet', estimatedMinutes: 45,
      contentPath: 'curriculum/ela/8/grammar-writing-8-writing-workbook.pdf#page=7',
      instructions: 'Read Writing Lesson 1, then type your response below. (Mom grades this one.)' },
    { subjectId: 'history', title: 'Story of the World (Medieval) — Ch. 1 review questions', itemType: 'worksheet', estimatedMinutes: 40,
      contentPath: 'curriculum/history/shared/sotw2-activity-book.pdf#page=15',
      instructions: 'Read the chapter section, then type answers to the review questions.' },
    { subjectId: 'science', title: 'Usborne Science Encyclopedia — assigned pages', itemType: 'reading', estimatedMinutes: 40,
      contentPath: 'curriculum/science/5-8/usborne-science-1-122.pdf#page=10',
      instructions: 'Read the assigned pages, then tell Mom the three most interesting things you learned.' },
    { subjectId: 'science', title: 'Memorize: the levels of classification', itemType: 'memorization', estimatedMinutes: 15,
      instructions: 'Practice out loud, then recite to Mom.' },
  ]);

  const all = [
    ...eighthGradeDay('luke'),
    ...eighthGradeDay('layla'),
    ...day('logan', date, [
      { subjectId: 'bible', title: "Answers in Genesis — today's lesson", itemType: 'bible', estimatedMinutes: 20,
        instructions: 'Do today\'s Bible lesson from your book, then check it off.' },
      { subjectId: 'math', title: 'Math-U-See — today\'s video lesson', itemType: 'video', estimatedMinutes: 45,
        externalUrl: MATH_URL,
        instructions: 'Watch today\'s lesson, then do the practice page on paper and snap a photo.' },
      { subjectId: 'ela', title: 'Grammar and Writing 5 — Lesson 1', itemType: 'worksheet', estimatedMinutes: 40,
        contentPath: 'curriculum/ela/5/grammar-writing-5-student-workbook.pdf#page=9',
        keyPath: 'keys/ela/5/grammar-writing-5-teacher-guide.pdf',
        instructions: 'Read the lesson pages, then type your answers to the Review Set below.' },
      { subjectId: 'history', title: 'Story of the World Ch. 1 — The Earliest People', itemType: 'reading', estimatedMinutes: 30,
        contentPath: 'curriculum/history/shared/sotw1-activity-book.pdf#page=27',
        instructions: 'Read the chapter pages, then tell Mom two things you remember.' },
      { subjectId: 'science', title: 'Memorize: the 4 jobs of the nervous system', itemType: 'memorization', estimatedMinutes: 15,
        instructions: 'Practice saying them out loud, then recite to Mom.' },
    ]),
    ...day('lazarus', date, [
      { subjectId: 'bible', title: 'Bible time with Mom', itemType: 'bible', estimatedMinutes: 20,
        instructions: 'Do your Bible lesson with Mom, then tap the button!' },
      { subjectId: 'math', title: 'Math video time!', itemType: 'video', estimatedMinutes: 30,
        externalUrl: MATH_URL,
        instructions: 'Watch your math video, then do your practice page.' },
      { subjectId: 'ela', title: "Charlotte's Web — Chapter 1 with Mom", itemType: 'reading', estimatedMinutes: 30,
        contentPath: 'curriculum/ela/3/charlottes-web-teacher-guide.pdf#page=9',
        instructions: 'Read Chapter 1 with Mom and talk about it.' },
      { subjectId: 'history', title: 'Story of the World — coloring page', itemType: 'worksheet', estimatedMinutes: 30,
        contentPath: 'curriculum/history/shared/sotw1-activity-book.pdf#page=181',
        instructions: 'Color the picture while Mom reads the story. Snap a photo when you\'re done!' },
      { subjectId: 'science', title: 'Biology coloring — parts of a plant', itemType: 'worksheet', estimatedMinutes: 20,
        contentPath: 'curriculum/science/dk-4/biology-coloring-pages.pdf#page=3',
        instructions: 'Color it in, then snap a photo!' },
      { subjectId: 'science', title: 'Say it to Mom: what leaves do', itemType: 'memorization', estimatedMinutes: 10,
        instructions: 'Tell Mom what a leaf does for the plant.' },
    ]),
  ];

  for (const { id, doc } of all) {
    await db.doc(`assignments/${id}`).set(doc);
  }
  console.log(`Seeded ${all.length} assignments across 4 students for ${date}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
