import { useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { resolveTheme } from '../config/themes';
import './AbiExtras.css';

const KIDS = ['luke', 'layla', 'logan', 'lazarus'];
const DONE = new Set(['submitted', 'graded', 'waived']);

// ---- Search everything: assignments and grades, one box ----
export function SearchBox({ students, grades }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return;
    setBusy(true);
    try {
      const snap = await getDocs(collection(db, 'assignments'));
      const scoreByAssignment = {};
      for (const g of grades ?? []) scoreByAssignment[g.assignmentId] = g;
      const hits = [];
      snap.forEach((d) => {
        const a = d.data();
        if (`${a.title} ${a.instructions ?? ''}`.toLowerCase().includes(needle)) {
          hits.push({ id: d.id, ...a, grade: scoreByAssignment[d.id] });
        }
      });
      hits.sort((x, y) => (x.scheduledDate < y.scheduledDate ? -1 : 1));
      setResults(hits.slice(0, 25));
    } catch {
      setResults([]);
    }
    setBusy(false);
  }

  return (
    <section className="search-card">
      <div className="search-row">
        <input
          placeholder="🔎 Find anything — “fractions”, “Ch. 12”, “screener”…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <button onClick={run} disabled={busy}>{busy ? '…' : 'Search'}</button>
      </div>
      {results !== null && (
        results.length === 0 ? <p className="search-empty">No matches.</p> : (
          <ul className="search-results">
            {results.map((a) => (
              <li key={a.id}>
                <span>{resolveTheme(a.studentId, students?.[a.studentId]?.theme).avatar}</span>
                <span className="search-title">{a.title}</span>
                <span className="search-meta">
                  {a.scheduledDate} · {DONE.has(a.status) ? '✅' : a.status}
                  {a.grade && ` · ${a.grade.overriddenScore ?? a.grade.score}/${a.grade.maxScore}`}
                </span>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}

// ---- Quarterly report cards: real data + Abi's comments, printable ----
const TERMS = [
  { id: 'q1', label: 'Quarter 1', start: '2026-08-11', end: '2026-10-22' },
  { id: 'q2', label: 'Quarter 2', start: '2026-10-23', end: '2027-01-21' },
  { id: 'q3', label: 'Quarter 3', start: '2027-01-22', end: '2027-04-01' },
  { id: 'q4', label: 'Quarter 4', start: '2027-04-02', end: '2027-06-03' },
];

export function ReportCards({ students, grades, allAssignments, subjectNames }) {
  const [term, setTerm] = useState(TERMS[0]);
  const [comments, setComments] = useState({});
  const [loadedTerm, setLoadedTerm] = useState(null);

  // Pull saved comments the first time a term is shown
  useMemo(() => {
    if (loadedTerm === term.id) return;
    setLoadedTerm(term.id);
    (async () => {
      const next = {};
      for (const kid of KIDS) {
        try {
          const snap = await getDoc(doc(db, 'reportCards', `${kid}-${term.id}`));
          next[kid] = snap.data()?.comments ?? '';
        } catch { next[kid] = ''; }
      }
      setComments(next);
    })();
  }, [term, loadedTerm]);

  const byKid = useMemo(() => {
    const out = {};
    for (const kid of KIDS) {
      const inTerm = (allAssignments ?? []).filter(
        (a) => a.studentId === kid && a.scheduledDate >= term.start && a.scheduledDate <= term.end && DONE.has(a.status)
      );
      const days = new Set(inTerm.map((a) => a.scheduledDate));
      const minutes = inTerm.reduce((s, a) => s + (a.actualMinutes ?? a.estimatedMinutes ?? 0), 0);
      const gradeRows = {};
      for (const g of grades ?? []) {
        if (g.studentId !== kid) continue;
        const when = g.gradedAt?.toDate?.();
        if (!when) continue;
        const iso = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
        if (iso < term.start || iso > term.end) continue;
        const row = (gradeRows[g.subjectId] ??= { sum: 0, n: 0 });
        row.sum += (g.overriddenScore ?? g.score) / g.maxScore;
        row.n++;
      }
      out[kid] = { days: days.size, hours: (minutes / 60).toFixed(1), done: inTerm.length, gradeRows };
    }
    return out;
  }, [allAssignments, grades, term]);

  async function saveComment(kid) {
    await setDoc(doc(db, 'reportCards', `${kid}-${term.id}`), {
      studentId: kid,
      term: term.id,
      comments: comments[kid] ?? '',
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  return (
    <section className="reportcards-section">
      <h2 className="no-print">
        Report cards
        <select className="term-select" value={term.id} onChange={(e) => setTerm(TERMS.find((t) => t.id === e.target.value))}>
          {TERMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button className="records-csv" onClick={() => window.print()}>🖨 Print</button>
      </h2>
      {KIDS.map((kid) => {
        const k = byKid[kid];
        return (
          <div key={kid} className="reportcard">
            <h3>{students?.[kid]?.name ?? kid} — {term.label}, 2026–27 · Wireman Family School</h3>
            <p className="reportcard-stats">
              Days attended: <strong>{k.days}</strong> · Hours: <strong>{k.hours}</strong> · Items completed: <strong>{k.done}</strong>
            </p>
            {Object.keys(k.gradeRows).length > 0 && (
              <table className="records-table reportcard-grades">
                <thead><tr><th>Subject</th><th>Average</th><th>Graded items</th></tr></thead>
                <tbody>
                  {Object.entries(k.gradeRows).map(([subj, row]) => (
                    <tr key={subj}>
                      <td>{subjectNames[subj] ?? subj}</td>
                      <td>{Math.round((row.sum / row.n) * 100)}%</td>
                      <td>{row.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <textarea
              className="reportcard-comments"
              rows={3}
              placeholder="Teacher comments…"
              value={comments[kid] ?? ''}
              onChange={(e) => setComments((c) => ({ ...c, [kid]: e.target.value }))}
              onBlur={() => saveComment(kid)}
            />
          </div>
        );
      })}
    </section>
  );
}

// ---- Formal attendance letter, ready to sign ----
export function AffidavitButton({ students, hoursLog }) {
  function open() {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const rows = KIDS.filter((k) => hoursLog[k]).map((k) =>
      `<tr><td>${students?.[k]?.name ?? k}</td><td>Grade ${students?.[k]?.grade ?? ''}</td><td>${hoursLog[k].days.size}</td><td>${(hoursLog[k].minutes / 60).toFixed(1)}</td></tr>`
    ).join('');
    const w = window.open('', '_blank');
    w.document.write(`<!doctype html><html><head><title>Attendance Statement</title>
      <style>body{font-family:Georgia,serif;max-width:640px;margin:60px auto;line-height:1.6}
      table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #999;padding:8px;text-align:left}
      .sig{margin-top:70px;display:flex;justify-content:space-between}.sig span{border-top:1px solid #333;padding-top:6px;width:40%}</style>
      </head><body>
      <h2>Statement of Attendance — Wireman Family School</h2>
      <p>${today}</p>
      <p>This statement certifies that the following students received home instruction
      during the 2026–27 academic year, with attendance and instructional hours recorded as follows:</p>
      <table><tr><th>Student</th><th>Grade</th><th>Days attended</th><th>Instructional hours</th></tr>${rows}</table>
      <p>Instruction included Bible, mathematics, English grammar and composition, history,
      science, and Spanish, following the Hillsdale Classical (Offsite) course of study.</p>
      <div class="sig"><span>Parent / Teacher signature</span><span>Date</span></div>
      <script>window.print()</` + `script></body></html>`);
    w.document.close();
  }

  return (
    <button className="records-csv no-print" onClick={open} style={{ marginLeft: 12 }}>
      📜 Attendance letter
    </button>
  );
}
