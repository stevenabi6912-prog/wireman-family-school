import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// Effective percentage for a grade doc (Abi's override wins).
export function gradePct(g) {
  const score = g.overriddenScore ?? g.score;
  if (score == null || !g.maxScore) return null;
  return Math.round((score / g.maxScore) * 100);
}

export function watchAllGrades(callback) {
  return onSnapshot(collection(db, 'grades'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// { [studentId]: { [subjectId]: { avg, count } } } over graded work with scores.
export function computeAverages(grades) {
  const acc = {};
  for (const g of grades) {
    const pct = gradePct(g);
    if (pct == null) continue;
    acc[g.studentId] = acc[g.studentId] ?? {};
    const s = (acc[g.studentId][g.subjectId] = acc[g.studentId][g.subjectId] ?? { sum: 0, count: 0 });
    s.sum += pct;
    s.count++;
  }
  const out = {};
  for (const [stu, subjects] of Object.entries(acc)) {
    out[stu] = {};
    for (const [sub, { sum, count }] of Object.entries(subjects)) {
      out[stu][sub] = { avg: Math.round(sum / count), count };
    }
  }
  return out;
}

export async function overrideGrade(gradeId, overriddenScore) {
  await updateDoc(doc(db, 'grades', gradeId), {
    overriddenScore,
    needsManualReview: false,
    reviewedAt: serverTimestamp(),
  });
}

export async function approveGrade(gradeId) {
  await updateDoc(doc(db, 'grades', gradeId), {
    needsManualReview: false,
    reviewedAt: serverTimestamp(),
  });
}

export function gradesToCSV(grades, assignmentTitleById = {}) {
  const rows = [['Student', 'Subject', 'Assignment', 'Graded on', 'Score', 'Out of', 'Percent', 'Overridden', 'Notes']];
  for (const g of grades) {
    const pct = gradePct(g);
    rows.push([
      g.studentId,
      g.subjectId,
      assignmentTitleById[g.assignmentId] ?? g.assignmentId,
      g.gradedAt?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? '',
      g.overriddenScore ?? g.score ?? '',
      g.maxScore ?? '',
      pct == null ? '' : `${pct}%`,
      g.overriddenScore != null ? 'yes' : '',
      (g.misunderstandingSummary ?? '').replaceAll('"', "'"),
    ]);
  }
  return rows.map((r) => r.map((c) => `"${String(c)}"`).join(',')).join('\n');
}
