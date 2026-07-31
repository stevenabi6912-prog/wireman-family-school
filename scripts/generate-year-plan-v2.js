// YEAR PLAN v2 — rebuilt from the official "2026/2027 Hillsdale Classical
// OFFSITE Curriculum Guide" now that the complete corpus is on disk.
//   All 4:  Bible daily (physical AiG) • Math-U-See 5-day lesson cycle
//           (video -> practice A/B/C -> review -> test), 30 lessons = 150 days
//   Luke/Layla (8th): Algebra 1 • Fix It! L5 daily • IEW US History Writing 2x/wk
//   Logan (5th): Epsilon • Fix It! L2 daily • IEW Frontiers in Writing 2x/wk
//   Lazarus (3rd): Gamma • English Grammar Practice daily • Fables/Myths writing
//                  • literature (Charlotte's Web -> Farmer Boy) with student guides
//   History all: SOTW Volume 2 (text + activity book + tests) 2x/wk
//   Science all: Elemental Science Earth Science 2x/wk (Grammar stage for Laz,
//                Logic stage for the others)
// Preserves any already-completed assignments (worked-ahead/banked items);
// deletes and rewrites everything not yet started.
//
// Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/generate-year-plan-v2.js

import admin from 'firebase-admin';
import { existsSync, writeFileSync } from 'node:fs';
import { buildCalendar } from '../app/src/lib/calendar.js';

admin.initializeApp({ projectId: 'wireman-homeschool', storageBucket: 'wireman-homeschool.firebasestorage.app' });
const db = admin.firestore();
const bucket = admin.storage().bucket();
const ROOT = new URL('../Hillsdale/HC Curriculum/', import.meta.url).pathname;
const MATH_URL = 'https://digital.demmelearning.com/';
const DONE = new Set(['submitted', 'graded', 'waived']);

