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
  deleteField,
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

// Unfinished work from earlier days — the kid must catch these up before
// today's list unlocks.
export function watchOverdueAssignments(studentId, beforeDateISO, callback) {
  const q = query(
    collection(db, 'assignments'),
    where('studentId', '==', studentId),
    where('scheduledDate', '<', beforeDateISO),
    orderBy('scheduledDate', 'asc'),
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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

// Everything on a kid's plan dated today or earlier, live. One listener
// feeds the streak strip, badges, personal records and the year trail — they
// used to make three separate passes over the same history, one of them
// again after every single check-off.
export function watchYearSoFar(studentId, todayIso, callback) {
  const q = query(
    collection(db, 'assignments'),
    where('studentId', '==', studentId),
    where('scheduledDate', '<=', todayIso)
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
  // A clock that started on a DIFFERENT day is stale (left open overnight, or
  // stamped by an old bug) — recording days-long "work" poisons the hours log,
  // so a cross-day start records no time at all rather than a wrong one.
  const startedToday = startedMs &&
    new Date(startedMs).toLocaleDateString('sv-SE') === new Date().toLocaleDateString('sv-SE');
  if (startedToday) {
    patch.actualMinutes = Math.min(480, Math.max(1, Math.round((Date.now() - startedMs) / 60000)));
  }
  await updateDoc(doc(db, 'assignments', assignment.id), patch);
}

// Kid-side "oops, I'm not done" — only for check-off items (nothing typed to
// restore) that haven't been graded yet. Anything with real work in it goes
// through Mom, who can also clear the grade.
export async function undoCompletion(assignmentId) {
  await updateDoc(doc(db, 'assignments', assignmentId), {
    status: 'in_progress',
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
  await completeAssignment(assignment);
}

// Push the active item to the end of today's list. The clock resets so the
// minutes stay honest when they come back to it hours later.
export async function skipForNow(assignmentId) {
  await updateDoc(doc(db, 'assignments', assignmentId), {
    skipped: true,
    // each skip re-stamps the time, so skipping again always sends the card
    // to the very bottom — multiple skips rotate instead of jamming
    skippedAt: serverTimestamp(),
    startedAt: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

// Undo an accidental skip — the card returns to its normal spot in the list.
export async function unskip(assignmentId) {
  await updateDoc(doc(db, 'assignments', assignmentId), {
    skipped: deleteField(),
    skippedAt: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

// A phone or webcam photo is 5-8 MB; a worksheet is perfectly legible at a
// fraction of that. Shrinking before upload makes turn-ins feel instant and
// spares the grader downloading every byte. Anything that can't be decoded
// (or wouldn't get smaller) goes up untouched — a slow upload beats a lost one.
const MAX_PHOTO_EDGE = 2000;

// iPhone HEIC photos: only Safari can display them and the grader can't read
// them, so they become JPEGs before upload. The converter is big, so it only
// loads for the kid who actually picks a HEIC file.
async function heicToJpeg(file) {
  const isHeic = /image\/hei[cf]/.test(file.type ?? '') || /\.hei[cf]$/i.test(file.name ?? '');
  if (!isHeic) return file;
  try {
    const { default: heic2any } = await import('heic2any');
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
    const blob = Array.isArray(out) ? out[0] : out;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

async function shrinkPhoto(original) {
  const file = await heicToJpeg(original);
  if (!file.type?.startsWith('image/') || file.type === 'image/gif' || file.size < 700 * 1024) return file;
  try {
    let source;
    let width;
    let height;
    try {
      source = await createImageBitmap(file, { imageOrientation: 'from-image' });
      ({ width, height } = source);
    } catch {
      // Safari can show formats (HEIC) it won't hand to createImageBitmap
      const url = URL.createObjectURL(file);
      try {
        source = new Image();
        source.src = url;
        await source.decode();
        width = source.naturalWidth;
        height = source.naturalHeight;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export async function uploadSubmissionFile(studentId, dateISO, file) {
  const out = await shrinkPhoto(file);
  const path = `submissions/${studentId}/${dateISO}/${Date.now()}-${out.name}`;
  await uploadBytes(ref(storage, path), out, out.type ? { contentType: out.type } : undefined);
  return path;
}
