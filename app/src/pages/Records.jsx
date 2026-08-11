import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { watchAllGrades, watchStudents } from './recordsData';
import { gradePct, computeAverages, gradesToCSV } from '../lib/grades';
import './Records.css';

const STUDENT_ORDER = ['luke', 'layla', 'logan', 'lazarus'];
const SUBJECTS = ['bible', 'math', 'ela', 'history', 'science', 'writing', 'spanish'];
const SUBJECT_NAMES = {
  bible: 'Bible', math: 'Math', ela: 'Grammar & Writing',
  history: 'History', science: 'Science', writing: 'Writing', spanish: 'Spanish',
  custom: 'From Mom',
};

export default function Records() {
  const [grades, setGrades] = useState([]);
  const [students, setStudents] = useState({});
  const [allAssignments, setAllAssignments] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState('all');

  useEffect(() => {
    const unsubG = watchAllGrades(setGrades);
    const unsubS = watchStudents(setStudents);
    // Full assignment docs: titles for the gradebook plus the raw material
    // for the attendance & hours log below.
    const unsubT = onSnapshot(collection(db, 'assignments'), (snap) => {
      setAllAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubG();
      unsubS();
      unsubT();
    };
  }, []);

  const assignmentTitles = useMemo(() => {
    const map = {};
    for (const a of allAssignments) map[a.id] = a.title;
    return map;
  }, [allAssignments]);

  // Attendance & hours, derived from completed work: a day "attended" is any
  // date with at least one finished item; hours favor the kid's real tracked
  // minutes and fall back to the estimate.
  const hoursLog = useMemo(() => {
    const DONE = new Set(['submitted', 'graded', 'waived']);
    const perKid = {};
    for (const a of allAssignments) {
      if (!DONE.has(a.status)) continue;
      const k = (perKid[a.studentId] ??= { days: new Set(), minutes: 0, bySubject: {} });
      k.days.add(a.scheduledDate);
      const mins = a.actualMinutes ?? a.estimatedMinutes ?? 0;
      k.minutes += mins;
      k.bySubject[a.subjectId] = (k.bySubject[a.subjectId] ?? 0) + mins;
    }
    return perKid;
  }, [allAssignments]);

  function downloadHoursCSV() {
    const rows = [['student', 'days attended', 'total hours', 'subject', 'subject hours']];
    for (const [kid, k] of Object.entries(hoursLog)) {
      const name = students[kid]?.name ?? kid;
      for (const [subj, mins] of Object.entries(k.bySubject)) {
        rows.push([name, k.days.size, (k.minutes / 60).toFixed(1), SUBJECT_NAMES[subj] ?? subj, (mins / 60).toFixed(1)]);
      }
    }
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wireman-attendance-hours-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const averages = useMemo(() => computeAverages(grades), [grades]);
  const filtered = useMemo(
    () => grades
      .filter((g) => subjectFilter === 'all' || g.subjectId === subjectFilter)
      .sort((a, b) => (b.gradedAt?.seconds ?? 0) - (a.gradedAt?.seconds ?? 0)),
    [grades, subjectFilter]
  );

  function downloadCSV() {
    const blob = new Blob([gradesToCSV(grades, assignmentTitles)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wireman-gradebook-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="records-screen">
      <header className="records-header no-print">
        <Link to="/dashboard" className="records-back">&larr; Dashboard</Link>
        <h1>Gradebook & Records</h1>
        <div className="records-actions">
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="all">All subjects</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{SUBJECT_NAMES[s]}</option>)}
          </select>
          <button onClick={downloadCSV}>Export CSV</button>
          <button onClick={() => window.print()}>🖨️ Print</button>
        </div>
      </header>

      <h1 className="print-only print-title">Wireman Family School — Records ({new Date().toLocaleDateString()})</h1>

      {STUDENT_ORDER.map((id) => {
        const list = filtered.filter((g) => g.studentId === id);
        const avgRow = averages[id] ?? {};
        return (
          <section key={id} className="records-student">
            <h2>{students[id]?.name ?? id} — Grade {students[id]?.grade ?? ''}</h2>
            <p className="records-averages">
              {SUBJECTS.filter((s) => avgRow[s] && (subjectFilter === 'all' || s === subjectFilter)).map((s) => (
                <span key={s} className="avg-chip">
                  {SUBJECT_NAMES[s]}: <strong>{avgRow[s].avg}%</strong> ({avgRow[s].count})
                </span>
              ))}
              {list.length === 0 && <span className="records-none">Nothing here yet.</span>}
            </p>
            {list.length > 0 && (
              <table className="records-table">
                <thead>
                  <tr><th>Date</th><th>Subject</th><th>Assignment</th><th>Score</th><th>%</th></tr>
                </thead>
                <tbody>
                  {list.map((g) => {
                    const pct = gradePct(g);
                    return (
                      <tr key={g.id}>
                        <td>{g.gradedAt?.toDate?.()?.toLocaleDateString?.() ?? ''}</td>
                        <td>{SUBJECT_NAMES[g.subjectId] ?? g.subjectId}</td>
                        <td>{assignmentTitles[g.assignmentId] ?? g.assignmentId}</td>
                        <td>
                          {(g.overriddenScore ?? g.score) == null
                            ? 'review'
                            : `${g.overriddenScore ?? g.score}/${g.maxScore}${g.overriddenScore != null ? ' *' : ''}`}
                        </td>
                        <td>{pct == null ? '—' : `${pct}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
      <p className="records-footnote">* score set by parent</p>

      <section className="hours-section">
        <h2>
          Attendance & hours
          <button className="records-csv no-print" onClick={downloadHoursCSV} style={{ marginLeft: 12 }}>
            ⬇ CSV
          </button>
        </h2>
        {Object.keys(hoursLog).length === 0 ? (
          <p className="records-none">Fills in automatically as work gets finished.</p>
        ) : (
          <table className="records-table">
            <thead>
              <tr><th>Student</th><th>Days attended</th><th>Total hours</th><th>Top subjects</th></tr>
            </thead>
            <tbody>
              {['luke', 'layla', 'logan', 'lazarus'].filter((k) => hoursLog[k]).map((kid) => {
                const k = hoursLog[kid];
                const top = Object.entries(k.bySubject)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([s, m]) => `${SUBJECT_NAMES[s] ?? s} ${(m / 60).toFixed(1)}h`)
                  .join(' · ');
                return (
                  <tr key={kid}>
                    <td>{students[kid]?.name ?? kid}</td>
                    <td>{k.days.size}</td>
                    <td>{(k.minutes / 60).toFixed(1)}</td>
                    <td>{top}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="transcript-section">
        <h2>8th Grade Transcript — 2026–27</h2>
        <p className="records-none no-print">Course grades fill in as the year's work is graded. Print this page for the official copy.</p>
        {['luke', 'layla'].map((id) => (
          <div key={id} className="records-student transcript-card">
            <h3>{students[id]?.name ?? id} — Grade 8, Hillsdale Classical (Offsite)</h3>
            <table className="records-table">
              <thead>
                <tr><th>Course</th><th>Curriculum</th><th>Grade</th></tr>
              </thead>
              <tbody>
                {[
                  ['Algebra 1', 'Math-U-See Algebra 1', 'math'],
                  ['English 8 — Grammar & Composition', 'Fix It! Grammar L5 · IEW U.S. History-Based Writing', 'ela'],
                  ['English 8 — Composition', 'IEW U.S. History-Based Writing', 'writing'],
                  ['Medieval History', 'Story of the World Vol. 2', 'history'],
                  ['Earth Science', 'Elemental Science (Logic Stage)', 'science'],
                  ['Bible', 'The Names of God (family study)', 'bible'],
                  ['Spanish 1', 'Flip Flop Spanish — Sí Sí Level 1', 'spanish'],
                ].map(([course, curric, subj]) => (
                  <tr key={course}>
                    <td>{course}</td>
                    <td>{curric}</td>
                    <td>{averages[id]?.[subj] ? `${averages[id][subj].avg}%` : 'in progress'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </div>
  );
}