// ---- storage uploads: [localRelPath, storagePath] ----
const UP = [
  // Math-U-See (workbooks/tests per level; instruction manuals -> keys/ for Abi)
  ['3rd Grade/Math 3/Gamma Single & Multiple-Digit Multiplication - Student Workbook.pdf', 'curriculum/math/3/gamma-workbook.pdf'],
  ['3rd Grade/Math 3/Gamma Single & Multiple-Digit Multiplication - Tests.pdf', 'curriculum/math/3/gamma-tests.pdf'],
  ['3rd Grade/Math 3/Gamma Single & Multiple-Digit Multiplication - Instruction Manual.pdf', 'keys/math/3/gamma-instruction-manual.pdf'],
  ['5th Grade/Math 5/Epsilon Fractions - Student Workbook.pdf', 'curriculum/math/5/epsilon-workbook.pdf'],
  ['5th Grade/Math 5/Epsilon Fractions - Tests.pdf', 'curriculum/math/5/epsilon-tests.pdf'],
  ['5th Grade/Math 5/Epsilon Fractions - Instruction Manual.pdf', 'keys/math/5/epsilon-instruction-manual.pdf'],
  ['8th Grade/Math 8/Algebra 1 Book A.pdf', 'curriculum/math/8/algebra1-book-a.pdf'],
  ['8th Grade/Math 8/Algebra 1 Book B.pdf', 'curriculum/math/8/algebra1-book-b.pdf'],
  ['8th Grade/Math 8/Algebra 1 Tests.pdf', 'curriculum/math/8/algebra1-tests.pdf'],
  ['8th Grade/Math 8/Algebra 1 - Instruction Manual.pdf', 'keys/math/8/algebra1-instruction-manual.pdf'],
  // Grammar / writing
  ['8th Grade/ELA 8/Fix It! Grammar Level 5 Student.pdf', 'curriculum/ela/8/fixit5-student.pdf'],
  ['8th Grade/ELA 8/Fix It! Grammar Level 5 Teacher.pdf', 'keys/ela/8/fixit5-teacher.pdf'],
  ['8th Grade/ELA 8/US History Based Writing Lessons Student.pdf', 'curriculum/ela/8/us-history-writing-student.pdf'],
  ['8th Grade/ELA 8/US History Based Writing Lessons Teacher.pdf', 'keys/ela/8/us-history-writing-teacher.pdf'],
  ['5th Grade/ELA 5/Fix It! Grammar Level 2 Student.pdf', 'curriculum/ela/5/fixit2-student.pdf'],
  ['5th Grade/ELA 5/Fix It! Grammar Level 2 Teacher.pdf', 'keys/ela/5/fixit2-teacher.pdf'],
  ['5th Grade/ELA 5/Frontiers in Writing Student.pdf', 'curriculum/ela/5/frontiers-writing-student.pdf'],
  ['5th Grade/ELA 5/Frontiers in Writing Teacher.pdf', 'keys/ela/5/frontiers-writing-teacher.pdf'],
  ['3rd Grade/ELA 3/English Grammar Practice Student.pdf', 'curriculum/ela/3/english-grammar-practice-student.pdf'],
  ['3rd Grade/ELA 3/English Grammar Practice Teacher.pdf', 'keys/ela/3/english-grammar-practice-teacher.pdf'],
  ['3rd Grade/ELA 3/Fables, Myths, Fairytales Writing Lessons Student.pdf', 'curriculum/ela/3/fables-writing-student.pdf'],
  ['3rd Grade/ELA 3/Fables, Myths, Fairytales Writing Lessons Teacher.pdf', 'keys/ela/3/fables-writing-teacher.pdf'],
  ['3rd Grade/ELA 3/Additional ELA Curriculum/Charlotte_s Web - Student Guide.pdf', 'curriculum/ela/3/charlottes-web-student-guide.pdf'],
  ['3rd Grade/ELA 3/Additional ELA Curriculum/Farmer Boy - Student Guide.pdf', 'curriculum/ela/3/farmer-boy-student-guide.pdf'],
  ['3rd Grade/ELA 3/Additional ELA Curriculum/Farmer Boy - Teacher Guide.pdf', 'keys/ela/3/farmer-boy-teacher-guide.pdf'],
  // History: SOTW2 text + tests (activity book already uploaded)
  ['History/SOTW Volume 2 - MEDIEVAL History/SOTW2_Text.pdf', 'curriculum/history/shared/sotw2-text.pdf'],
  ['History/SOTW Volume 2 - MEDIEVAL History/SOTW2_Tests.pdf', 'keys/history/sotw2-tests.pdf'],
  // Science: Elemental Earth Science
  ['Science/Earth Science/Grammar Earth Science Student.pdf', 'curriculum/science/dk-4/grammar-earth-science-student.pdf'],
  ['Science/Earth Science/Grammar Earth Science Teacher.pdf', 'keys/science/dk-4/grammar-earth-science-teacher.pdf'],
  ['Science/Earth Science/Logic Earth Science Student.pdf', 'curriculum/science/5-8/logic-earth-science-student.pdf'],
  ['Science/Earth Science/Logic Earth Science Teacher.pdf', 'keys/science/5-8/logic-earth-science-teacher.pdf'],
  ['Science/Earth Science/Earth Science Coloring Pages.pdf', 'curriculum/science/dk-4/earth-science-coloring.pdf'],
];

async function uploadAll() {
  console.log('Uploading curriculum to Storage (idempotent)…');
  for (const [local, dest] of UP) {
    const p = `${ROOT}${local}`;
    if (!existsSync(p)) { console.warn(`  MISSING: ${local}`); continue; }
    const [exists] = await bucket.file(dest).exists();
    if (exists) continue;
    await bucket.upload(p, { destination: dest });
    console.log(`  up: ${dest}`);
  }
}

// ---- builders ----
const bible = (mins) => ({
  subjectId: 'bible', itemType: 'bible', estimatedMinutes: mins,
  title: "Answers in Genesis — today's lesson",
  instructions: "Do today's Bible lesson from your book, then check it off.",
});

