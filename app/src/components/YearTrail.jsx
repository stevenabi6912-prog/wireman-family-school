import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import './YearTrail.css';

const DONE = new Set(['submitted', 'graded', 'waived']);

// The kid's year as a winding trail: one dot per school day, green when that
// day's work is all finished, their avatar standing on the first unfinished
// day. Month flags along the way. Motivation without points or streaks.
export default function YearTrail({ studentId, avatar }) {
  const [days, setDays] = useState(null); // [{dayIndex, date, done}]

  useEffect(() => {
    if (!studentId) return;
    getDocs(query(collection(db, 'assignments'), where('studentId', '==', studentId))).then((snap) => {
      const byDay = {};
      snap.docs.forEach((d) => {
        const a = d.data();
        if (!a.dayIndex) return;
        const e = (byDay[a.dayIndex] = byDay[a.dayIndex] ?? { dayIndex: a.dayIndex, date: a.scheduledDate, total: 0, done: 0 });
        e.total++;
        if (DONE.has(a.status)) e.done++;
      });
      setDays(Object.values(byDay).sort((a, b) => a.dayIndex - b.dayIndex));
    });
  }, [studentId]);

  const { dots, currentIdx, doneDays } = useMemo(() => {
    if (!days) return { dots: [], currentIdx: 0, doneDays: 0 };
    const dots = days.map((d) => ({ ...d, complete: d.total > 0 && d.done === d.total }));
    let current = dots.findIndex((d) => !d.complete);
    if (current === -1) current = dots.length - 1;
    return { dots, currentIdx: current, doneDays: dots.filter((d) => d.complete).length };
  }, [days]);

  if (!days || dots.length === 0) return null;

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
