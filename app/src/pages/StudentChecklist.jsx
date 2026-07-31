import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { watchDayAssignments, todayISO } from '../lib/assignments';
import AssignmentCard from '../components/AssignmentCard';
import './StudentChecklist.css';

const DONE_STATUSES = new Set(['submitted', 'graded', 'waived']);

export default function StudentChecklist() {
  const { studentId, logout } = useAuth();
  const [student, setStudent] = useState(null);
  const [assignments, setAssignments] = useState(null); // null = loading
  const date = todayISO();

  useEffect(() => {
    if (!studentId) return;
    getDoc(doc(db, 'students', studentId)).then((snap) => {
      if (snap.exists()) setStudent(snap.data());
    });
    return watchDayAssignments(studentId, date, setAssignments);
  }, [studentId, date]);

  const { doneCount, activeIndex } = useMemo(() => {
    if (!assignments) return { doneCount: 0, activeIndex: -1 };
    let done = 0;
    let active = -1;
    for (let i = 0; i < assignments.length; i++) {
      if (DONE_STATUSES.has(assignments[i].status)) {
        done++;
      } else if (active === -1) {
        active = i; // first not-done item is the only unlocked one
      }
    }
    return { doneCount: done, activeIndex: active };
  }, [assignments]);

  // Lazarus (3rd grade) gets larger type and fewer words; scale by grade.
  const large = (student?.grade ?? 8) <= 3;
  const firstName = student?.name ?? '';
  const allDone = assignments && assignments.length > 0 && activeIndex === -1;

  if (!assignments) {
    return <div className="loading-screen">Getting your list ready…</div>;
  }

  return (
    <div className={`checklist-screen ${large ? 'checklist-large' : ''}`}>
      <header className="checklist-header">
        <h1>{large ? `Hi ${firstName}!` : `${firstName} — today's work`}</h1>
        <button className="logout-btn" onClick={logout}>Switch person</button>
      </header>

      {assignments.length === 0 ? (
        <div className="empty-day">
          <p>🎉 No school work scheduled today!</p>
        </div>
      ) : (
        <>
          <div className="progress-track" role="progressbar" aria-valuenow={doneCount} aria-valuemax={assignments.length}>
            <div
              className="progress-fill"
              style={{ width: `${(doneCount / assignments.length) * 100}%` }}
            />
            <span className="progress-label">
              {doneCount} of {assignments.length} done
            </span>
          </div>

          {allDone ? (
            <div className="day-complete">
              <div className="day-complete-emoji">🌟</div>
              <h2>{large ? 'All done! Great job!' : `That's everything — great work today, ${firstName}!`}</h2>
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
    </div>
  );
}