// Math-U-See 5-day cycle. lessonNum 1..30, phase 0..4
function musDay(level, lessonNum, phase, paths, mins) {
  const L = `Lesson ${lessonNum}`;
  if (phase === 0) return {
    subjectId: 'math', itemType: 'video', estimatedMinutes: mins,
    title: `Math — ${L}: watch the video + Practice A`, externalUrl: MATH_URL,
    instructions: `Watch the ${level} ${L} video on Demme Learning, then do Practice page A in your workbook and snap a photo.`,
  };
  if (phase === 4) return {
    subjectId: 'math', itemType: 'test', estimatedMinutes: mins,
    title: `Math — ${L} Test`, contentPath: paths.tests,
    instructions: `Take the ${L} test on paper and snap a photo. Mom checks it against the answer key.`,
  };
  const label = ['', 'Practice B', 'Practice C', 'Systematic Review'][phase];
  return {
    subjectId: 'math', itemType: 'worksheet', estimatedMinutes: mins,
    title: `Math — ${L}: ${label}`, contentPath: paths.workbook,
    instructions: `Do the ${label} page(s) for ${L} on paper and snap a photo. Rewatch the video on Demme if you need a refresher.`,
  };
}

const fixit = (level, path, week, day, mins) => ({
  subjectId: 'ela', itemType: 'worksheet', estimatedMinutes: mins,
  title: `Fix It! Grammar — Week ${week}, Day ${day}`, contentPath: path,
  instructions: 'Fix today\'s passage: mark corrections in your book (or on paper) and type the corrected sentence(s) below.',
});

const writingLesson = (name, path, n, mins) => ({
  subjectId: 'writing', itemType: 'worksheet', estimatedMinutes: mins,
  title: `${name} — Session ${n}`, contentPath: path,
  instructions: 'Do the next part of your current writing lesson. Type what you have so far.',
});

function sotw2(chapter, part, little) {
  if (part === 0) return {
    subjectId: 'history', itemType: 'reading', estimatedMinutes: little ? 25 : 35,
    title: `Story of the World 2 — Chapter ${chapter}`,
    contentPath: 'curriculum/history/shared/sotw2-text.pdf',
    instructions: little
      ? 'Read (or listen to) the chapter with Mom, then tell her your favorite part.'
      : 'Read the chapter, then tell Mom two things you remember.',
  };
  return little
    ? {
        subjectId: 'history', itemType: 'worksheet', estimatedMinutes: 25,
        title: `SOTW 2 — Ch. ${chapter} coloring & map`,
        contentPath: 'curriculum/history/shared/sotw2-activity-book.pdf',
        instructions: 'Do the coloring page or map for this chapter. Snap a photo!',
      }
    : {
        subjectId: 'history', itemType: 'worksheet', estimatedMinutes: 30,
        title: `SOTW 2 — Ch. ${chapter} review & map`,
        contentPath: 'curriculum/history/shared/sotw2-activity-book.pdf',
        instructions: 'Answer the review questions for this chapter (typed), then do the map work on paper and snap a photo.',
      };
}

function earthSci(week, part, little) {
  const path = little ? 'curriculum/science/dk-4/grammar-earth-science-student.pdf' : 'curriculum/science/5-8/logic-earth-science-student.pdf';
  if (part === 0) return {
    subjectId: 'science', itemType: 'reading', estimatedMinutes: little ? 20 : 35,
    title: `Earth Science — Week ${week} reading`,
    contentPath: path,
    instructions: little ? 'Do this week\'s reading with Mom and talk about it.' : 'Read this week\'s assigned pages, then write 3 sentences about what you learned.',
  };
  return {
    subjectId: 'science', itemType: 'worksheet', estimatedMinutes: little ? 20 : 35,
    title: `Earth Science — Week ${week} workbook page`,
    contentPath: path,
    instructions: little ? 'Do this week\'s activity page, then snap a photo!' : 'Complete this week\'s workbook/notebook pages on paper and snap a photo.',
  };
}

const memorization = (mins) => ({
  subjectId: 'science', itemType: 'memorization', estimatedMinutes: mins,
  title: "This week's memory work — recite to Mom",
  instructions: 'Practice this week\'s memory work out loud, then recite it to Mom.',
});

