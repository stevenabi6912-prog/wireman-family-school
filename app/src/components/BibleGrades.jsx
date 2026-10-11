import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, query, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { resolveTheme } from '../config/themes';
import './BibleGrades.css';

// Bible (Names of God) is done orally with Mom, so the kids only check it
// off — nothing ever reached the gradebook. This is Abi's weekly grade entry:
// one grade per kid per week, attached to that week's last Bible item so it
// flows into the Bible average and the printed records like any other grade.
//
// Rubric (10 pts) — modeled on how the class actually runs; swap the parts
// and weights for Abi's Master List guidelines whenever she shares them:
const RUBRIC = [
  { k: 'memory', label: 'Memory verse', max: 4, hint: 'recited the week\'s verse' },
  { k: 'participation', label: 'Daily Bible time', max: 3, hint: 'engaged all four days' },
  { k: 'understanding', label: 'Understanding', max: 3, hint: 'can explain the Name' },
];
const MAX = RUBRIC.reduce((s, r) => s + r.max, 0);
const DONE = new Set(['submitted', 'graded', 'waived']);

export default function BibleGrades({ students, order, grades }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null); // `${kid}-${week}`

  useEffect(() => {
    if (!open || items) return;
    getDocs(query(collection(db, 'assignments'), where('subjectId', '==', 'bible')))
      .then((snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => setItems([]));
  }, [open, items]);

  // Per kid: weeks the family has actually worked (any done item), newest
  // first, each pointing at the week's last Bible doc as the grade target.
  const weeks = useMemo(() => {
    if (!items) return null;
    const out = {};
    for (const kid of order) {
      const mine = items.filter((a) => a.studentId === kid && a.dayIndex && a.itemType === 'bible');
      const byWeek = {};
      for (const a of mine) {
        const w = Math.ceil(a.dayIndex / 4);
        (byWeek[w] ??= []).push(a);
      }
      out[kid] = Object.entries(byWeek)
        .map(([w, list]) => ({
          week: Number(w),
          title: list[0].title.replace('Names of God — ', ''),
          target: list.sort((a, b) => b.dayIndex - a.dayIndex)[0],
          anyDone: list.some((a) => DONE.has(a.status)),
        }))
        .filter((x) => x.anyDone)
        .sort((a, b) => b.week - a.week)
        .slice(0, 8);
    }
    return out;
  }, [items, order]);

  const gradeFor = (assignmentId) => grades.find((g) => g.assignmentId === assignmentId);
  const ungraded = useMemo(() => {
    if (!weeks) return 0;
    return order.reduce((n, kid) => n + (weeks[kid]?.filter((w) => !gradeFor(w.target.id)).length ?? 0), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, grades, order]);

  return (
    <section className="biblegrades-card">
      <button className="sweep-toggle" onClick={() => setOpen((o) => !o)}>
        📖 Bible grades{open && ungraded > 0 ? ` — ${ungraded} week${ungraded === 1 ? '' : 's'} to grade` : ''} {open ? '▾' : '▸'}
      </button>
      {open && (weeks === null ? (
        <p className="biblegrades-hint">Loading…</p>
      ) : (
        <>
          <p className="biblegrades-hint">
            One grade per kid per week: memory verse ({RUBRIC[0].max}) + daily Bible time ({RUBRIC[1].max}) + understanding ({RUBRIC[2].max}) = out of {MAX}.
            It lands in the gradebook under Bible like any other grade.
          </p>
          {order.map((kid) => (
            <div key={kid} className="biblegrades-kid">
              <h4>{resolveTheme(kid, students?.[kid]?.theme).avatar} {students?.[kid]?.name ?? kid}</h4>
              {weeks[kid]?.length === 0 && <p className="biblegrades-hint">No completed Bible weeks yet.</p>}
              {weeks[kid]?.map((w) => (
                <WeekRow
                  key={w.week}
                  kid={kid}
                  weekInfo={w}
                  grade={gradeFor(w.target.id)}
                  editing={editing === `${kid}-${w.week}`}
                  onEdit={() => setEditing(editing === `${kid}-${w.week}` ? null : `${kid}-${w.week}`)}
                  onSaved={() => setEditing(null)}
                />
              ))}
            </div>
          ))}
        </>
      ))}
    </section>
  );
}

function WeekRow({ kid, weekInfo, grade, editing, onEdit, onSaved }) {
  const existing = grade?.rubric ?? {};
  const [parts, setParts] = useState(() =>
    Object.fromEntries(RUBRIC.map((r) => [r.k, existing[r.k] ?? ''])));
  const [saving, setSaving] = useState(false);

  const total = RUBRIC.reduce((s, r) => s + Number(parts[r.k] || 0), 0);
  const complete = RUBRIC.every((r) => parts[r.k] !== '');

  async function save() {
    setSaving(true);
    try {
      await setDoc(doc(db, 'grades', weekInfo.target.id), {
        assignmentId: weekInfo.target.id,
        studentId: kid,
        subjectId: 'bible',
        score: total,
        maxScore: MAX,
        rubric: Object.fromEntries(RUBRIC.map((r) => [r.k, Number(parts[r.k] || 0)])),
        perQuestion: [],
        misunderstandingSummary: '',
        confidence: 'high',
        needsManualReview: false,
        gradedBy: 'Abi',
        overriddenScore: null,
        gradedAt: serverTimestamp(),
      }, { merge: true });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="biblegrades-row">
      <span className="biblegrades-week">Wk {weekInfo.week} — {weekInfo.title}</span>
      {grade && !editing && (
        <span className="biblegrades-score">{grade.overriddenScore ?? grade.score}/{grade.maxScore}</span>
      )}
      {!editing ? (
        <button className="biblegrades-btn" onClick={onEdit}>{grade ? '✏️' : 'enter grade'}</button>
      ) : (
        <span className="biblegrades-form">
          {RUBRIC.map((r) => (
            <label key={r.k} title={r.hint}>
              {r.label} <em>/{r.max}</em>
              <input
                type="number" min="0" max={r.max} value={parts[r.k]}
                onChange={(e) => setParts({ ...parts, [r.k]: e.target.value === '' ? '' : Math.min(r.max, Math.max(0, Number(e.target.value))) })}
              />
            </label>
          ))}
          <span className="biblegrades-total">= {total}/{MAX}</span>
          <button className="biblegrades-btn biblegrades-save" onClick={save} disabled={saving || !complete}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="biblegrades-cancel" onClick={onEdit}>cancel</button>
        </span>
      )}
    </div>
  );
}
