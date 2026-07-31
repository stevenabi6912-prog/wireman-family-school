// Applies verified page anchors (scripts/page-anchors.json) to every planned
// assignment, sets per-student Demme course links, and fixes the Fix It!
// overrun (the books have 30 weeks; later weeks become review days).
// Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/apply-anchors.js

import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

admin.initializeApp({ projectId: 'wireman-homeschool' });
const db = admin.firestore();
const A = JSON.parse(readFileSync(fileURLToPath(new URL('./page-anchors.json', import.meta.url)), 'utf8'));

const MATH_COURSE = {
  luke: 'https://new.demmelearning.com/courses/algebra-1/',
  layla: 'https://new.demmelearning.com/courses/algebra-1/',
  logan: 'https://new.demmelearning.com/courses/epsilon/',
  lazarus: 'https://new.demmelearning.com/courses/gamma/',
};
const MATH_BOOKS = {
  luke: { tests: ['curriculum/math/8/algebra1-tests.pdf', A['algebra1-tests']] },
  layla: { tests: ['curriculum/math/8/algebra1-tests.pdf', A['algebra1-tests']] },
  logan: {
    workbook: ['curriculum/math/5/epsilon-workbook.pdf', A['epsilon-workbook']],
    tests: ['curriculum/math/5/epsilon-tests.pdf', A['epsilon-tests']],
  },
  lazarus: {
    workbook: ['curriculum/math/3/gamma-workbook.pdf', A['gamma-workbook']],
    tests: ['curriculum/math/3/gamma-tests.pdf', A['gamma-tests']],
  },
};
function algebraWorkbook(lesson) {
  return lesson <= 18
    ? ['curriculum/math/8/algebra1-book-a.pdf', A['algebra1-book-a']]
    : ['curriculum/math/8/algebra1-book-b.pdf', A['algebra1-book-b']];
}
const FIXIT = {
  luke: ['curriculum/ela/8/fixit5-student.pdf', A['fixit5-student']],
  layla: ['curriculum/ela/8/fixit5-student.pdf', A['fixit5-student']],
  logan: ['curriculum/ela/5/fixit2-student.pdf', A['fixit2-student']],
};
const SCI = {
  little: ['curriculum/science/dk-4/grammar-earth-science-student.pdf', A['grammar-earth-science-student']],
  big: ['curriculum/science/5-8/logic-earth-science-student.pdf', A['logic-earth-science-student']],
};

function anchored([path, map], unitNum) {
  const p = map?.pages?.[String(unitNum)];
  return p ? `${path}#page=${p}` : path;
}

async function main() {
  const snap = await db.collection('assignments').where('dayIndex', '>', 0).get();
  let batch = db.batch(); let n = 0; let updated = 0; let fixitReview = 0;
  const commit = async () => { await batch.commit(); batch = db.batch(); n = 0; };

  for (const d of snap.docs) {
    const a = d.data();
    if (['submitted', 'graded', 'waived'].includes(a.status)) continue;
    const patch = {};
    let m;

    if (a.subjectId === 'math') {
      if ((m = a.title.match(/^Math — Lesson (\d+) Test$/))) {
        patch.contentPath = anchored(MATH_BOOKS[a.studentId].tests, Number(m[1]));
      } else if ((m = a.title.match(/^Math — Lesson (\d+)/))) {
        const lesson = Number(m[1]);
        const wb = a.studentId === 'luke' || a.studentId === 'layla'
          ? algebraWorkbook(lesson)
          : MATH_BOOKS[a.studentId].workbook;
        patch.contentPath = anchored(wb, lesson);
        if (a.itemType === 'video') patch.externalUrl = MATH_COURSE[a.studentId];
      }
    } else if ((m = a.title.match(/^Fix It! Grammar — Week (\d+), Day (\d+)/))) {
      const week = Number(m[1]);
      const book = FIXIT[a.studentId];
      if (week <= 30) {
        patch.contentPath = anchored(book, week);
      } else {
        // the book ends at week 30 — later slots become review days
        patch.title = 'Fix It! Grammar — review: redo a favorite week';
        patch.contentPath = book[0];
        patch.instructions = 'Pick an earlier week with Mom and re-fix its passages for practice. Type your corrected sentences.';
        fixitReview++;
      }
    } else if ((m = a.title.match(/^Story of the World 2 — Chapter (\d+)$/))) {
      patch.contentPath = anchored(['curriculum/history/shared/sotw2-text.pdf', A['sotw2-text']], Number(m[1]));
    } else if ((m = a.title.match(/^Earth Science — Week (\d+)/))) {
      const sci = a.studentId === 'lazarus' ? SCI.little : SCI.big;
      const week = Math.min(Number(m[1]), Object.keys(sci[1].pages).length);
      patch.contentPath = anchored(sci, week);
    } else if ((m = a.title.match(/^Charlotte's Web — Chapter (\d+)/))) {
      patch.contentPath = anchored(['curriculum/ela/3/charlottes-web-student-guide.pdf', A['charlottes-web-student-guide']], Number(m[1]));
    } else if ((m = a.title.match(/^Farmer Boy — Chapter (\d+)/))) {
      patch.contentPath = anchored(['curriculum/ela/3/farmer-boy-student-guide.pdf', A['farmer-boy-student-guide']], Number(m[1]));
    }

    if (Object.keys(patch).length) {
      batch.update(d.ref, patch);
      updated++;
      if (++n === 450) await commit();
    }
  }
  if (n) await commit();
  console.log(`anchored/updated ${updated} assignments (${fixitReview} Fix It overrun days converted to review)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
