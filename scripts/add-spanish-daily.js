// Adds Flip Flop Spanish as a DAILY curriculum subject for all four kids
// (Abi's call: separate from electives/memory work), WEEK-ALIGNED with the
// memory & recitation plan: week N's audio backs week N's recitation topic.
//   - The 128 Sí Sí tracks are split across the 36 memory weeks in CD order
//     (weeks 1-16 get 3 tracks, weeks 17-36 get 4 — gentle start, then ramp).
//   - Days 1-3 of a week introduce that week's tracks; Day 4 replays the
//     week's first track as repaso and sends them to recite for Mom.
//   - The 6 days past week 36 (days 145-150) close the year with El Puente
//     bridge tracks 1-6; the full Puente set stays on the memory-work shelf.
// Idempotent: doc ids are {kid}-spanish-d{NNN}; re-running overwrites cleanly.
// Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/add-spanish-daily.js

import admin from 'firebase-admin';
import { buildCalendar } from '../app/src/lib/calendar.js';

admin.initializeApp({ projectId: 'wireman-homeschool', storageBucket: 'wireman-homeschool.firebasestorage.app' });
const db = admin.firestore();

const KIDS = ['luke', 'layla', 'logan', 'lazarus'];
const DAYS = 150;

function trackNum(path) {
  // "seesay-cd1-track31-1.mp3" is track 31 (a re-export suffix), so read the
  // number right after "track"/"puente", never the last digits before .mp3.
  const m = path.match(/track-?(\d+)/) ?? path.match(/el_puente_(\d+)/);
  return Number(m?.[1] ?? 0);
}

async function main() {
  const [files] = await admin.storage().bucket().getFiles({ prefix: 'curriculum/spanish/' });
  const mp3s = files.map((f) => f.name).filter((n) => n.endsWith('.mp3'));

  const sisi = mp3s
    .filter((n) => n.includes('sisi-l1-audio'))
    .sort((a, b) => {
      const cd = (p) => Number(p.match(/cd(\d+)/)?.[1] ?? 0);
      return cd(a) - cd(b) || trackNum(a) - trackNum(b);
    });
  const bridge = mp3s.filter((n) => n.includes('bridge-audio')).sort((a, b) => trackNum(a) - trackNum(b));

  const label = (p) => `Sí Sí CD ${p.match(/cd(\d+)/)[1]}, Track ${trackNum(p)}`;

  // Split the Sí Sí tracks into the 36 memory-plan weeks, in order.
  const weekTracks = [];
  let cursor = 0;
  for (let w = 1; w <= 36; w++) {
    const take = w <= 16 ? 3 : 4; // 16*3 + 20*4 = 128
    weekTracks.push(sisi.slice(cursor, cursor + take));
    cursor += take;
  }

  const lessons = [];
  for (let day = 1; day <= DAYS; day++) {
    const week = Math.ceil(day / 4);
    const dow = ((day - 1) % 4) + 1;
    if (week <= 36) {
      const tracks = weekTracks[week - 1];
      if (dow > tracks.length) {
        // 3-track weeks: day 4 is repaso of the week's NEWEST track. (Replaying
        // the first track sent week 1 back to the CD's intro — Layla caught it.
        // And 4-track weeks get no repaso day at all: day 4 IS track 4,
        // otherwise the 4th track of every later week would never play.)
        const src = tracks[tracks.length - 1];
        lessons.push({ path: src, title: `Spanish repaso (Week ${week}) — ${label(src)}`, review: true });
      } else {
        lessons.push({ path: tracks[dow - 1], title: `Spanish (Week ${week}) — ${label(tracks[dow - 1])}`, reciteDay: dow === 4 });
      }
    } else {
      const p = bridge[(day - 145) % bridge.length];
      lessons.push({ path: p, title: `Spanish finale — El Puente, Track ${trackNum(p)}` });
    }
  }

  const family = (await db.doc('families/wireman').get()).data();
  const cal = buildCalendar(family, DAYS);

  let batch = db.batch();
  let n = 0;
  for (let day = 1; day <= DAYS; day++) {
    const lesson = lessons[day - 1];
    for (const kid of KIDS) {
      batch.set(db.doc(`assignments/${kid}-spanish-d${String(day).padStart(3, '0')}`), {
        studentId: kid,
        dayIndex: day,
        sequence: 9, // after the day's regular line-up
        scheduledDate: cal[day - 1],
        originalDate: cal[day - 1],
        status: 'not_started',
        waivedReason: null,
        subjectId: 'spanish',
        itemType: 'audio',
        estimatedMinutes: 10,
        title: lesson.title,
        contentPath: lesson.path,
        keyPath: null,
        externalUrl: null,
        instructions: lesson.review
          ? 'Repaso day! Replay this week\'s newest Spanish lesson and say it all out loud — then show off this week\'s Spanish to Mom at recitation time. 🎤'
          : lesson.reciteDay
            ? 'Play today\'s Spanish lesson and say every phrase OUT LOUD — then show off this week\'s Spanish to Mom at recitation time. 🎤'
            : 'Play today\'s Spanish lesson and say every phrase OUT LOUD with the audio. Flip Flop only works if your mouth moves!',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (++n === 400) { await batch.commit(); batch = db.batch(); n = 0; }
    }
  }
  if (n) await batch.commit();

  await db.doc('subjects/spanish').set({
    id: 'spanish',
    name: 'Spanish',
    contentSource: 'storage-audio',
    gradable: false,
  });

  console.log(`Spanish daily plan: ${DAYS} days x ${KIDS.length} kids = ${DAYS * KIDS.length} assignments, week-aligned with the memory plan (${sisi.length} Sí Sí tracks over 36 weeks + El Puente finale).`);
  console.log(`Day 1: ${lessons[0].title} | Day 4: ${lessons[3].title} | Day 5: ${lessons[4].title} | Day 145: ${lessons[144].title}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
