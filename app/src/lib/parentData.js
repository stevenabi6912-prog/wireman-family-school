import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import { db } from './firebase';
import { todayISO } from './assignments';

export const DONE_STATUSES = new Set(['submitted', 'graded', 'waived']);

// One live subscription covering today + everything overdue for every student.
// A single-field range query needs no composite index, and at family scale the
// result set is tiny; per-student grouping happens client-side.
export function watchAssignmentsThroughToday(callback) {
  const q = query(collection(db, 'assignments'), where('scheduledDate', '<=', todayISO()));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function watchStudents(callback) {
  return onSnapshot(collection(db, 'students'), (snap) => {
    const byId = {};
    snap.docs.forEach((d) => {
      byId[d.id] = { id: d.id, ...d.data() };
    });
    callback(byId);
  });
}

export async function waiveAssignment(assignmentId, reason = 'Waived by Abi') {
  await updateDoc(doc(db, 'assignments', assignmentId), {
    status: 'waived',
    waivedReason: reason,
    updatedAt: serverTimestamp(),
  });
}

export async function rescheduleAssignment(assignmentId, dateISO) {
  await updateDoc(doc(db, 'assignments', assignmentId), {
    scheduledDate: dateISO,
    status: 'not_started',
    // Hand-moved items leave the year-plan grid, so a later vacation
    // reflow won't snap them back to their old slot.
    dayIndex: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysOverdue(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - then) / 86400000);
}
