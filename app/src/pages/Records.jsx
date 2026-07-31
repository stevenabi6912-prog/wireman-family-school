import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { watchAllGrades, watchStudents } from './recordsData';
import { gradePct, computeAverages, gradesToCSV } from '../lib/grades';
import './Records.css';

const STUDENT_ORDER = ['luke', 'layla', 'logan', 'lazarus'];
const SUBJECTS = ['bible', 'math', 'ela', 'history', 'science', 'writing'];
const SUBJECT_NAMES = {
  bible: 'Bible', math: 'Math', ela: 'Grammar & Writing',
  history: 'History', science: 'Science', writing: 'Writing',
};

export default function Records() {
  const [grades, setGrades] = useState([]);
  const [students, setStudents] = useState({});
  const [assignmentTitles, setAssignmentTitles] = useState({});
  const [subjectFilter, setSubjectFilter] = useState('all');

  useEffect(() => {
    const unsubG = watchAllGrades(setGrades);
    const unsubS = watchStudents(setStudents);
    // Titles for graded assignments — cover ALL assignments (demo/placement
    // items have no dayIndex but still get graded)
    const unsubT = onSnapshot(collection(db, 'assignments'), (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data().title;
      });
      setAssignmentTitles(map);
    });
    return () => {
      unsubG();
      unsubS();
      unsubT();
    };
  }, []);

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
    </div>
  );
}
