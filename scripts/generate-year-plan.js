// Generates the full 2026-27 year plan for all four students into Firestore,
// uploads the remaining curriculum PDFs, and exports year-plan-{student}.md
// for review. Every assignment carries dayIndex (school day 1..N); dates are
// derived from the family calendar so blockouts reflow instead of deleting.
//
// Built ONLY from material that exists in the Homeschool folder. Where a
// subject has no material for a grade, the plan says so instead of inventing
// assignments — see the "Gaps" section of each exported markdown file.
//
// Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/generate-year-plan.js

import admin from 'firebase-admin';
import { existsSync, writeFileSync } from 'node:fs';
import { buildCalendar } from '../app/src/lib/calendar.js';

admin.initializeApp({
  projectId: 'wireman-homeschool',
  storageBucket: 'wireman-homeschool.firebasestorage.app',
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

const ROOT = new URL('../Hillsdale/', import.meta.url).pathname;
const MATH_URL = 'https://digital.demmelearning.com/';

// ---------- uploads (idempotent) ----------
const UPLOADS = [
  ['HC Curriculum/5th Grade/ELA 5/Additional ELA Curriculum/Grammar and Writing 5 with Daily Review-Consumable Textbook.pdf', 'curriculum/ela/5/grammar-writing-5-textbook.pdf'],
  ['HC Curriculum/Science/Biology/Science 5th - 8th Grade - Biology/Biology Logic Stage Teacher Guide.pdf', 'curriculum/science/5-8/biology-logic-stage-guide.pdf'],
  ['HC Curriculum/Science/Biology/Science 5th - 8th Grade - Biology/Science Encyclopedias/Usborne Science Encyclopedia pg 123-186.pdf', 'curriculum/science/5-8/usborne-science-123-186.pdf'],
  ['HC Curriculum/Science/Biology/Science 5th - 8th Grade - Biology/Science Encyclopedias/Usborne Science Encyclopedia pg 187-295.pdf', 'curriculum/science/5-8/usborne-science-187-295.pdf'],
  ['HC Curriculum/Science/Biology/Science 5th - 8th Grade - Biology/Science Encyclopedias/Usborne Science Encyclopedia pg 296-448 End.pdf', 'curriculum/science/5-8/usborne-science-296-448.pdf'],
  ['HC Curriculum/Science/Biology/Science DK-4th Grade - Biology/Science Encyclopedias/My First Science Encyclopedia part 2.pdf', 'curriculum/science/dk-4/my-first-science-encyclopedia-2.pdf'],
  ['HC Curriculum/Science/Biology/Science DK-4th Grade - Biology/Science Encyclopedias/First Human Body Encyclopedia part 1.pdf', 'curriculum/science/dk-4/first-human-body-1.pdf'],
  ['HC Curriculum/Science/Biology/Science DK-4th Grade - Biology/Science Encyclopedias/First Human Body Encyclopedia part 2.pdf', 'curriculum/science/dk-4/first-human-body-2.pdf'],
  ['HC Curriculum/IEW Additional Resources/IEW Student Writing Intensive Level A.pdf', 'curriculum/writing/iew-swi-level-a.pdf'],
  ['HC Curriculum/Misc Scanned Literature Books/Blaze and The Forest Fire.pdf', 'curriculum/ela/3/blaze-and-the-forest-fire.pdf'],
];

async function uploadAll() {
  console.log('Uploading remaining curriculum PDFs (idempotent)…');
  for (const [local, dest] of UPLOADS) {
    const path = `${ROOT}${local}`;
    if (!existsSync(path)) { console.warn(`  MISSING locally: ${local}`); continue; }
    const [exists] = await bucket.file(dest).exists();
    if (exists) { console.log(`  exists: ${dest}`); continue; }
    await bucket.upload(path, { destination: dest });
    console.log(`  uploaded: ${dest}`);
  }
}

// ---------- shared item builders ----------
const bible = (mins) => ({
  subjectId: 'bible', itemType: 'bible', estimatedMinutes: mins,
  title: "Answers in Genesis — today's lesson",
  instructions: 'Do today\'s Bible lesson from your book, then check it off.',
});
const math = (mins) => ({
  subjectId: 'math', itemType: 'video', estimatedMinutes: mins, externalUrl: MATH_URL,
  title: 'Math-U-See — today\'s lesson',
  instructions: 'Watch today\'s lesson on Demme Learning, then do the practice page on paper. Snap a photo if Mom asks for one.',
});

// ---------- per-student plan builders ----------
// Each returns an array of days; day = array of items (sequence = position).

// Hake Grammar & Writing 5, from the publisher's 150-day pacing:
// lessons run sequentially; after every 5th lesson the NEXT day is a test day
// (writing lesson happens on test days). 112 lessons + 22 tests ≈ 134 days;
// remaining days become writing-workshop days at the end of each stretch.
function hake5Days(totalDays) {
  const days = [];
  let lesson = 1;
  let test = 1;
  let sinceTest = 0;
  // Publisher pacing: Test 1 lands after the first TEN lessons (day 11),
  // then a test after every 5 lessons.
  let testAfter = 10;
  while (days.length < totalDays) {
    if (sinceTest === testAfter && test <= 22) {
      testAfter = 5;
      days.push({
        subjectId: 'ela', itemType: 'test', estimatedMinutes: 40,
        title: `Grammar and Writing 5 — Test ${test} + Writing Lesson`,
        contentPath: 'curriculum/ela/5/grammar-writing-5-textbook.pdf',
        keyPath: `keys/ela/5/grammar-writing-5-teacher-guide.pdf#page=${122 + test}`,
        instructions: 'Take the test (Mom will hand it to you or open the pages), type your answers numbered. Then do the writing lesson on paper.',
      });
      test++; sinceTest = 0;
    } else if (lesson <= 112) {
      days.push({
        subjectId: 'ela', itemType: 'worksheet', estimatedMinutes: 40,
        title: `Grammar and Writing 5 — Lesson ${lesson}`,
        contentPath: 'curriculum/ela/5/grammar-writing-5-textbook.pdf',
        keyPath: `keys/ela/5/grammar-writing-5-teacher-guide.pdf#page=${6 + lesson}`,
        instructions: 'Read the lesson, then type your answers to the Review Set, numbered to match.',
      });
      lesson++; sinceTest++;
    } else {
      days.push({
        subjectId: 'ela', itemType: 'worksheet', estimatedMinutes: 35,
        title: 'Writing workshop — continue your current piece',
        contentPath: 'curriculum/ela/5/grammar-writing-5-textbook.pdf',
        instructions: 'Work on the current writing lesson. Type what you have so far.',
      });
    }
  }
  return days;
}

// SOTW: 42 chapters, 2 history days/week -> chapter day + review/activity day.
function sotwPair(vol, chapter, forLittle) {
  const book = vol === 1
    ? 'curriculum/history/shared/sotw1-activity-book.pdf'
    : 'curriculum/history/shared/sotw2-activity-book.pdf';
  const name = vol === 1 ? 'Story of the World (Ancient)' : 'Story of the World (Medieval)';
  const readDay = {
    subjectId: 'history', itemType: 'reading', estimatedMinutes: forLittle ? 25 : 35,
    title: `${name} — Chapter ${chapter}`,
    contentPath: book,
    instructions: forLittle
      ? 'Listen to the chapter with Mom, then tell her your favorite part.'
      : 'Read the chapter, then tell Mom two things you remember.',
  };
  const activityDay = forLittle
    ? {
        subjectId: 'history', itemType: 'worksheet', estimatedMinutes: 25,
        title: `${name} — Ch. ${chapter} coloring & activity`,
        contentPath: book,
        instructions: 'Do the coloring page or map for this chapter. Snap a photo when done!',
      }
    : {
        subjectId: 'history', itemType: 'worksheet', estimatedMinutes: 30,
        title: `${name} — Ch. ${chapter} review questions & map`,
        contentPath: book,
        instructions: 'Answer the review questions for this chapter (typed), then do the map work on paper and snap a photo.',
      };
  return [readDay, activityDay];
}

// Science, logic stage (Luke, Layla, Logan): 2 days/week through the
// Biology Logic Stage guide + encyclopedias, 36 weeks.
function logicScience(week, dayInWeek) {
  const guide = 'curriculum/science/5-8/biology-logic-stage-guide.pdf';
  return dayInWeek === 0
    ? {
        subjectId: 'science', itemType: 'reading', estimatedMinutes: 35,
        title: `Biology — Week ${week} reading`,
        contentPath: guide,
        instructions: 'Read this week\'s topic pages (Mom has the week list in the guide), then write 3 sentences about what you learned.',
      }
    : {
        subjectId: 'science', itemType: 'worksheet', estimatedMinutes: 35,
        title: `Biology — Week ${week} notebook page`,
        contentPath: guide,
        instructions: 'Finish this week\'s notebook/sketch work on paper and snap a photo.',
      };
}

// Science for Lazarus: encyclopedia read-aloud + coloring, 2 days/week.
function littleScience(week, dayInWeek) {
  return dayInWeek === 0
    ? {
        subjectId: 'science', itemType: 'reading', estimatedMinutes: 20,
        title: `Science storytime — Week ${week}`,
        contentPath: 'curriculum/science/dk-4/my-first-science-encyclopedia-2.pdf',
        instructions: 'Read this week\'s pages with Mom and talk about the pictures.',
      }
    : {
        subjectId: 'science', itemType: 'worksheet', estimatedMinutes: 20,
        title: `Biology coloring — Week ${week}`,
        contentPath: 'curriculum/science/dk-4/biology-coloring-pages.pdf',
        instructions: 'Color this week\'s page, then snap a photo!',
      };
}

const memorization = (mins) => ({
  subjectId: 'science', itemType: 'memorization', estimatedMinutes: mins,
  title: 'This week\'s memory work — recite to Mom',
  instructions: 'Practice this week\'s memory work out loud, then recite it to Mom.',
});

function buildLogan(totalDays) {
  const ela = hake5Days(totalDays);
  const days = [];
  let histChapter = 1; let histPart = 0; let sciWeek = 1; let iewLesson = 1;
  for (let i = 0; i < totalDays; i++) {
    const dow = i % 4; // 0=Mon..3=Thu
    const week = Math.floor(i / 4) + 1;
    const items = [bible(20), math(45), ela[i]];
    if (dow === 0 || dow === 2) {
      if (histChapter <= 42) {
        items.push(sotwPair(1, histChapter, false)[histPart]);
        if (histPart === 1) histChapter++;
        histPart = 1 - histPart;
      }
    } else {
      if (sciWeek <= 36) items.push(logicScience(sciWeek, dow === 1 ? 0 : 1));
      if (dow === 3) {
        sciWeek++;
        if (iewLesson <= 24) {
          items.push({
            subjectId: 'writing', itemType: 'worksheet', estimatedMinutes: 30,
            title: `IEW Writing — Session ${iewLesson}`,
            contentPath: 'curriculum/writing/iew-swi-level-a.pdf',
            instructions: 'Do the next IEW writing session. Type your paragraph when you finish.',
          });
          iewLesson++;
        }
        items.push(memorization(15));
      }
    }
    days.push(items);
  }
  return days;
}

function buildEighth(totalDays) {
  // Luke and Layla share the same structure. ELA: G&W8 writing workbook has
  // ~30 lessons -> Mon/Wed writing blocks across the year.
  const days = [];
  let histChapter = 1; let histPart = 0; let sciWeek = 1; let writingLesson = 1;
  for (let i = 0; i < totalDays; i++) {
    const dow = i % 4;
    const items = [bible(25), math(60)];
    if (dow === 0 || dow === 2) {
      if (writingLesson <= 30 && dow === 0) {
        items.push({
          subjectId: 'ela', itemType: 'worksheet', estimatedMinutes: 45,
          title: `Grammar & Writing 8 — Writing Lesson ${writingLesson}`,
          contentPath: 'curriculum/ela/8/grammar-writing-8-writing-workbook.pdf',
          instructions: 'Do the next writing lesson. Type your response. (Mom grades this one.)',
        });
        writingLesson++;
      } else if (dow === 2) {
        items.push({
          subjectId: 'ela', itemType: 'worksheet', estimatedMinutes: 45,
          title: 'Writing — revise & continue your current piece',
          contentPath: 'curriculum/ela/8/grammar-writing-8-writing-workbook.pdf',
          instructions: 'Revise or continue your current writing lesson piece. Type your latest draft.',
        });
      }
      if (histChapter <= 42) {
        items.push(sotwPair(2, histChapter, false)[histPart]);
        if (histPart === 1) histChapter++;
        histPart = 1 - histPart;
      }
    } else {
      if (sciWeek <= 36) items.push(logicScience(sciWeek, dow === 1 ? 0 : 1));
      if (dow === 3) { sciWeek++; items.push(memorization(15)); }
    }
    days.push(items);
  }
  return days;
}

function buildLazarus(totalDays) {
  const days = [];
  let cwChapter = 1;            // Charlotte's Web: 22 chapters, 1/day Mon-Thu
  let blazeSession = 1;         // Blaze and the Forest Fire: 8 read sessions
  let histChapter = 1; let histPart = 0; let sciWeek = 1;
  for (let i = 0; i < totalDays; i++) {
    const dow = i % 4;
    const week = Math.floor(i / 4) + 1;
    const items = [bible(20), math(30)];

    // ELA track: Charlotte's Web -> Blaze -> (gap: needs more 3rd-grade material)
    if (cwChapter <= 22) {
      items.push({
        subjectId: 'ela', itemType: 'reading', estimatedMinutes: 30,
        title: `Charlotte's Web — Chapter ${cwChapter} with Mom`,
        contentPath: 'curriculum/ela/3/charlottes-web-teacher-guide.pdf',
        instructions: 'Read the chapter with Mom and do the talking questions together.',
      });
      cwChapter++;
    } else if (blazeSession <= 8) {
      items.push({
        subjectId: 'ela', itemType: 'reading', estimatedMinutes: 25,
        title: `Blaze and the Forest Fire — Reading ${blazeSession}`,
        contentPath: 'curriculum/ela/3/blaze-and-the-forest-fire.pdf',
        instructions: 'Read the next pages out loud to Mom.',
      });
      blazeSession++;
    }
    // else: intentional gap — flagged in the markdown, no fabricated filler.

    if (dow === 0 || dow === 2) {
      if (histChapter <= 42) {
        items.push(sotwPair(1, histChapter, true)[histPart]);
        if (histPart === 1) histChapter++;
        histPart = 1 - histPart;
      }
    } else {
      if (sciWeek <= 36) items.push(littleScience(sciWeek, dow === 1 ? 0 : 1));
      if (dow === 3) { sciWeek++; items.push(memorization(10)); }
    }
    days.push(items);
  }
  return days;
}

// ---------- write to Firestore + export markdown ----------
async function main() {
  await uploadAll();

  const familySnap = await db.doc('families/wireman').get();
  const family = familySnap.data();
  const calendar = buildCalendar(family, 160);
  const totalDays = Math.min(150, calendar.length);
  console.log(`School calendar: ${calendar.length} available days; planning ${totalDays}. First: ${calendar[0]}, day ${totalDays}: ${calendar[totalDays - 1]}`);

  const plans = {
    luke: buildEighth(totalDays),
    layla: buildEighth(totalDays),
    logan: buildLogan(totalDays),
    lazarus: buildLazarus(totalDays),
  };

  for (const [studentId, days] of Object.entries(plans)) {
    let batch = db.batch();
    let inBatch = 0;
    let count = 0;
    for (let dayIdx = 1; dayIdx <= days.length; dayIdx++) {
      const date = calendar[dayIdx - 1];
      const items = days[dayIdx - 1];
      for (let seq = 1; seq <= items.length; seq++) {
        const ref = db.doc(`assignments/${studentId}-d${String(dayIdx).padStart(3, '0')}-${seq}`);
        batch.set(ref, {
          studentId,
          dayIndex: dayIdx,
          sequence: seq,
          scheduledDate: date,
          originalDate: date,
          status: 'not_started',
          waivedReason: null,
          contentPath: null,
          keyPath: null,
          externalUrl: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...items[seq - 1],
        });
        count++;
        if (++inBatch === 450) { await batch.commit(); batch = db.batch(); inBatch = 0; }
      }
    }
    if (inBatch) await batch.commit();
    console.log(`${studentId}: wrote ${count} assignments across ${days.length} days`);

    // markdown export
    const budgets = { luke: 360, layla: 360, logan: 300, lazarus: 240 };
    const budget = budgets[studentId];
    let overruns = 0;
    const md = [`# Year Plan — ${studentId[0].toUpperCase()}${studentId.slice(1)} (2026–27)`, '',
      `School days: ${days.length} (Mon–Thu), ${calendar[0]} → ${calendar[days.length - 1]}`,
      `Daily budget: ${budget / 60}h (screen/checklist time — paper practice adds more)`, '',
      '| Day | Date | Min | Items |', '|---|---|---|---|'];
    for (let i = 0; i < days.length; i++) {
      const mins = days[i].reduce((a, it) => a + (it.estimatedMinutes ?? 0), 0);
      const flag = mins > budget ? ' ⚠️OVER' : '';
      if (mins > budget) overruns++;
      md.push(`| ${i + 1} | ${calendar[i]} | ${mins}${flag} | ${days[i].map((it) => it.title).join(' • ')} |`);
    }
    md.push('', `**Days over the ${budget / 60}h budget: ${overruns}** (flagged ⚠️ above)`);
    md.push('', '## Gaps (material needed — nothing was invented to fill these)');
    if (studentId === 'luke' || studentId === 'layla') {
      md.push('- **Grammar (daily ELA)**: only the G&W8 *writing workbook* exists — no grammar textbook or teacher guide/answer key for grade 8. Writing runs 2×/week; a daily grammar track needs the missing textbook.');
      md.push('- **Literature**: no grade-8 novels/guides in the folder.');
      md.push('- **History depth**: SOTW is an elementary-level spine; consider a meatier 8th-grade history when available.');
    }
    if (studentId === 'logan') {
      md.push('- ELA is fully covered by the publisher\'s 150-day Hake pacing. Answer-key page anchors are estimates — mis-anchored grades land in Abi\'s review queue automatically.');
    }
    if (studentId === 'lazarus') {
      md.push('- **ELA after ~week 8**: Charlotte\'s Web (22 days) + Blaze (8 days) is all the grade-3 reading material on hand. From day ~31 the ELA slot is EMPTY until more material is added (phonics/spelling/readers).');
      md.push('- No grade-3 math worksheets/spelling/handwriting material in the folder.');
    }
    md.push('', `Bible is daily from the physical Answers in Genesis book (checkoff only). Math is daily via Demme Learning video + paper practice.`);
    const file = `year-plan-${studentId}.md`;
    writeFileSync(new URL(`../${file}`, import.meta.url).pathname, md.join('\n'));
    console.log(`  exported ${file}`);
  }
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
