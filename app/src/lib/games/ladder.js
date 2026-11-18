// Season ladder: wins per player per game for the current calendar month,
// all-time totals, and last month's champion. Pure — it is handed finished
// game docs (or mock ones) and never touches Firestore itself.

import { GAME_TYPES } from './types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// When a game ended. `finishedAt` is stamped on game over; games that ended
// before that field existed fall back to their last write.
export function finishedAtMs(game) {
  const t = game.finishedAt ?? game.updatedAt;
  if (!t) return null;
  if (typeof t === 'number') return t;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  return null;
}

const monthKey = (d) => d.getFullYear() * 12 + d.getMonth();

export function buildLadder(games, roster, now = new Date()) {
  const thisMonth = monthKey(now);
  const lastMonth = thisMonth - 1;
  const blank = () => Object.fromEntries(Object.keys(GAME_TYPES).map((k) => [k, 0]));
  const rows = Object.fromEntries(
    roster.map((id) => [id, { id, month: blank(), monthTotal: 0, allTime: 0, lastMonth: 0 }])
  );

  for (const g of games ?? []) {
    if (g.status !== 'over' || !g.winner || !rows[g.winner] || !(g.type in GAME_TYPES)) continue;
    const row = rows[g.winner];
    row.allTime += 1;
    const ms = finishedAtMs(g);
    if (ms == null) continue;
    const key = monthKey(new Date(ms));
    if (key === thisMonth) {
      row.month[g.type] += 1;
      row.monthTotal += 1;
    } else if (key === lastMonth) {
      row.lastMonth += 1;
    }
  }

  const standings = roster
    .map((id) => rows[id])
    .sort((a, b) => b.monthTotal - a.monthTotal || b.allTime - a.allTime || roster.indexOf(a.id) - roster.indexOf(b.id));

  // A tie for the month is shared — everyone on the top score wears the crown.
  const best = Math.max(0, ...standings.map((r) => r.lastMonth));
  const champion = best > 0
    ? {
        month: MONTHS[((lastMonth % 12) + 12) % 12],
        wins: best,
        ids: roster.filter((id) => rows[id].lastMonth === best),
      }
    : null;

  return { monthLabel: MONTHS[now.getMonth()], standings, champion };
}
