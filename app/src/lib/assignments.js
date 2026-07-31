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

export async function setAssignmentStatus(assignmentId, status) {
  await updateDoc(doc(db, 'assignments', assignmentId), {
    status,
    updatedAt: serverTimestamp(),
  });
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
  await setAssignmentStatus(assignment.id, 'submitted');
}

export async function uploadSubmissionFile(studentId, dateISO, file) {
  const path = `submissions/${studentId}/${dateISO}/${Date.now()}-${file.name}`;
  await uploadBytes(ref(storage, path), file);
  return path;
}
