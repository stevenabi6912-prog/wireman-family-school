// Everything the Memory Book knows about one child's year: one on-demand read
// per collection (scoped to the child wherever the collection allows it), then
// pure derivations. Nothing here writes except saveBookNote.

import {
  collection, doc, getDoc, getDocs, query, where, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fetchStreakStats } from '../lib/streaks';
import { computeAverages, gradePct } from '../lib/grades';
import {
  fetchMemoryItems, fetchMemoryAttempts, attemptsFor, itemAppliesTo, isMastered,
  pieceTextFor, TRACK_META, TRACK_ORDER,
} from '../lib/memory';
import { resolveContentUrl, todayISO } from '../lib/assignments';
import { STUDENTS, displayName } from '../config/students';

export const SCHOOL_YEAR_LABEL = '2026–27';
export const TOTAL_SCHOOL_DAYS = 150;
export const BUSINESS_KIDS = ['luke', 'layla'];

const DONE = new Set(['submitted', 'graded', 'waived']);

const SUBJECT_ORDER = ['bible', 'math', 'ela', 'writing', 'history', 'science', 'spanish', 'entrepreneurship', 'custom'];
export const SUBJECT_META = {
  bible: { name: 'Bible', emoji: '📖' },
  math: { name: 'Math', emoji: '➗' },
  ela: { name: 'Grammar & Spelling', emoji: '✏️' },
  writing: { name: 'Writing', emoji: '📝' },
  history: { name: 'History', emoji: '🏛️' },
  science: { name: 'Science', emoji: '🔬' },
  spanish: { name: 'Spanish', emoji: '🌎' },
  entrepreneurship: { name: 'Entrepreneurship', emoji: '💼' },
  custom: { name: 'From Mom', emoji: '🌟' },
};
export const subjectName = (id) => SUBJECT_META[id]?.name ?? id;

// The kid's own annual report is the typed text of this one assignment.
const BIZ_REPORT_TITLE = { luke: 'Biz: Polish the report', layla: 'Biz: Assemble the report' };

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif)$/i;
const HEIC_EXT = /\.(heic|heif)$/i;
const GALLERY_SIZE = 12;
const GALLERY_MAX_PROBES = 40;
const SHORT_TEXT = 260;

export function prettyDate(iso, { year = true } = {}) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}),
  });
}

