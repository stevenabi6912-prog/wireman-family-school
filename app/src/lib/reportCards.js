// Report-card math, kept free of React and Firebase so the same code can be
// run against real data from a script.
import { gradePct } from './grades';

export const SCHOOL_NAME = 'Wireman Family School';
export const SCHOOL_YEAR = '2026–27';
export const REPORT_KIDS = ['luke', 'layla', 'logan', 'lazarus'];

const DONE = new Set(['submitted', 'graded', 'waived']);

// The one place the letter scale lives. Highest first; the last row catches
// everything below.
export const LETTER_SCALE = [
  { letter: 'A', min: 90 },
  { letter: 'B', min: 80 },
  { letter: 'C', min: 70 },
  { letter: 'D', min: 60 },
  { letter: 'F', min: 0 },
];

export function letterFor(pct) {
  if (pct == null) return null;
  return (LETTER_SCALE.find((s) => pct >= s.min) ?? LETTER_SCALE[LETTER_SCALE.length - 1]).letter;
}

// Card order. Anything not listed (a future subject) sorts after these.
export const SUBJECT_ORDER = ['bible', 'math', 'ela', 'writing', 'history', 'science', 'spanish', 'entrepreneurship', 'custom'];
// Same wording as the gradebook (SUBJECT_NAMES in Records.jsx).
export const SUBJECT_NAMES = {
  bible: 'Bible', math: 'Math', ela: 'Grammar & Writing',
  history: 'History', science: 'Science', writing: 'Writing', spanish: 'Spanish',
  entrepreneurship: 'Entrepreneurship (elective)',
  custom: 'From Mom',
};
// "From Mom" one-offs only earn a row when something in them was graded.
const ALWAYS_LISTED = new Set(SUBJECT_ORDER.filter((s) => s !== 'custom'));

// Ids and dates are what comments were first saved under — don't change them.
export const QUARTERS = [
  { id: 'q1', label: 'Quarter 1', start: '2026-08-11', end: '2026-10-22' },
  { id: 'q2', label: 'Quarter 2', start: '2026-10-23', end: '2027-01-21' },
  { id: 'q3', label: 'Quarter 3', start: '2027-01-22', end: '2027-04-01' },
  { id: 'q4', label: 'Quarter 4', start: '2027-04-02', end: '2027-06-03' },
];

const YEAR_START = QUARTERS[0].start;
const YEAR_END = QUARTERS[QUARTERS.length - 1].end;

function dayBefore(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const later = (a, b) => (a > b ? a : b);
const earlier = (a, b) => (a < b ? a : b);

// calendar = buildCalendar(family, 150): ISO dates of school days 1..150.
// A term's start/end decide what belongs to it and leave no gaps, so work
// dated on a weekend or break still lands somewhere; shownEnd is the last
// school day, which is what the printed card says.
export function buildTermSystems(calendar) {
  const systems = [
    { id: 'quarters', label: 'Quarters', terms: QUARTERS.map((q) => ({ ...q, shownEnd: q.end })) },
  ];
  if (calendar && calendar.length >= 150) {
    const day = (n) => calendar[n - 1];
    systems.push({
      id: 'trimesters',
      label: 'Trimesters',
      terms: [
        { id: 't1', label: 'Trimester 1', start: earlier(day(1), YEAR_START), end: dayBefore(day(51)), shownStart: day(1), shownEnd: day(50) },
        { id: 't2', label: 'Trimester 2', start: day(51), end: dayBefore(day(101)), shownEnd: day(100) },
        { id: 't3', label: 'Trimester 3', start: day(101), end: later(day(150), YEAR_END), shownEnd: day(150) },
      ],
    });
  }
  const first = calendar?.[0] ?? YEAR_START;
  const last = calendar?.[149] ?? YEAR_END;
  systems.push({
    id: 'year',
    label: 'Full year',
    terms: [{
      id: 'year', label: 'Full Year',
      start: earlier(first, YEAR_START), end: later(last, YEAR_END),
      shownStart: first, shownEnd: last,
    }],
  });
  return systems;
}

export function termRangeLabel(term) {
  const fmt = (iso, withYear) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}),
    });
  };
  const start = term.shownStart ?? term.start;
  const end = term.shownEnd ?? term.end;
  return `${fmt(start, start.slice(0, 4) !== end.slice(0, 4))} – ${fmt(end, true)}`;
}

// Luke's daily TFM slot shares the Bible subject but is graded by TFM's own
// teachers, never here.
export function isTFM(a) {
  return a?.subjectId === 'bible' && a?.itemType === 'task' && String(a?.title ?? '').startsWith('TFM');
}

function localISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const inTerm = (iso, term) => !!iso && iso >= term.start && iso <= term.end;

// One student's card for one term.
//
// A grade belongs to the term its ASSIGNMENT was scheduled in — the same rule
// attendance uses — so work done on the last day of a term and scored by Abi
// the following week still counts for the term it was done in. Only when the
// assignment is gone do we fall back to the day it was graded.
export function buildCard(kid, term, assignments, grades) {
  const mine = (assignments ?? []).filter((a) => a.studentId === kid);
  const byId = new Map(mine.map((a) => [a.id, a]));
  const done = mine.filter((a) => inTerm(a.scheduledDate, term) && DONE.has(a.status));
  const days = new Set(done.map((a) => a.scheduledDate));
  const minutes = done.reduce((s, a) => s + (a.actualMinutes ?? a.estimatedMinutes ?? 0), 0);

  const rows = {};
  for (const a of done) {
    if (ALWAYS_LISTED.has(a.subjectId) && !isTFM(a)) rows[a.subjectId] ??= { sum: 0, count: 0 };
  }
  for (const g of grades ?? []) {
    if (g.studentId !== kid) continue;
    // a second-chance grade already lifted its original; counting it too
    // would double-dip (same rule as computeAverages)
    if (g.retryOf) continue;
    const a = byId.get(g.assignmentId ?? g.id);
    if (isTFM(a)) continue;
    const when = a?.scheduledDate ?? (g.gradedAt?.toDate ? localISO(g.gradedAt.toDate()) : null);
    if (!inTerm(when, term)) continue;
    const pct = gradePct(g);
    if (pct == null) continue;
    const row = (rows[g.subjectId] ??= { sum: 0, count: 0 });
    row.sum += pct;
    row.count++;
  }

  const rank = (s) => (SUBJECT_ORDER.includes(s) ? SUBJECT_ORDER.indexOf(s) : SUBJECT_ORDER.length);
  const subjects = Object.entries(rows)
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([subjectId, { sum, count }]) => {
      const avg = count ? Math.round(sum / count) : null;
      return { subjectId, name: SUBJECT_NAMES[subjectId] ?? subjectId, avg, letter: letterFor(avg), count };
    });

  const tfmAll = mine.filter((a) => isTFM(a) && inTerm(a.scheduledDate, term));
  const tfm = tfmAll.length
    ? { days: new Set(tfmAll.filter((a) => DONE.has(a.status)).map((a) => a.scheduledDate)).size }
    : null;

  return { days: days.size, hours: (minutes / 60).toFixed(1), items: done.length, subjects, tfm };
}
