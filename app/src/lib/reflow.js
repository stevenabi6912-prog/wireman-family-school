import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { buildCalendar, dateForDayIndex } from './calendar';

// Parent-only. Adding/removing a blockout updates the family doc, then
// remaps every dayIndex-bearing assignment to its new date. Nothing is
// deleted — the whole tail of the year slides.

export async function getFamily() {
  const snap = await getDoc(doc(db, 'families', 'wireman'));
  return snap.data();
}

export async function addBlockout(start, end, label) {
  await updateDoc(doc(db, 'families', 'wireman'), {
    blockouts: arrayUnion({ id: `${Date.now()}`, start, end, label }),
  });
  return reflowAll();
}

// Make-up school days (usually Fridays): each one pulls the year's end a
// day earlier. Same reflow machinery as blockouts, opposite direction.
export async function addMakeupDay(iso) {
  await updateDoc(doc(db, 'families', 'wireman'), { extraDays: arrayUnion(iso) });
  return reflowAll();
}

export async function removeMakeupDay(iso) {
  const family = await getFamily();
  await updateDoc(doc(db, 'families', 'wireman'), {
    extraDays: (family.extraDays ?? []).filter((d) => d !== iso),
  });
  return reflowAll();
}

export async function removeBlockout(blockoutId) {
  const family = await getFamily();
  const next = (family.blockouts ?? []).filter((b) => b.id !== blockoutId);
  await updateDoc(doc(db, 'families', 'wireman'), { blockouts: next });
  return reflowAll();
}

// Recomputes the calendar and rewrites scheduledDate for every assignment
// whose dayIndex now maps to a different date. Returns a summary.
export async function reflowAll() {
  const family = await getFamily();

  // All planned assignments (the year plan carries dayIndex; ad-hoc items don't)
  const snap = await getDocs(query(collection(db, 'assignments'), where('dayIndex', '>', 0)));
  let maxDayIndex = 0;
  snap.docs.forEach((d) => {
    const di = d.data().dayIndex;
    if (di > maxDayIndex) maxDayIndex = di;
  });

  const calendar = buildCalendar(family, maxDayIndex);
  const DONE = new Set(['submitted', 'graded', 'waived']);
  let changed = 0;
  let batch = writeBatch(db);
  let inBatch = 0;
  for (const d of snap.docs) {
    const data = d.data();
    // Completed work keeps its historical date — only the remaining
    // schedule slides when the calendar changes.
    if (DONE.has(data.status)) continue;
    const newDate = dateForDayIndex(calendar, data.dayIndex);
    if (newDate && newDate !== data.scheduledDate) {
      batch.update(d.ref, { scheduledDate: newDate, updatedAt: serverTimestamp() });
      changed++;
      if (++inBatch === 450) {
        await batch.commit();
        batch = writeBatch(db);
        inBatch = 0;
      }
    }
  }
  if (inBatch) await batch.commit();

  return {
    changed,
    projectedEnd: dateForDayIndex(calendar, maxDayIndex),
    targetEnd: family.schoolYearEnd,
  };
}

// Cheap read-only projection for the dashboard header (no writes).
export async function projectYear() {
  const family = await getFamily();
  const snap = await getDocs(query(collection(db, 'assignments'), where('dayIndex', '>', 0)));
  let maxDayIndex = 0;
  snap.docs.forEach((d) => {
    const di = d.data().dayIndex;
    if (di > maxDayIndex) maxDayIndex = di;
  });
  const calendar = buildCalendar(family, maxDayIndex);
  return {
    family,
    projectedEnd: maxDayIndex ? dateForDayIndex(calendar, maxDayIndex) : null,
    targetEnd: family.schoolYearEnd,
  };
}