async function fetchWhere(coll, field, value) {
  const snap = await getDocs(query(collection(db, coll), where(field, '==', value)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchSub(studentId, name) {
  const snap = await getDocs(collection(db, 'businesses', studentId, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// A section that can't load shouldn't take the whole book down with it.
const soft = (promise, fallback) => promise.catch((err) => {
  console.error('memory book:', err);
  return fallback;
});

// ---------- derivations (pure) ----------

export function deriveNumbers(assignments, streaks) {
  const done = assignments.filter((a) => DONE.has(a.status));
  // A school day counts once every item planned for that day index is done;
  // extras with no dayIndex (clean-ups, From Mom) don't make or break a day.
  const byDay = {};
  for (const a of assignments) {
    if (!a.dayIndex) continue;
    const day = (byDay[a.dayIndex] ??= { total: 0, done: 0 });
    day.total++;
    if (DONE.has(a.status)) day.done++;
  }
  const daysCompleted = Object.values(byDay).filter((d) => d.done === d.total).length;
  // Same convention as the report cards: the timed minutes when we have
  // them, the planned minutes when the clock never ran.
  const minutes = done.reduce((s, a) => s + (a.actualMinutes ?? a.estimatedMinutes ?? 0), 0);
  const dates = done.map((a) => a.scheduledDate).filter(Boolean).sort();

  // The two personal records are stricter here than the live ones in
  // lib/streaks.js, because these get printed: a "fastest day" only counts
  // when every item that day was on the clock (a day with 3 of 10 items timed
  // otherwise wins at "3 minutes"), and an "earliest finish" only when the
  // last item was finished on the day itself, not caught up a week later.
  const byDate = {};
  for (const a of assignments) {
    if (!a.scheduledDate) continue;
    const day = (byDate[a.scheduledDate] ??= { total: 0, done: 0, worked: 0, timed: 0, minutes: 0, last: null });
    day.total++;
    if (!DONE.has(a.status)) continue;
    day.done++;
    if (a.status !== 'waived') {
      day.worked++;
      if (a.actualMinutes != null) {
        day.timed++;
        day.minutes += a.actualMinutes;
      }
    }
    const when = a.updatedAt?.toDate?.();
    if (when && (!day.last || when > day.last)) day.last = when;
  }
  let fastestDayMinutes = null;
  let earliest = null;
  for (const [date, day] of Object.entries(byDate)) {
    if (day.done !== day.total || day.worked < 4) continue;
    if (day.timed === day.worked && day.minutes > 0
      && (fastestDayMinutes === null || day.minutes < fastestDayMinutes)) {
      fastestDayMinutes = day.minutes;
    }
    if (day.last && day.last.toLocaleDateString('sv-SE') === date) {
      const mins = day.last.getHours() * 60 + day.last.getMinutes();
      if (earliest === null || mins < earliest) earliest = mins;
    }
  }
  const earliestFinish = earliest === null
    ? null
    : `${((Math.floor(earliest / 60) + 11) % 12) + 1}:${String(earliest % 60).padStart(2, '0')} ${earliest < 720 ? 'AM' : 'PM'}`;

  return {
    daysCompleted: Math.min(TOTAL_SCHOOL_DAYS, daysCompleted),
    hours: Math.round(minutes / 60),
    itemsFinished: done.length,
    bestStreak: streaks?.bestStreak ?? null,
    fastestDayMinutes,
    earliestFinish,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
  };
}

export function deriveSubjects(studentId, assignments, grades) {
  const averages = computeAverages(grades)[studentId] ?? {};
  const counts = {};
  for (const a of assignments) {
    if (!DONE.has(a.status)) continue;
    const row = (counts[a.subjectId] ??= { items: 0, minutes: 0 });
    row.items++;
    row.minutes += a.actualMinutes ?? a.estimatedMinutes ?? 0;
  }
  const ids = [...new Set([...Object.keys(counts), ...Object.keys(averages)])];
  return ids
    .map((id) => ({
      id,
      items: counts[id]?.items ?? 0,
      hours: Math.round((counts[id]?.minutes ?? 0) / 60),
      avg: averages[id]?.avg ?? null,
      graded: averages[id]?.count ?? 0,
    }))
    .filter((s) => s.items > 0)
    .sort((a, b) => {
      const ia = SUBJECT_ORDER.indexOf(a.id);
      const ib = SUBJECT_ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
}

// Reading items are titled "<Book> — Chapter 12" / "<Book> — Week 3 reading".
export function deriveBooks(assignments) {
  const books = {};
  for (const a of assignments) {
    if (a.itemType !== 'reading' || !DONE.has(a.status)) continue;
    const cut = (a.title ?? '').indexOf(' — ');
    if (cut <= 0) continue;
    const title = a.title.slice(0, cut).trim();
    const part = a.title.slice(cut + 3).trim();
    const book = (books[title] ??= { title, count: 0, chapters: 0, first: null, last: null });
    book.count++;
    if (/^chapters?\b/i.test(part)) book.chapters++;
    const date = a.scheduledDate;
    if (date && (!book.first || date < book.first)) book.first = date;
    if (date && (!book.last || date > book.last)) book.last = date;
  }
  return Object.values(books)
    .map((b) => ({ ...b, unit: b.chapters === b.count ? 'chapter' : 'reading' }))
    .sort((a, b) => (a.first ?? '').localeCompare(b.first ?? '') || a.title.localeCompare(b.title));
}

export function deriveMemory(studentId, items, attempts) {
  const mastered = [];
  const recited = [];
  for (const item of items) {
    if (!itemAppliesTo(item, studentId)) continue;
    const mine = attemptsFor(attempts, item.id, studentId);
    const passes = mine.filter((a) => a.result === 'pass').map((a) => a.date).sort();
    if (passes.length === 0) continue;
    // A unit piece is recited at the kid's own tier (a verse range), so the
    // full passage text on the item isn't necessarily what they learned.
    const pieceRef = item.isUnitPiece ? pieceTextFor(item, studentId) : null;
    const text = (item.text ?? '').trim();
    const title = item.title || item.reference || (text.length > 70 ? `${text.slice(0, 70)}…` : text);
    if (!title) continue; // a blank placeholder card — nothing to remember it by
    const row = {
      id: item.id,
      title,
      reference: item.reference || null,
      pieceRef,
      track: item.track,
      trackLabel: TRACK_META[item.track]?.label ?? 'Memory work',
      emoji: TRACK_META[item.track]?.emoji ?? '🌟',
      text: text && text.length <= SHORT_TEXT && !item.isUnitPiece ? text : null,
      date: passes.at(-1),
    };
    (isMastered(mine) ? mastered : recited).push(row);
  }
  const order = (a, b) =>
    TRACK_ORDER.indexOf(a.track) - TRACK_ORDER.indexOf(b.track) || (a.date ?? '').localeCompare(b.date ?? '');
  return { mastered: mastered.sort(order), recited: recited.sort(order) };
}

// Reports get written on Thursday evenings and again when a week is closed
// out late, so two docs can cover nearly the same week. Keep the later one.
export function deriveWeeks(reports) {
  const sorted = reports
    .map((r) => ({ ...r, weekEnd: r.weekEnd ?? r.id.slice(-10) }))
    .filter((r) => r.headline && /^\d{4}-\d{2}-\d{2}$/.test(r.weekEnd))
    .sort((a, b) => a.weekEnd.localeCompare(b.weekEnd));
  const out = [];
  sorted.forEach((r, i) => {
    const next = sorted[i + 1];
    if (next && (new Date(next.weekEnd) - new Date(r.weekEnd)) / 86400000 <= 3) return;
    out.push({
      weekEnd: r.weekEnd,
      headline: r.headline,
      win: r.wins?.[0] ?? null,
      finished: r.stats?.finished ?? null,
      assigned: r.stats?.assigned ?? null,
    });
  });
  return out;
}

function tally(list, key) {
  const counts = {};
  for (const row of list) {
    if (row[key] == null) continue;
    counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export function deriveCheers(received, sent) {
  const byDate = (a, b) => (a.date ?? '').localeCompare(b.date ?? '');
  return {
    received: [...received].sort(byDate).map((k) => ({ sticker: k.sticker, from: k.from, date: k.date })),
    receivedFrom: tally(received, 'from').map(([id, n]) => ({ id, name: displayName(id), n })),
    sentCount: sent.length,
    sentTo: tally(sent, 'to').map(([id, n]) => ({ id, name: displayName(id), n })),
    favoriteSticker: tally(sent, 'sticker')[0]?.[0] ?? null,
  };
}

export function deriveBusiness(studentId, raw, assignments, submissions) {
  if (!raw) return null;
  const { biz, transactions, customers, jobs, careLog, litters, puppies } = raw;
  const sum = (list) => list.reduce((s, t) => s + Number(t.amount || 0), 0);
  const incomeTxns = transactions.filter((t) => t.type === 'income');
  const expenseTxns = transactions.filter((t) => t.type === 'expense');
  const income = sum(incomeTxns);
  const expenses = sum(expenseTxns);
  const kennel = biz?.type === 'kennel';

  const reportTitle = BIZ_REPORT_TITLE[studentId];
  const reportAssignment = assignments.find(
    (a) => a.subjectId === 'entrepreneurship' && (a.title ?? '').trim() === reportTitle
  );
  const reportSub = reportAssignment && submissions.find((s) => s.id === reportAssignment.id);
  const report = reportSub && !reportSub.isDraft && reportSub.text?.trim() ? reportSub.text.trim() : null;

  const hasAnything = transactions.length + customers.length + jobs.length + careLog.length
    + litters.length + puppies.length > 0 || report;
  if (!hasAnything) return null;

  const facts = [];
  if (kennel) {
    facts.push({ label: puppies.length === 1 ? 'puppy raised' : 'puppies raised', value: puppies.length });
    const sold = puppies.filter((p) => p.status === 'sold').length;
    if (sold > 0) facts.push({ label: sold === 1 ? 'puppy sent home' : 'puppies sent home', value: sold });
    facts.push({ label: litters.length === 1 ? 'litter planned' : 'litters planned', value: litters.length });
    facts.push({ label: careLog.length === 1 ? 'care session logged' : 'care sessions logged', value: careLog.length });
  } else {
    facts.push({ label: customers.length === 1 ? 'customer served' : 'customers served', value: customers.length });
    facts.push({ label: jobs.length === 1 ? 'job logged' : 'jobs logged', value: jobs.length });
    facts.push({ label: incomeTxns.length === 1 ? 'payment collected' : 'payments collected', value: incomeTxns.length });
    const biggest = Math.max(0, ...incomeTxns.map((t) => Number(t.amount || 0)));
    if (biggest > 0) facts.push({ label: 'biggest payday', value: biggest, money: true });
  }

  // "0 puppies raised" isn't a headline — leave out what hasn't happened yet
  const shownFacts = facts.filter((f) => f.value > 0);

  return {
    kennel,
    name: biz?.name || (kennel ? 'Wireman Heritage Kennels LLC' : "Luke's Lawn Care"),
    income,
    expenses,
    profit: income - expenses,
    // start-up costs Mom & Dad fronted for the kennel are still expenses on the books
    familyCovered: sum(expenseTxns.filter((t) => t.paidBy === 'family')),
    facts: shownFacts,
    goalTarget: Number(kennel ? biz?.goalTarget : biz?.carTarget) || null,
    goalWhy: (kennel ? biz?.goalWhy : biz?.carWhy)?.trim() || null,
    vision: biz?.vision?.trim() || null,
    report,
  };
}

// Ranks graded photo submissions so a walk down the list alternates subjects
// and sweeps across the year, best scores first within each slice. The
// gallery takes the first dozen whose photo actually loads.
export function rankGalleryCandidates(assignments, grades, submissions) {
  const assignmentById = Object.fromEntries(assignments.map((a) => [a.id, a]));
  const gradeById = Object.fromEntries(grades.map((g) => [g.id, g]));
  let pool = [];
  for (const sub of submissions) {
    if (sub.isDraft) continue;
    const paths = (sub.fileUrls ?? []).filter((p) => typeof p === 'string' && IMAGE_EXT.test(p.split('#')[0]));
    if (paths.length === 0) continue;
    const grade = gradeById[sub.id];
    const assignment = assignmentById[sub.id];
    if (!grade || !assignment?.scheduledDate || grade.retryOf) continue;
    const pct = gradePct(grade);
    if (pct == null) continue;
    pool.push({
      id: sub.id,
      paths,
      pct,
      score: grade.overriddenScore ?? grade.score,
      maxScore: grade.maxScore,
      title: assignment.title ?? 'Untitled',
      subjectId: assignment.subjectId,
      date: assignment.scheduledDate ?? '',
    });
  }
  // Proud work only, when there's enough of it to choose from.
  for (const floor of [90, 80]) {
    const strong = pool.filter((c) => c.pct >= floor);
    if (strong.length >= GALLERY_SIZE * 2) {
      pool = strong;
      break;
    }
  }
  if (pool.length === 0) return [];

  const dates = pool.map((c) => c.date).sort();
  const start = new Date(dates[0]).getTime();
  const span = Math.max(1, new Date(dates.at(-1)).getTime() - start);
  const SLICES = 4;
  const sliceOf = (c) => Math.min(SLICES - 1, Math.floor(((new Date(c.date).getTime() - start) / span) * SLICES));

  const cells = {};
  const perSubject = {};
  for (const c of pool) {
    (cells[`${c.subjectId}|${sliceOf(c)}`] ??= []).push(c);
    perSubject[c.subjectId] = (perSubject[c.subjectId] ?? 0) + 1;
  }
  // best first; among equal scores prefer the work with the most on the page
  // (more points possible), then a stable order so the book doesn't reshuffle
  Object.values(cells).forEach((list) => list.sort(
    (a, b) => b.pct - a.pct || (b.maxScore ?? 0) - (a.maxScore ?? 0) || a.id.localeCompare(b.id)
  ));
  // rarest subjects go first so a lone science lab isn't crowded out by math
  const subjects = Object.keys(perSubject).sort((a, b) => perSubject[a] - perSubject[b] || a.localeCompare(b));

  const ranked = [];
  for (let pass = 0; ranked.length < pool.length && pass < pool.length + SLICES; pass++) {
    subjects.forEach((subjectId, i) => {
      const next = cells[`${subjectId}|${(pass + i) % SLICES}`]?.shift();
      if (next) ranked.push(next);
    });
  }
  return ranked;
}

// ---------- photos ----------

function canDisplay(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function firstLoadablePhoto(paths) {
  for (const path of paths) {
    try {
      const url = await resolveContentUrl(path);
      if (url && (await canDisplay(url))) return url;
    } catch { /* missing file or no access — try the next photo */ }
  }
  return null;
}

// Walks the ranked candidates until a dozen photos have really loaded.
// iPhone HEIC photos only decode in Safari; once one fails here the rest are
// skipped unprobed (they're ~1 MB each) and counted so the page can say so.
export async function loadGallery(ranked, isCancelled = () => false) {
  const photos = [];
  let heicWorks = null;
  let heicSkipped = 0;
  let probes = 0;
  const queue = [...ranked];
  while (queue.length && photos.length < GALLERY_SIZE && probes < GALLERY_MAX_PROBES && !isCancelled()) {
    const batch = [];
    while (queue.length && batch.length < Math.max(4, GALLERY_SIZE - photos.length)) {
      const c = queue.shift();
      const usable = heicWorks === false ? c.paths.filter((p) => !HEIC_EXT.test(p)) : c.paths;
      if (usable.length === 0) {
        heicSkipped++;
        continue;
      }
      batch.push({ ...c, paths: usable });
    }
    probes += batch.length;
    const urls = await Promise.all(batch.map((c) => firstLoadablePhoto(c.paths)));
    batch.forEach((c, i) => {
      const allHeic = c.paths.every((p) => HEIC_EXT.test(p));
      if (urls[i]) {
        if (allHeic) heicWorks = true;
        photos.push({ ...c, url: urls[i] });
      } else if (allHeic) {
        if (heicWorks === null) heicWorks = false;
        heicSkipped++;
      }
    });
  }
  if (heicWorks === false) {
    heicSkipped += queue.filter((c) => c.paths.every((p) => HEIC_EXT.test(p))).length;
  }
  // a batch can overshoot; keep the best-ranked dozen, then show them in year order
  const chosen = photos.slice(0, GALLERY_SIZE).sort((a, b) => a.date.localeCompare(b.date));
  return { photos: chosen, heicSkipped: heicWorks === false ? heicSkipped : 0 };
}

// ---------- loading ----------

export async function loadMemoryBook(studentId) {
  const fallback = STUDENTS.find((s) => s.id === studentId) ?? { id: studentId, name: studentId };
  const wantsBusiness = BUSINESS_KIDS.includes(studentId);

  const [
    studentSnap, assignments, grades, submissions, streaks, memoryItems, memoryAttempts,
    reports, cheersIn, cheersOut, noteSnap, business,
  ] = await Promise.all([
    soft(getDoc(doc(db, 'students', studentId)), null),
    fetchWhere('assignments', 'studentId', studentId),
    soft(fetchWhere('grades', 'studentId', studentId), []),
    soft(fetchWhere('submissions', 'studentId', studentId), []),
    soft(fetchStreakStats(studentId, todayISO()), null),
    soft(fetchMemoryItems(), []),
    soft(fetchMemoryAttempts(), []),
    soft(fetchWhere('kidReports', 'studentId', studentId), []),
    // single-field equality only: adding a date range would need a composite index
    soft(fetchWhere('kudos', 'to', studentId), []),
    soft(fetchWhere('kudos', 'from', studentId), []),
    soft(getDoc(doc(db, 'reportCards', `${studentId}-memorybook`)), null),
    wantsBusiness
      ? soft(Promise.all([
        getDoc(doc(db, 'businesses', studentId)),
        ...['transactions', 'customers', 'jobs', 'careLog', 'litters', 'puppies'].map((n) => fetchSub(studentId, n)),
      ]).then(([bizSnap, transactions, customers, jobs, careLog, litters, puppies]) => ({
        biz: bizSnap.exists() ? bizSnap.data() : {},
        transactions, customers, jobs, careLog, litters, puppies,
      })), null)
      : null,
  ]);

  const student = { ...fallback, ...(studentSnap?.exists() ? studentSnap.data() : {}), id: studentId };
  const headerImageUrl = student.theme?.headerImagePath
    ? await soft(resolveContentUrl(student.theme.headerImagePath), null)
    : null;

  return {
    student,
    headerImageUrl,
    numbers: deriveNumbers(assignments, streaks),
    subjects: deriveSubjects(studentId, assignments, grades),
    books: deriveBooks(assignments),
    memory: deriveMemory(studentId, memoryItems, memoryAttempts),
    weeks: deriveWeeks(reports),
    cheers: deriveCheers(cheersIn, cheersOut),
    business: wantsBusiness ? deriveBusiness(studentId, business, assignments, submissions) : null,
    galleryCandidates: rankGalleryCandidates(assignments, grades, submissions),
    note: noteSnap?.data()?.comments ?? '',
  };
}

// Lives in the existing report-card collection (parents only) as its own
// "term", so no new collection or rule is needed.
export async function saveBookNote(studentId, comments) {
  await setDoc(doc(db, 'reportCards', `${studentId}-memorybook`), {
    studentId,
    term: 'memorybook',
    comments,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
