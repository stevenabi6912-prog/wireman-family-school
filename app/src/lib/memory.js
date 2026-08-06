// Memory & Recitation plan helpers, shared by the kid MemoryBlock and Abi's
// Day-4 recite screen. Items live in /memoryItems (seeded from Abi's plan,
// editable by her); attempts in /memoryAttempts (parent-recorded on Day 4).
// Mastery is DERIVED, never stored: two passes at least 14 days apart.

import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { buildCalendar, toISO } from './calendar';

// Tier ladder: t1 = Lazarus (3rd), t2 = Logan (5th), t3 = Luke & Layla (8th).
export const TIER_OF = { luke: 't3', layla: 't3', logan: 't2', lazarus: 't1' };
const RANK = { t1: 1, t2: 2, t3: 3 };

export const TRACK_ORDER = ['passage', 'bible', 'history', 'science', 'grammar', 'spelling', 'spanish', 'math'];
export const TRACK_META = {
  bible: { emoji: '📖', label: 'Bible' },
  history: { emoji: '🏛️', label: 'History' },
  science: { emoji: '🔬', label: 'Science' },
  grammar: { emoji: '✏️', label: 'Grammar' },
  spelling: { emoji: '🔤', label: 'Spelling' },
  spanish: { emoji: '🌎', label: 'Spanish' },
  math: { emoji: '➗', label: 'Math facts' },
  passage: { emoji: '🎤', label: 'Big recitation piece' },
};

// Which memory week (1-36) and week-day (1-4) today falls on, from the same
// family calendar the scheduler uses. Before the year starts -> week 1, day 1.
export async function currentMemoryWeek() {
  const snap = await getDoc(doc(db, 'families', 'wireman'));
  if (!snap.exists()) return { week: 1, day: 1, preSeason: true };
  const calendar = buildCalendar(snap.data(), 150);
  const today = toISO(new Date());
  let n = 0;
  for (const iso of calendar) {
    if (iso > today) break;
    n++;
  }
  if (n === 0) return { week: 1, day: 1, preSeason: true };
  return {
    week: Math.min(36, Math.ceil(n / 4)),
    day: ((n - 1) % 4) + 1,
    preSeason: false,
  };
}

export async function fetchMemoryItems() {
  const snap = await getDocs(collection(db, 'memoryItems'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchMemoryAttempts() {
  const snap = await getDocs(collection(db, 'memoryAttempts'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Does this item apply to this kid? Per-kid items match by studentId; shared
// items match if the kid's tier falls inside [minTier, maxTier].
export function itemAppliesTo(item, studentId) {
  if (item.studentId) return item.studentId === studentId;
  const t = RANK[TIER_OF[studentId]];
  return t >= RANK[item.minTier ?? 't1'] && t <= RANK[item.maxTier ?? 't3'];
}

// Everything live in a given week: that week's items, standing items, and the
// current unit's recitation piece (worked on all six weeks of the unit).
export function itemsForWeek(items, week) {
  const unit = Math.min(6, Math.ceil(week / 6));
  return items.filter(
    (it) =>
      it.standing ||
      (it.isUnitPiece ? it.unit === unit : it.week === week)
  );
}

// The tiered text of a unit piece for one kid (falls back to the full piece).
export function pieceTextFor(item, studentId) {
  const tier = TIER_OF[studentId];
  return item[`piece${tier.toUpperCase()}`] ?? item.pieceT3 ?? null;
}

function daysBetween(isoA, isoB) {
  return Math.abs(new Date(isoB) - new Date(isoA)) / 86400000;
}

// Mastered = two 'pass' recitations at least 14 days apart.
export function isMastered(attempts) {
  const passes = attempts
    .filter((a) => a.result === 'pass')
    .map((a) => a.date)
    .sort();
  return passes.length >= 2 && daysBetween(passes[0], passes[passes.length - 1]) >= 14;
}

// At risk = the most recent recitation wasn't a pass.
export function isAtRisk(attempts) {
  if (attempts.length === 0) return false;
  const latest = [...attempts].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1);
  return latest.result !== 'pass';
}

export function attemptsFor(allAttempts, itemId, studentId) {
  return allAttempts.filter((a) => a.itemId === itemId && a.studentId === studentId);
}
