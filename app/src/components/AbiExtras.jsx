import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { resolveTheme } from '../config/themes';
import { scoreLabel } from '../lib/grades';
import MoveToDate, { MoveAllToDate } from './MoveToDate';
import './AbiExtras.css';

const KIDS = ['luke', 'layla', 'logan', 'lazarus'];
const DONE = new Set(['submitted', 'graded', 'waived']);

// Titles abbreviate ("Ch. 8", "Vol. 2") but nobody types that way, so match on
// a normalized form: punctuation out, "chapter" and "ch" the same word.
function normalizeForSearch(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\bchapters?\b/g, 'ch')
    .replace(/\bvolumes?\b/g, 'vol')
    .replace(/\blessons?\b/g, 'lesson')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ---- Search everything: assignments and grades, one box ----
export function SearchBox({ students, grades }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    const needle = normalizeForSearch(q);
    if (needle.length < 2) return;
    setBusy(true);
    try {
      const snap = await getDocs(collection(db, 'assignments'));
      const scoreByAssignment = {};
      for (const g of grades ?? []) scoreByAssignment[g.assignmentId] = g;
      const hits = [];
      snap.forEach((d) => {
        const a = d.data();
        if (normalizeForSearch(`${a.title} ${a.instructions ?? ''}`).includes(needle)) {
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
          <>
            {/* A chapter's reading and test across both 8th graders is one
                search and one date, not four trips through the week view. */}
            <MoveAllToDate
              assignments={results.filter((a) => !DONE.has(a.status))}
              noun="unfinished items"
              onMoved={(dateISO) => setResults((rs) =>
                rs.map((r) => (DONE.has(r.status) ? r : { ...r, scheduledDate: dateISO })))}
            />
            <ul className="search-results">
              {results.map((a) => (
                <li key={a.id}>
                  <span>{resolveTheme(a.studentId, students?.[a.studentId]?.theme).avatar}</span>
                  <span className="search-title">{a.title}</span>
                  <span className="search-meta">
                    {a.scheduledDate} · {DONE.has(a.status) ? '✅' : a.status}
                    {a.grade && ` · ${scoreLabel(a.grade, { pending: 'needs your score' })}`}
                  </span>
                  {!DONE.has(a.status) && (
                    <MoveToDate
                      assignment={a}
                      compact
                      onMoved={(item, dateISO) => setResults((rs) =>
                        rs.map((r) => (r.id === item.id ? { ...r, scheduledDate: dateISO } : r)))}
                    />
                  )}
                </li>
              ))}
            </ul>
          </>
        )
      )}
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
