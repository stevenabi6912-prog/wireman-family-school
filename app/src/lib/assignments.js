import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  updateDoc,
  setDoc,
  getDoc,
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Live-subscribes to one student's assignments for a given date, sorted by sequence.
export function watchDayAssignments(studentId, dateISO, callback) {
  const q = query(
    collection(db, 'assignments'),
    where('studentId', '==', studentId),
    where('scheduledDate', '==', dateISO)
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.sequence - b.sequence);
    callback(items);
  });
}

// Upcoming (future-dated) assignments for the work-ahead "bonus round" —
// the next few school days, ordered soonest-first.
export function watchUpcomingAssignments(studentId, afterDateISO, callback) {
  const q = query(
    collection(db, 'assignments'),
    where('studentId', '==', studentId),
    where('scheduledDate', '>', afterDateISO),
    orderBy('scheduledDate', 'asc'),
    limit(40)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function setAssignmentStatus(assignmentId, status) {
  await updateDoc(doc(db, 'assignments', assignmentId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

// Stamp when the kid first opens an item (only ever called when unset).
export async function markStarted(assignmentId) {
  await updateDoc(doc(db, 'assignments', assignmentId), {
    startedAt: serverTimestamp(),
    status: 'in_progress',
    updatedAt: serverTimestamp(),
  });
}

// Complete an item, recording how long it actually took (wall-clock from
// first open to done, capped at 8h so an overnight tab doesn't poison data).
export async function completeAssignment(assignment) {
  const patch = { status: 'submitted', updatedAt: serverTimestamp() };
  const startedMs = assignment.startedAt?.toMillis?.();
  if (startedMs) {
    patch.actualMinutes = Math.min(480, Math.max(1, Math.round((Date.now() - startedMs) / 60000)));
  }
  await updateDoc(doc(db, 'assignments', assignment.id), patch);
}

// contentPath may carry a "#page=N" anchor for deep-linking into a PDF.
export async function resolveContentUrl(contentPath) {
  if (!contentPath) return null;
  const [path, anchor] = contentPath.split('#');
  const url = await getDownloadURL(ref(storage, path));
  return anchor ? `${url}#${anchor}` : url;
}

// ---- submissions (drafts autosave; submit flips isDraft) ----

export function submissionDocId(assignmentId) {
  return assignmentId; // one submission per assignment
}

export async function loadSubmission(assignmentId) {
  const snap = await getDoc(doc(db, 'submissions', submissionDocId(assignmentId)));
  return snap.exists() ? snap.data() : null;
}

export async function saveDraft(assignment, studentId, payload) {
  await setDoc(
    doc(db, 'submissions', submissionDocId(assignment.id)),
    {
      assignmentId: assignment.id,
      studentId,
      isDraft: true,
      updatedAt: serverTimestamp(),
      ...payload,
    },
    { merge: true }
  );
}

export async function submitWork(assignment, studentId, payload) {
  await setDoc(
    doc(db, 'submissions', submissionDocId(assignment.id)),
    {
      assignmentId: assignment.id,
      studentId,
      isDraft: false,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...payload,
    },
    { merge: true }
  );
  await completeAssignment(assignment);
}

export async function uploadSubmissionFile(studentId, dateISO, file) {
  const path = `submissions/${studentId}/${dateISO}/${Date.now()}-${file.name}`;
  await uploadBytes(ref(storage, path), file);
  return path;
}
