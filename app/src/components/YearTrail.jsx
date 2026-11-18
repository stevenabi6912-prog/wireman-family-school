import { useMemo } from 'react';
import { buildCalendar } from '../lib/calendar';
import './YearTrail.css';

const DONE = new Set(['submitted', 'graded', 'waived']);
const YEAR_DAYS = 150;

// The kid's year as a winding trail: one dot per school day, green when that
// day's work is all finished, their avatar standing on the first unfinished
// day with their study buddy tagging along. Month flags along the way.
//
// Fed by the page's one live "year so far" listener (docs dated today or
// earlier) plus the family calendar for the days still ahead — so it walks
// forward in real time without holding its own listener on the whole year.
export default function YearTrail({ docs, family, avatar, buddy }) {
  const { dots, currentIdx, doneDays } = useMemo(() => {
    if (!docs || !family?.schoolYearStart) return { dots: [], currentIdx: 0, doneDays: 0 };
    const today = new Date().toLocaleDateString('sv-SE');
    const calendar = buildCalendar(family, YEAR_DAYS).slice(0, YEAR_DAYS);
    const byDay = {};
    for (const a of docs) {
      if (!a.dayIndex) continue;
      const e = (byDay[a.dayIndex] ??= { total: 0, done: 0 });
      e.total++;
      if (DONE.has(a.status)) e.done++;
    }
    const dots = calendar.map((date, i) => {
      const e = byDay[i + 1] ?? { total: 0, done: 0 };
      // A past day with nothing left on it (everything was moved elsewhere)
      // counts as walked; a day still ahead needs real finished work.
      const complete = date < today ? e.done === e.total : e.total > 0 && e.done === e.total;
      return { dayIndex: i + 1, date, complete };
    });
    let current = dots.findIndex((d) => !d.complete);
    if (current === -1) current = dots.length - 1;
    return { dots, currentIdx: current, doneDays: dots.filter((d) => d.complete).length };
  }, [docs, family]);

  if (dots.length === 0) return null;

  const monthName = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' });
  const today = new Date().toLocaleDateString('sv-SE');
  const preSeason = dots[0].date > today;

  return (
    <div className="trail-box">
      <h3 className="trail-title">
        {preSeason
          ? `🗺️ My year trail — the adventure starts ${new Date(dots[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}!`
          : `🗺️ My year trail — ${doneDays} of ${dots.length} days done`}
      </h3>
      {buddy && !preSeason && (
        <p className="trail-buddy-line">
          {buddy.emoji} Your {buddy.name.toLowerCase()} is walking the trail with you
          {buddy.next ? ` — it grows into ${buddy.next.emoji} at ${buddy.next.at} items (${Math.max(0, buddy.next.at - buddy.totalDone)} to go).` : ' — fully grown!'}
        </p>
      )}
      <div className="trail-scroll">
        <div className="trail-row">
          {dots.map((d, i) => {
            const newMonth = i === 0 || monthName(d.date) !== monthName(dots[i - 1].date);
            return (
              <div key={d.dayIndex} className="trail-step">
                {newMonth && <span className="trail-month">{monthName(d.date)}</span>}
                <span
                  className={`trail-dot ${d.complete ? 'trail-done' : ''} ${i === currentIdx ? 'trail-here' : ''}`}
                  title={d.date}
                >
                  {i === currentIdx ? avatar : d.complete ? '✓' : ''}
                  {i === currentIdx && buddy && <span className="trail-buddy" aria-hidden="true">{buddy.emoji}</span>}
                </span>
              </div>
            );
          })}
          <span className="trail-finish">🏁</span>
        </div>
      </div>
    </div>
  );
}
