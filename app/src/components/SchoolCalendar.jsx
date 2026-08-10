import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { buildCalendar } from '../lib/calendar';
import './SchoolCalendar.css';

// Family calendar everyone can open: which days are school, which are
// breaks/vacations, and when the year starts and ends. Reads the same
// family doc the scheduler uses, so it always matches the real plan.
export default function SchoolCalendar({ onClose }) {
  const [family, setFamily] = useState(null);
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });

  useEffect(() => onSnapshot(doc(db, 'families', 'wireman'), (s) => setFamily(s.data())), []);

  const grid = useMemo(() => {
    if (!family) return null;
    const { schoolYearStart, schoolYearEnd, schoolDays, holidays = [], blockouts = [], extraDays = [] } = family;
    // The rocket goes on the first REAL school day (an early make-up day can
    // beat the official start date — like Abi's Aug 11 early start).
    const firstSchoolDay = buildCalendar(family, 1)[0] ?? schoolYearStart;
    const first = new Date(view.y, view.m, 1);
    const startPad = first.getDay(); // Sunday-first grid
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(view.y, view.m, d);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isoWeekday = ((date.getDay() + 6) % 7) + 1;
      const holiday = holidays.find((h) => iso >= h.start && iso <= h.end);
      const blockout = blockouts.find((b) => iso >= b.start && iso <= b.end);
      const inYear = iso >= schoolYearStart && iso <= schoolYearEnd;
      const isMakeup = extraDays.includes(iso); // make-up beats holidays
      const isSchool = isMakeup || (inYear && schoolDays.includes(isoWeekday) && !holiday && !blockout);
      cells.push({
        d, iso,
        school: isSchool,
        makeup: isMakeup,
        label: isMakeup ? null : holiday?.label ?? blockout?.label ?? null,
        off: !isMakeup && !!(holiday || blockout) && schoolDays.includes(isoWeekday) && inYear,
        first: iso === firstSchoolDay,
        last: iso === schoolYearEnd,
        today: iso === new Date().toLocaleDateString('sv-SE'),
      });
    }
    return cells;
  }, [family, view]);

  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const move = (delta) => setView(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <div className="cal-overlay" onClick={onClose}>
      <div className="cal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cal-header">
          <button className="cal-nav" onClick={() => move(-1)}>‹</button>
          <h2>{monthLabel}</h2>
          <button className="cal-nav" onClick={() => move(1)}>›</button>
          <button className="cal-close" onClick={onClose}>✕</button>
        </div>
        {!grid ? <p>Loading…</p> : (
          <>
            <div className="cal-grid cal-dow">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="cal-grid">
              {grid.map((c, i) => c === null ? <span key={i} /> : (
                <div
                  key={i}
                  className={`cal-day ${c.school ? 'cal-school' : ''} ${c.off ? 'cal-off' : ''} ${c.today ? 'cal-today' : ''}`}
                  title={c.label ?? (c.school ? 'School day' : '')}
                >
                  <span className="cal-num">{c.d}</span>
                  {c.makeup && <span className="cal-flag">⭐</span>}
                  {c.first && <span className="cal-flag">🚀</span>}
                  {c.last && <span className="cal-flag">🏁</span>}
                  {c.off && <span className="cal-offlabel">{c.label}</span>}
                </div>
              ))}
            </div>
            <div className="cal-legend">
              <span><i className="cal-dot cal-dot-school" /> School day</span>
              <span><i className="cal-dot cal-dot-off" /> Break / day off</span>
              <span>⭐ Make-up day</span>
              <span>🚀 First day</span>
              <span>🏁 Last day</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
