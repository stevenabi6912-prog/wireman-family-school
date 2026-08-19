import { useEffect, useState } from 'react';
import { collection, doc, getDocs, query, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { resolveTheme } from '../config/themes';
import './ReadingAssessment.css';

// A place to log the numbers from a reading check Abi gives by hand. Mirrors
// the DIBELS examiner sheet she's actually holding, which records "Total words
// read / Total errors / Total words correct". The passage's own word count is
// read off the examiner copy and stored on the assignment, so she never has to
// count words herself — it's shown to her instead.
export default function ReadingAssessment({ students, order }) {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // assignment id being edited

  useEffect(() => {
    getDocs(query(collection(db, 'assignments'), where('assessment', '==', 'reading')))
      .then((snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1));
        setItems(list);
      })
      .catch(() => setItems([]));
  }, []);

  if (items === null || items.length === 0) return null;

  const needsResults = items.filter((a) => !a.readingResult).length;

  // Patch the just-saved result into local state directly — this was fetched
  // once with getDocs (not a live listener), so without this the row would
  // show "not entered yet" even right after a successful save.
  function applyResult(id, readingResult) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, readingResult } : a)));
  }

  return (
    <section className="reading-card">
      <button className="sweep-toggle" onClick={() => setOpen((o) => !o)}>
        📊 Reading assessment results
        {needsResults > 0 && ` — ${needsResults} need${needsResults === 1 ? 's' : ''} entering`}
        {' '}{open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="reading-list">
          {items.map((a) => (
            <ReadingRow
              key={a.id}
              assignment={a}
              student={students?.[a.studentId]}
              editing={editing === a.id}
              onEdit={() => setEditing(editing === a.id ? null : a.id)}
              onSaved={(result) => { applyResult(a.id, result); setEditing(null); }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReadingRow({ assignment, student, editing, onEdit, onSaved }) {
  const r = assignment.readingResult;
  const [seconds, setSeconds] = useState(r?.seconds ?? '');
  const [errors, setErrors] = useState(r?.errors ?? '');
  const [words, setWords] = useState(r?.words ?? '');
  const [saving, setSaving] = useState(false);

  // DIBELS is scored on a one-minute read: words correct = read - errors, and
  // WCPM scales that to 60s if the read ran short or long.
  const correct = words !== '' ? Math.max(0, Number(words) - Number(errors || 0)) : null;
  const wcpm = correct != null && seconds
    ? Math.max(0, Math.round((correct / Number(seconds)) * 60))
    : null;

  async function save() {
    if (words === '' || errors === '') return;
    setSaving(true);
    const result = {
      seconds: seconds ? Number(seconds) : 60,
      errors: Number(errors),
      words: Number(words),
      correct,
      wcpm,
      passageWords: assignment.passageWords ?? null,
      recordedAt: serverTimestamp(),
    };
    await updateDoc(doc(db, 'assignments', assignment.id), { readingResult: result });
    setSaving(false);
    // serverTimestamp() is a write-only sentinel, not a real value — swap in
    // a local Date so the parent's in-memory copy stays renderable.
    onSaved({ ...result, recordedAt: new Date() });
  }

  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="reading-row">
      <div className="reading-row-head">
        <span className="reading-who">
          {resolveTheme(assignment.studentId, student?.theme).avatar} <strong>{student?.name ?? assignment.studentId}</strong>
        </span>
        <span className="reading-date">{assignment.scheduledDate}</span>
        {r && !editing ? (
          <span className="reading-summary">
            {r.correct ?? r.words} correct · {r.errors} error{r.errors === 1 ? '' : 's'}{r.wcpm ? ` · ${r.wcpm} WCPM` : ''}
          </span>
        ) : (
          <span className="reading-summary reading-summary-empty">not entered yet</span>
        )}
        <button className="reading-edit-btn" onClick={onEdit}>{editing ? 'cancel' : r ? 'edit' : 'enter results'}</button>
      </div>
      {editing && (
        <div className="reading-form">
          {assignment.passageWords && (
            <p className="reading-passage">
              📄 <strong>{assignment.passageTitle ?? 'Passage'}</strong> — {assignment.passageWords} words total
            </p>
          )}
          <label>
            Total words read
            <input type="number" min="0" max={assignment.passageWords ?? undefined} value={words}
              onChange={(e) => setWords(e.target.value)} placeholder="e.g. 120" />
          </label>
          <label>
            Total errors
            <input type="number" min="0" value={errors} onChange={(e) => setErrors(e.target.value)} placeholder="e.g. 2" />
          </label>
          <label>
            Time <em>(seconds — leave blank for a standard 1-minute read)</em>
            <input type="number" min="1" value={seconds} onChange={(e) => setSeconds(e.target.value)} placeholder="60" />
          </label>
          {correct != null && (
            <p className="reading-wcpm-preview">
              → {correct} words correct{wcpm != null && wcpm !== correct ? ` · ${wcpm} WCPM` : ' per minute'}
            </p>
          )}
          <button className="reading-save" onClick={save} disabled={saving || words === '' || errors === ''}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
