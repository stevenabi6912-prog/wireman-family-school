import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  watchAssignmentsThroughToday,
  watchStudents,
  waiveAssignment,
  rescheduleAssignment,
  tomorrowISO,
  daysOverdue,
  DONE_STATUSES,
} from '../lib/parentData';
import { todayISO } from '../lib/assignments';
import { resolveTheme } from '../config/themes';
import './ParentDashboard.css';

const STUDENT_ORDER = ['luke', 'layla', 'logan', 'lazarus'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function ParentDashboard() {
  const { logout } = useAuth();
  const [students, setStudents] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const today = todayISO();

  useEffect(() => {
    const unsubA = watchAssignmentsThroughToday(setAssignments);
    const unsubS = watchStudents(setStudents);
    return () => {
      unsubA();
      unsubS();
    };
  }, []);

  const byStudent = useMemo(() => {
    const map = {};
    STUDENT_ORDER.forEach((id) => {
      map[id] = { today: [], overdue: [] };
    });
    (assignments ?? []).forEach((a) => {
      const bucket = map[a.studentId];
      if (!bucket) return;
      if (a.scheduledDate === today) bucket.today.push(a);
      else if (!DONE_STATUSES.has(a.status)) bucket.overdue.push(a);
    });
    Object.values(map).forEach((b) => b.today.sort((x, y) => x.sequence - y.sequence));
    return map;
  }, [assignments, today]);

  const allMissing = useMemo(
    () =>
      STUDENT_ORDER.flatMap((id) => byStudent[id]?.overdue ?? []).sort(
        (a, b) => a.scheduledDate.localeCompare(b.scheduledDate)
      ),
    [byStudent]
  );

  if (!students || !assignments) {
    return <div className="loading-screen">Loading the family…</div>;
  }

  return (
    <div className="dash-screen">
      <header className="dash-header">
        <div>
          <h1>{greeting()}, Abi ☀️</h1>
          <p className="dash-date">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <button className="dash-logout" onClick={logout}>Switch person</button>
      </header>

      <section className="student-grid">
        {STUDENT_ORDER.map((id) => {
          const s = students[id];
          if (!s) return null;
          const theme = resolveTheme(id, s.theme);
          const dayList = byStudent[id].today;
          const done = dayList.filter((a) => DONE_STATUSES.has(a.status)).length;
          const current = dayList.find((a) => !DONE_STATUSES.has(a.status));
          const overdueCount = byStudent[id].overdue.length;
          const pct = dayList.length ? Math.round((done / dayList.length) * 100) : 0;
          const complete = dayList.length > 0 && done === dayList.length;

          return (
            <div key={id} className="student-card" style={{ '--s-header': theme.colors.header, '--s-accent': theme.colors.accent }}>
              <div className="student-card-top">
                <span className="student-card-avatar">{theme.avatar}</span>
                <div>
                  <h2>{s.name}</h2>
                  <span className="student-card-grade">Grade {s.grade}</span>
                </div>
                {overdueCount > 0 && (
                  <span className="overdue-chip">{overdueCount} overdue</span>
                )}
                {complete && <span className="done-chip">Day done 🎉</span>}
              </div>

              {dayList.length === 0 ? (
                <p className="student-card-empty">Nothing scheduled today</p>
              ) : (
                <>
                  <div className="mini-progress">
                    <div className="mini-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="student-card-status">
                    {complete
                      ? `All ${dayList.length} items finished`
                      : current
                        ? <>Now: <strong>{current.title}</strong> ({done}/{dayList.length} done)</>
                        : `${done}/${dayList.length} done`}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </section>

      <section className="missing-section">
        <h2>Missing work</h2>
        {allMissing.length === 0 ? (
          <p className="missing-empty">✅ Nobody has missing work. All caught up!</p>
        ) : (
          <ul className="missing-list">
            {allMissing.map((a) => {
              const s = students[a.studentId];
              const days = daysOverdue(a.scheduledDate);
              return (
                <li key={a.id} className="missing-row">
                  <span className="missing-who">{resolveTheme(a.studentId, s?.theme).avatar} {s?.name}</span>
                  <span className="missing-what">{a.title}</span>
                  <span className={`missing-age ${days > 3 ? 'missing-age-bad' : ''}`}>
                    {days === 1 ? '1 day' : `${days} days`} late
                  </span>
                  <span className="missing-actions">
                    <button onClick={() => rescheduleAssignment(a.id, today)}>Do today</button>
                    <button onClick={() => rescheduleAssignment(a.id, tomorrowISO())}>Tomorrow</button>
                    <button className="waive-btn" onClick={() => waiveAssignment(a.id)}>Waive</button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
