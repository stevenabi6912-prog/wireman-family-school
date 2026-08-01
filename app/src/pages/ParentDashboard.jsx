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
import { Link } from 'react-router-dom';
import { todayISO } from '../lib/assignments';
import { resolveTheme } from '../config/themes';
import { projectYear } from '../lib/reflow';
import { watchAllGrades } from '../lib/grades';
import { computeStruggleFlags } from '../lib/struggles';
import DaysOff from '../components/DaysOff';
import ReviewCard from '../components/ReviewCard';
import MemoryWork from '../components/MemoryWork';
import SchoolCalendar from '../components/SchoolCalendar';
import BugReport from '../components/BugReport';
import AbiTheme from '../components/AbiTheme';
import { PALETTES } from '../config/themes';
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
  const [year, setYear] = useState(null); // { family, projectedEnd, targetEnd }
  const today = todayISO();

  const [grades, setGrades] = useState([]);
  const [calOpen, setCalOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  useEffect(() => {
    const unsubA = watchAssignmentsThroughToday(setAssignments);
    const unsubS = watchStudents(setStudents);
    const unsubG = watchAllGrades(setGrades);
    projectYear().then(setYear).catch(() => {});
    return () => {
      unsubA();
      unsubS();
      unsubG();
    };
  }, []);

  function refreshYear() {
    projectYear().then(setYear).catch(() => {});
  }

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

  const struggleFlags = useMemo(
    () => computeStruggleFlags({ grades, assignments: assignments ?? [] }),
    [grades, assignments]
  );
  const reviewQueue = useMemo(
    () => grades.filter((g) => g.needsManualReview).sort((a, b) => (b.gradedAt?.seconds ?? 0) - (a.gradedAt?.seconds ?? 0)),
    [grades]
  );

  if (!students || !assignments) {
    return <div className="loading-screen">Loading the family…</div>;
  }

  const abiTheme = year?.family?.parentTheme ?? { palette: 'bubblegum', avatar: '☀️' };
  const abiColors = PALETTES[abiTheme.palette] ?? PALETTES.bubblegum;

  return (
    <div className="dash-screen" style={{ '--a-bg': abiColors.bg, '--a-accent': abiColors.accent, background: abiColors.bg }}>
      <header className="dash-header">
        <div>
          <h1>{greeting()}, Abi {abiTheme.avatar}</h1>
          <p className="dash-date">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="dash-header-right">
          <button className="dash-logout" onClick={() => setThemeOpen(true)}>✨</button>
          <BugReport studentId={null} large={false} />
          <button className="dash-logout" onClick={() => setCalOpen(true)}>📅 Calendar</button>
          {year?.projectedEnd && (
            <span className={`year-chip ${year.projectedEnd > year.targetEnd ? 'year-chip-behind' : ''}`}>
              Last day: <strong>{year.projectedEnd}</strong>
              {year.projectedEnd > year.targetEnd ? ' (past June 3 goal)' : ' ✓ on track'}
            </span>
          )}
          <button className="dash-logout" onClick={logout}>Switch person</button>
        </div>
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

      <section className="struggle-section">
        <h2>Worth a look</h2>
        {Object.keys(struggleFlags).length === 0 ? (
          <p className="struggle-empty">No struggle patterns detected right now.</p>
        ) : (
          STUDENT_ORDER.filter((id) => struggleFlags[id]?.length).map((id) => (
            <div key={id} className="struggle-card">
              <h3>{resolveTheme(id, students[id]?.theme).avatar} {students[id]?.name}</h3>
              <ul>
                {struggleFlags[id].map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section className="review-section">
        <h2>Needs your eyes {reviewQueue.length > 0 && <span className="review-count">{reviewQueue.length}</span>}</h2>
        {reviewQueue.length === 0 ? (
          <p className="struggle-empty">Nothing waiting on you. ✅</p>
        ) : (
          <ul className="review-list">
            {reviewQueue.map((g) => (
              <ReviewCard key={g.id} grade={g} studentName={students[g.studentId]?.name ?? g.studentId} />
            ))}
          </ul>
        )}
      </section>

      <MemoryWork students={students} order={STUDENT_ORDER} />

      {year?.family && <DaysOff family={year.family} onChanged={refreshYear} />}

      {calOpen && <SchoolCalendar onClose={() => setCalOpen(false)} />}
      {themeOpen && (
        <AbiTheme current={abiTheme} onClose={() => { setThemeOpen(false); refreshYear(); }} />
      )}

      <p className="records-link-row">
        <Link to="/records" className="records-link">📄 Gradebook & printable records</Link>
      </p>
    </div>
  );
}

