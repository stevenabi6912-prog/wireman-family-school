import { useMemo, useState } from 'react';
import { resolveTheme } from '../config/themes';
import { setParentGrade, scoreLabel } from '../lib/grades';
import './BibleGrading.css';

const DONE = new Set(['submitted', 'graded', 'waived']);
const OUT_OF_KEY = 'wfs-bible-outof';

// Bible is read-and-discuss with Mom: nothing is submitted, so the grader
// never sees it and no grade doc ever existed for it. The kids still check it
// off — this is where that checked-off work turns into a grade.
export default function BibleGrading({ assignments, grades, students, order }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({}); // assignmentId -> { score, outOf, note }
  const [saving, setSaving] = useState(null);
  const [justSaved, setJustSaved] = useState({});

  const defaultOutOf = (() => {
    try {
      return localStorage.getItem(OUT_OF_KEY) || '10';
    } catch {
      return '10';
    }
  })();

  const gradeFor = useMemo(() => {
    const map = {};
    for (const g of grades ?? []) map[g.assignmentId] = g;
    return map;
  }, [grades]);

  // Finished Bible work, newest first: the ones with no score yet come first,
  // then recently scored ones so a number can be changed right here.
  const { toScore, scored } = useMemo(() => {
    const bible = (assignments ?? [])
      .filter((a) => a.subjectId === 'bible' && DONE.has(a.status))
      .sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1));
    return {
      toScore: bible.filter((a) => !gradeFor[a.id]),
      scored: bible.filter((a) => gradeFor[a.id]).slice(0, 6),
    };
  }, [assignments, gradeFor]);

  async function save(a) {
    const d = draft[a.id] ?? {};
    const score = Number(d.score);
    const outOf = Number(d.outOf ?? defaultOutOf);
    if (d.score === '' || d.score == null || !(outOf > 0) || Number.isNaN(score)) return;
    if (score > outOf && !window.confirm(`${score} out of ${outOf} — more than full marks? OK for extra credit, or Cancel to fix it (if you meant a percent, enter points instead).`)) return;
    setSaving(a.id);
    try {
      await setParentGrade(a, { score, maxScore: outOf, note: (d.note ?? '').trim() });
      try {
        localStorage.setItem(OUT_OF_KEY, String(outOf));
      } catch { /* private window — the default just won't stick */ }
      setJustSaved((j) => ({ ...j, [a.id]: true }));
      setDraft((p) => ({ ...p, [a.id]: undefined }));
    } finally {
      setSaving(null);
    }
  }

  function row(a, existing) {
    const d = draft[a.id] ?? {};
    const kid = students?.[a.studentId];
    const value = d.score ?? (existing ? String(existing.overriddenScore ?? existing.score ?? '') : '');
    const outOf = d.outOf ?? (existing?.maxScore > 0 ? String(existing.maxScore) : defaultOutOf);
    const ready = value !== '' && Number(outOf) > 0;
    return (
      <li key={a.id} className="bible-row">
        <div className="bible-row-what">
          <span className="bible-who">{resolveTheme(a.studentId, kid?.theme).avatar} {kid?.name ?? a.studentId}</span>
          <span className="bible-title">{a.title}</span>
          <span className="bible-date">
            {a.scheduledDate}
            {existing && <strong className="bible-existing"> · now {scoreLabel(existing)}</strong>}
            {justSaved[a.id] && <strong className="bible-saved"> · saved ✓</strong>}
          </span>
        </div>
        <div className="bible-row-score">
          <input
            type="number"
            min="0"
            step="any"
            placeholder="score"
            value={value}
            onChange={(e) => setDraft((p) => ({ ...p, [a.id]: { ...d, score: e.target.value } }))}
          />
          <span className="bible-outof-sep">out of</span>
          <input
            type="number"
            min="1"
            step="any"
            value={outOf}
            onChange={(e) => setDraft((p) => ({ ...p, [a.id]: { ...d, outOf: e.target.value } }))}
          />
          <input
            className="bible-note"
            placeholder="note (optional) — what you want on the record"
            value={d.note ?? existing?.misunderstandingSummary ?? ''}
            onChange={(e) => setDraft((p) => ({ ...p, [a.id]: { ...d, note: e.target.value } }))}
          />
          <button disabled={!ready || saving === a.id} onClick={() => save(a)}>
            {saving === a.id ? 'Saving…' : existing ? 'Update' : 'Save score'}
          </button>
        </div>
      </li>
    );
  }

  const waiting = toScore.length;

  return (
    <section className="bible-section">
      <button className="sweep-toggle" onClick={() => setOpen((o) => !o)}>
        🙏 Bible grades {waiting > 0 && <span className="review-count">{waiting}</span>} {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <p className="bible-hint">
            Bible is done with you, not turned in, so nothing here is auto-graded — your score is the grade.
            It counts toward the Bible average, the report cards and the transcript like any other subject.
          </p>
          {waiting === 0 && scored.length === 0 ? (
            <p className="struggle-empty">No finished Bible work waiting on a score.</p>
          ) : (
            <>
              {waiting > 0 && (
                <>
                  <p className="bible-group">Waiting for a score</p>
                  <ul className="bible-list">{toScore.map((a) => row(a, null))}</ul>
                </>
              )}
              {scored.length > 0 && (
                <>
                  <p className="bible-group">Recently scored</p>
                  <ul className="bible-list">{scored.map((a) => row(a, gradeFor[a.id]))}</ul>
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
