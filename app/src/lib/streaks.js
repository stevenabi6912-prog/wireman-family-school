// Streaks & badges, fully DERIVED from assignment history — nothing stored,
// nothing for kids to fake (rules only let them flip their own statuses).
// A streak day = a school day where every scheduled item got finished.

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

const DONE = new Set(['submitted', 'graded', 'waived']);

const BADGES = [
  { at: (s) => s.totalDone >= 1, emoji: '🐣', label: 'First one done!' },
  { at: (s) => s.totalDone >= 25, emoji: '🥉', label: '25 items' },
  { at: (s) => s.totalDone >= 100, emoji: '🥈', label: '100 items' },
  { at: (s) => s.totalDone >= 300, emoji: '🥇', label: '300 items' },
  { at: (s) => s.totalDone >= 600, emoji: '🏆', label: '600 items' },
  { at: (s) => s.streak >= 3, emoji: '🔥', label: '3-day streak' },
  { at: (s) => s.streak >= 8, emoji: '🔥🔥', label: '2-week streak' },
  { at: (s) => s.streak >= 16, emoji: '🌋', label: '4-week streak' },
  { at: (s) => s.bestStreak >= 30, emoji: '🚀', label: '30-day best streak' },
];

export async function fetchStreakStats(studentId, todayIso) {
  const snap = await getDocs(
    query(
      collection(db, 'assignments'),
      where('studentId', '==', studentId),
      where('scheduledDate', '<=', todayIso)
    )
  );

  const byDate = {};
  let totalDone = 0;
  snap.forEach((d) => {
    const a = d.data();
    const day = (byDate[a.scheduledDate] ??= { total: 0, done: 0, minutes: 0, lastFinish: null });
    day.total++;
    if (DONE.has(a.status)) {
      day.done++;
      totalDone++;
      day.minutes += a.actualMinutes ?? 0;
      const when = a.updatedAt?.toDate?.();
      if (when && (!day.lastFinish || when > day.lastFinish)) day.lastFinish = when;
    }
  });

  const dates = Object.keys(byDate).sort();
  // Current streak: walk back from the latest day; an incomplete TODAY
  // doesn't break it (the day isn't over yet).
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    const day = byDate[dates[i]];
    const complete = day.done === day.total;
    if (dates[i] === todayIso && !complete) continue;
    if (complete) streak++;
    else break;
  }
  // Best streak ever, for the 🚀 badge.
  let bestStreak = 0;
  let run = 0;
  for (const date of dates) {
    if (byDate[date].done === byDate[date].total) {
      run++;
      bestStreak = Math.max(bestStreak, run);
    } else if (date !== todayIso) {
      run = 0;
    }
  }

  // Personal records over fully-completed days: fastest total time and
  // earliest time-of-day the last item got finished.
  let fastestDayMinutes = null;
  let earliestFinish = null;
  for (const date of dates) {
    const day = byDate[date];
    if (day.done !== day.total || day.total === 0) continue;
    if (day.minutes > 0 && (fastestDayMinutes === null || day.minutes < fastestDayMinutes)) {
      fastestDayMinutes = day.minutes;
    }
    if (day.lastFinish) {
      const mins = day.lastFinish.getHours() * 60 + day.lastFinish.getMinutes();
      if (earliestFinish === null || mins < earliestFinish) earliestFinish = mins;
    }
  }
  const earliestLabel = earliestFinish === null
    ? null
    : `${((Math.floor(earliestFinish / 60) + 11) % 12) + 1}:${String(earliestFinish % 60).padStart(2, '0')}`;

  const stats = { streak, bestStreak, totalDone, fastestDayMinutes, earliestFinish: earliestLabel };
  return { ...stats, badges: BADGES.filter((b) => b.at(stats)) };
}