function buildStudent(cfg, totalDays) {
  const days = [];
  let hist = 1, histPart = 0, sci = 1, writing = 1, fixWeek = 1, fixDay = 1, litChapter = 1, lit2 = 1;
  for (let i = 0; i < totalDays; i++) {
    const dow = i % 4;
    const lesson = Math.min(30, Math.floor(i / 5) + 1);
    const phase = i % 5;
    const items = [bible(cfg.bibleMins), musDay(cfg.mathLevel, lesson, phase, cfg.mathPaths, cfg.mathMins)];

    // grammar daily
    if (cfg.fixit) {
      items.push(fixit(cfg.fixit.level, cfg.fixit.path, fixWeek, fixDay, cfg.fixit.mins));
      if (++fixDay > 4) { fixDay = 1; fixWeek++; }
    } else {
      // Lazarus: Memoria English Grammar Practice daily + literature daily
      items.push({
        subjectId: 'ela', itemType: 'worksheet', estimatedMinutes: 15,
        title: `English Grammar Practice — next page`,
        contentPath: 'curriculum/ela/3/english-grammar-practice-student.pdf',
        instructions: 'Do the next page in English Grammar Practice with Mom. Snap a photo.',
      });
      if (litChapter <= 22) {
        items.push({
          subjectId: 'ela', itemType: 'reading', estimatedMinutes: 25,
          title: `Charlotte's Web — Chapter ${litChapter} + guide page`,
          contentPath: 'curriculum/ela/3/charlottes-web-student-guide.pdf',
          instructions: 'Read the chapter with Mom, then do the student-guide page for it. Snap a photo.',
        });
        litChapter++;
      } else if (lit2 <= 29) {
        items.push({
          subjectId: 'ela', itemType: 'reading', estimatedMinutes: 25,
          title: `Farmer Boy — Chapter ${lit2} + guide page`,
          contentPath: 'curriculum/ela/3/farmer-boy-student-guide.pdf',
          instructions: 'Read the chapter with Mom, then do the student-guide page for it. Snap a photo.',
        });
        lit2++;
      }
    }

    if (dow === 0 || dow === 2) {
      if (hist <= 42) {
        items.push(sotw2(hist, histPart, cfg.little));
        if (histPart === 1) hist++;
        histPart = 1 - histPart;
      }
      if (dow === 0 && cfg.writingName && writing <= 28) {
        items.push(writingLesson(cfg.writingName, cfg.writingPath, writing, cfg.writingMins));
        writing++;
      }
      if (dow === 2 && cfg.writingName && writing <= 28 && writing > 1) {
        items.push({
          subjectId: 'writing', itemType: 'worksheet', estimatedMinutes: cfg.writingMins,
          title: `${cfg.writingName} — continue & polish`, contentPath: cfg.writingPath,
          instructions: 'Continue this week\'s writing lesson. Type your latest draft.',
        });
      }
    } else {
      if (sci <= 36) items.push(earthSci(sci, dow === 1 ? 0 : 1, cfg.little));
      if (dow === 3) { sci++; items.push(memorization(cfg.little ? 10 : 15)); }
    }
    days.push(items);
  }
  return days;
}

const CONFIGS = {
  luke: {
    little: false, bibleMins: 25, mathMins: 45, mathLevel: 'Algebra 1',
    mathPaths: { workbook: 'curriculum/math/8/algebra1-book-a.pdf', tests: 'curriculum/math/8/algebra1-tests.pdf' },
    fixit: { level: 5, path: 'curriculum/ela/8/fixit5-student.pdf', mins: 15 },
    writingName: 'US History-Based Writing', writingPath: 'curriculum/ela/8/us-history-writing-student.pdf', writingMins: 45,
  },
  logan: {
    little: false, bibleMins: 20, mathMins: 40, mathLevel: 'Epsilon',
    mathPaths: { workbook: 'curriculum/math/5/epsilon-workbook.pdf', tests: 'curriculum/math/5/epsilon-tests.pdf' },
    fixit: { level: 2, path: 'curriculum/ela/5/fixit2-student.pdf', mins: 15 },
    writingName: 'Frontiers in Writing', writingPath: 'curriculum/ela/5/frontiers-writing-student.pdf', writingMins: 35,
  },
  lazarus: {
    little: true, bibleMins: 20, mathMins: 30, mathLevel: 'Gamma',
    mathPaths: { workbook: 'curriculum/math/3/gamma-workbook.pdf', tests: 'curriculum/math/3/gamma-tests.pdf' },
    fixit: null,
    writingName: 'Fables, Myths & Fairytales Writing', writingPath: 'curriculum/ela/3/fables-writing-student.pdf', writingMins: 25,
  },
};
CONFIGS.layla = { ...CONFIGS.luke };

