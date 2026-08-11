// Adds Flip Flop Spanish as a DAILY curriculum subject for all four kids
// (Abi's call: separate from electives/memory work). One audio lesson per
// school day, same lesson for the whole family, in order:
//   days 1-128:  Sí Sí Level 1, CD 1-4 in track order
//   days 129-143: El Puente (bridge audio) 1-15
//   days 144-150: repaso — replay Sí Sí CD 1 tracks 1-7 (hear how far you've come)
// Idempotent: doc ids are {kid}-spanish-d{NNN}; re-running overwrites cleanly.
// Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/add-spanish-daily.js

import admin from 'firebase-admin';
import { buildCalendar } from '../app/src/lib/calendar.js';

admin.initializeApp({ projectId: 'wireman-homeschool', storageBucket: 'wireman-homeschool.firebasestorage.app' });
const db = admin.firestore();

const KIDS = ['luke', 'layla', 'logan', 'lazarus'];
const DAYS = 150;

function trackNum(path) {
  return Number(path.match(/(\d+)_?\.mp3$/)?.[1] ?? 0);
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

  const lessons = [];
  for (const p of sisi) {
    const cd = p.match(/cd(\d+)/)[1];
    lessons.push({ path: p, title: `Spanish — Sí Sí CD ${cd}, Track ${trackNum(p)}` });
  }
  for (const p of bridge) {
    lessons.push({ path: p, title: `Spanish — El Puente, Track ${trackNum(p)}` });
  }
  while (lessons.length < DAYS) {
    const src = lessons[lessons.length - sisi.length - bridge.length]; // CD 1 openers
    lessons.push({ path: src.path, title: `Spanish repaso — ${src.title.replace('Spanish — ', '')}`, review: true });
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
          ? 'Repaso! Replay this early lesson and notice how easy it sounds now. Say every phrase out loud with the audio.'
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

  console.log(`Spanish daily plan: ${DAYS} days x ${KIDS.length} kids = ${DAYS * KIDS.length} assignments (${sisi.length} Sí Sí + ${bridge.length} El Puente + ${DAYS - sisi.length - bridge.length} repaso).`);
  console.log(`Day 1 lesson: ${lessons[0].title} -> ${cal[0]}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
