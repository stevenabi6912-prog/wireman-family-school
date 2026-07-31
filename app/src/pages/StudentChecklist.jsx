import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { watchDayAssignments, todayISO } from '../lib/assignments';
import { resolveTheme } from '../config/themes';
import AssignmentCard from '../components/AssignmentCard';
import ThemePicker from '../components/ThemePicker';
import './StudentChecklist.css';

const DONE_STATUSES = new Set(['submitted', 'graded', 'waived']);

const EMPTY_DAY_LINES = [
  'No school today — go build a fort!',
  'Nothing on the list. Free day!',
  'School\'s closed. Adventure time!',
];

export default function StudentChecklist() {
  const { studentId, logout } = useAuth();
  const [student, setStudent] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const date = todayISO();

  useEffect(() => {
    if (!studentId) return;
    const unsubStudent = onSnapshot(doc(db, 'students', studentId), (snap) => {
      if (snap.exists()) setStudent(snap.data());
    });
    const unsubDay = watchDayAssignments(studentId, date, setAssignments);
    return () => {
      unsubStudent();
      unsubDay();
    };
  }, [studentId, date]);

  const { doneCount, activeIndex } = useMemo(() => {
    if (!assignments) return { doneCount: 0, activeIndex: -1 };
    let done = 0;
    let active = -1;
    for (let i = 0; i < assignments.length; i++) {
      if (DONE_STATUSES.has(assignments[i].status)) done++;
      else if (active === -1) active = i;
    }
    return { doneCount: done, activeIndex: active };
  }, [assignments]);

  const theme = resolveTheme(studentId, student?.theme);
  const large = (student?.grade ?? 8) <= 3;
  const firstName = student?.name ?? '';
  const allDone = assignments && assignments.length > 0 && activeIndex === -1;
  // stable-per-day playful line (no Math.random so it doesn't flicker)
  const emptyLine = EMPTY_DAY_LINES[date.split('-').reduce((a, b) => a + Number(b), 0) % EMPTY_DAY_LINES.length];

  if (!assignments) {
    return <div className="loading-screen">Getting your list ready…</div>;
  }

  const styleVars = {
    '--t-bg': theme.colors.bg,
    '--t-card': theme.colors.card,
    '--t-accent': theme.colors.accent,
    '--t-accent-soft': theme.colors.accentSoft,
    '--t-header': theme.colors.header,
    '--t-text': theme.colors.darkBg ? '#f2f2f8' : '#2a2a2a',
  };

  return (
    <div className={`checklist-screen ${large ? 'checklist-large' : ''}`} style={styleVars}>
      <header className="hero-header">
        <div className="hero-left">
          <button className="hero-avatar" onClick={() => setPickerOpen(true)} title="Change your look">
            {theme.avatar}
          </button>
          <div>
            <h1>{large ? `Hi ${firstName}!` : `Let's go, ${firstName}!`}</h1>
            <p className="hero-date">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="hero-actions">
          <button className="mine-btn" onClick={() => setPickerOpen(true)}>✨ {large ? 'My look' : 'Make it mine'}</button>
          <button className="logout-btn" onClick={logout}>Switch</button>
        </div>
      </header>

      {assignments.length === 0 ? (
        <div className="empty-day">
          <div className="empty-day-emoji">{theme.avatar}</div>
          <h2>{emptyLine}</h2>
        </div>
      ) : (
        <>
          <div className="progress-track" role="progressbar" aria-valuenow={doneCount} aria-valuemax={assignments.length}>
            <div className="progress-fill" style={{ width: `${(doneCount / assignments.length) * 100}%` }} />
            <span className="progress-label">
              {doneCount} of {assignments.length} done {doneCount === assignments.length ? '🎉' : ''}
            </span>
          </div>

          {allDone ? (
            <div className="day-complete">
              <div className="day-complete-emoji">{theme.avatar}</div>
              <div className="day-complete-burst">🌟🎉🌟</div>
              <h2>{large ? 'ALL DONE! You rock!' : `That's everything — great work today, ${firstName}!`}</h2>
              <p>School's out. Go tell Mom!</p>
            </div>
          ) : (
            <div className="assignment-list">
              {assignments.map((a, i) => (
                <AssignmentCard
                  key={a.id}
                  assignment={a}
                  studentId={studentId}
                  large={large}
                  state={DONE_STATUSES.has(a.status) ? 'done' : i === activeIndex ? 'active' : 'locked'}
                />
              ))}
            </div>
          )}
        </>
      )}

      {pickerOpen && (
        <ThemePicker
          studentId={studentId}
          current={{ palette: theme.palette, avatar: theme.avatar }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
