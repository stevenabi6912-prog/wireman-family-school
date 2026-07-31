import { gradePct } from './grades';
import { todayISO } from './assignments';

// Struggle detection: plain sentences with the evidence baked in, capped at
// the top 3 flags per student so it stays actionable. Signals (best-effort
// from the data we actually record — no fabricated precision):
//   1. Declining grade trend across the last ~4 weeks of graded work
//   2. The grader's misunderstanding notes repeating across assignments
//   3. Overdue pile-ups and repeatedly rescheduled items per subject

const SUBJECT_NAMES = {
  bible: 'Bible', math: 'Math', ela: 'Grammar & Writing',
  history: 'History', science: 'Science', writing: 'Writing',
};

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function computeStruggleFlags({ grades, assignments }) {
  const flags = {}; // studentId -> [{severity, text}]
  const add = (studentId, severity, text) => {
    (flags[studentId] = flags[studentId] ?? []).push({ severity, text });
  };
  const today = todayISO();
  const cutoff = daysAgoISO(28);

  // ---- group recent graded work ----
  const recentByStudentSubject = {};
  for (const g of grades) {
    const when = g.gradedAt?.toDate?.() ? g.gradedAt.toDate().toISOString().slice(0, 10) : null;
    const pct = gradePct(g);
    if (pct == null || !when || when < cutoff) continue;
    const key = `${g.studentId}|${g.subjectId}`;
    (recentByStudentSubject[key] = recentByStudentSubject[key] ?? []).push({ when, pct, g });
  }

  // 1. Trend: first half vs second half of the window, needs >= 4 grades
  for (const [key, list] of Object.entries(recentByStudentSubject)) {
    if (list.length < 4) continue;
    list.sort((a, b) => a.when.localeCompare(b.when));
    const half = Math.floor(list.length / 2);
    const avg = (xs) => Math.round(xs.reduce((a, x) => a + x.pct, 0) / xs.length);
    const early = avg(list.slice(0, half));
    const late = avg(list.slice(half));
    if (early - late >= 15) {
      const [studentId, subjectId] = key.split('|');
      add(studentId, 3,
        `${SUBJECT_NAMES[subjectId] ?? subjectId} scores are sliding: averaged ${early}% earlier this month, ${late}% in the most recent work (${list.length} graded assignments).`);
    }
  }

  // 2. Repeated misunderstandings: surface the grader's own notes when
  //    2+ recent below-80% grades in a subject carry notes.
  for (const [key, list] of Object.entries(recentByStudentSubject)) {
    const noted = list.filter((x) => x.pct < 80 && x.g.misunderstandingSummary);
    if (noted.length >= 2) {
      const [studentId, subjectId] = key.split('|');
      const latest = noted[noted.length - 1].g.misunderstandingSummary;
      add(studentId, 2,
        `${SUBJECT_NAMES[subjectId] ?? subjectId}: ${noted.length} recent assignments came back under 80% with notes. Latest grader note: “${latest}”`);
    }
  }

  // 2b. Items consistently taking much longer than estimated (real timing data)
  const slow = {};
  for (const a of assignments) {
    if (!a.actualMinutes || !a.estimatedMinutes) continue;
    if (a.actualMinutes >= a.estimatedMinutes * 1.5 && a.actualMinutes - a.estimatedMinutes >= 10) {
      const key = `${a.studentId}|${a.subjectId}`;
      (slow[key] = slow[key] ?? []).push(a);
    }
  }
  for (const [key, list] of Object.entries(slow)) {
    if (list.length >= 3) {
      const [studentId, subjectId] = key.split('|');
      const worst = list.sort((a, b) => b.actualMinutes / b.estimatedMinutes - a.actualMinutes / a.estimatedMinutes)[0];
      add(studentId, 2,
        `${SUBJECT_NAMES[subjectId] ?? subjectId} is taking much longer than planned: ${list.length} assignments ran 1.5×+ over estimate (e.g. “${worst.title}” took ${worst.actualMinutes} min vs ~${worst.estimatedMinutes} planned).`);
    }
  }

  // 3. Overdue pile-ups / repeated rescheduling per subject
  const overdueCount = {};
  const rescheduled = {};
  for (const a of assignments) {
    const done = ['submitted', 'graded', 'waived'].includes(a.status);
    const key = `${a.studentId}|${a.subjectId}`;
    if (!done && a.scheduledDate < today) overdueCount[key] = (overdueCount[key] ?? 0) + 1;
    if (a.originalDate && a.scheduledDate !== a.originalDate && !done) {
      rescheduled[key] = (rescheduled[key] ?? 0) + 1;
    }
  }
  for (const [key, n] of Object.entries(overdueCount)) {
    if (n >= 3) {
      const [studentId, subjectId] = key.split('|');
      add(studentId, 2, `${n} ${SUBJECT_NAMES[subjectId] ?? subjectId} assignments are overdue — this subject keeps getting skipped.`);
    }
  }
  for (const [key, n] of Object.entries(rescheduled)) {
    if (n >= 3) {
      const [studentId, subjectId] = key.split('|');
      add(studentId, 1, `${n} ${SUBJECT_NAMES[subjectId] ?? subjectId} assignments have been pushed to a later day — worth asking why this one keeps slipping.`);
    }
  }

  // Cap: top 3 by severity per student
  const out = {};
  for (const [studentId, list] of Object.entries(flags)) {
    out[studentId] = list.sort((a, b) => b.severity - a.severity).slice(0, 3).map((f) => f.text);
  }
  return out;
}