async function main() {
  await uploadAll();

  const family = (await db.doc('families/wireman').get()).data();
  const calendar = buildCalendar(family, 160);
  const totalDays = Math.min(150, calendar.length);
  console.log(`Planning ${totalDays} days: ${calendar[0]} -> ${calendar[totalDays - 1]}`);

  // wipe not-started plan docs; keep completed ones (banked/worked-ahead)
  const existing = await db.collection('assignments').where('dayIndex', '>', 0).get();
  const keep = new Set();
  let batch = db.batch(); let n = 0; let deleted = 0;
  for (const d of existing.docs) {
    if (DONE.has(d.data().status)) { keep.add(d.id); continue; }
    batch.delete(d.ref); deleted++;
    if (++n === 450) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();
  console.log(`Deleted ${deleted} not-started plan docs; preserving ${keep.size} completed.`);

  for (const [studentId, cfg] of Object.entries(CONFIGS)) {
    const days = buildStudent(cfg, totalDays);
    let b = db.batch(); let inB = 0; let count = 0;
    for (let dayIdx = 1; dayIdx <= days.length; dayIdx++) {
      const items = days[dayIdx - 1];
      for (let seq = 1; seq <= items.length; seq++) {
        const id = `${studentId}-d${String(dayIdx).padStart(3, '0')}-${seq}`;
        if (keep.has(id)) continue; // don't clobber banked work
        b.set(db.doc(`assignments/${id}`), {
          studentId, dayIndex: dayIdx, sequence: seq,
          scheduledDate: calendar[dayIdx - 1], originalDate: calendar[dayIdx - 1],
          status: 'not_started', waivedReason: null,
          contentPath: null, keyPath: null, externalUrl: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...items[seq - 1],
        });
        count++;
        if (++inB === 450) { await b.commit(); b = db.batch(); inB = 0; }
      }
    }
    if (inB) await b.commit();
    console.log(`${studentId}: ${count} assignments`);

    const budgets = { luke: 360, layla: 360, logan: 300, lazarus: 240 };
    const budget = budgets[studentId];
    let over = 0;
    const md = [`# Year Plan v2 — ${studentId[0].toUpperCase()}${studentId.slice(1)} (2026–27, official Hillsdale guide)`, '',
      `150 school days, ${calendar[0]} -> ${calendar[totalDays - 1]}. Budget ${budget / 60}h/day.`, '',
      '| Day | Date | Min | Items |', '|---|---|---|---|'];
    for (let i = 0; i < days.length; i++) {
      const mins = days[i].reduce((a, it) => a + (it.estimatedMinutes ?? 0), 0);
      if (mins > budget) over++;
      md.push(`| ${i + 1} | ${calendar[i]} | ${mins}${mins > budget ? ' ⚠️' : ''} | ${days[i].map((it) => it.title).join(' • ')} |`);
    }
    md.push('', `Days over budget: ${over}`, '', '## Gaps / notes');
    if (studentId === 'lazarus') {
      md.push('- Official guide lists "Introduction to Composition" and "Traditional Spelling III" for 3rd — NEITHER is in the corpus. Fables/Myths writing (on disk, filed under 3rd) fills the writing slot; spelling remains a real gap.');
    }
    md.push('- Math tests route to Abi\'s review queue (answer keys live inside the instruction manuals; auto-grade anchoring comes later).');
    md.push('- SOTW2 chapter tests available (uploaded to keys/) — Abi can give them on paper whenever she wants.');
    writeFileSync(new URL(`../year-plan-${studentId}.md`, import.meta.url).pathname, md.join('\n'));
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
