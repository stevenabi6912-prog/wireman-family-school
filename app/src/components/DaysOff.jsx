import { useState } from 'react';
import { addBlockout, removeBlockout } from '../lib/reflow';
import './DaysOff.css';

// Parent-only editor for vacation/sick/co-op days. Saving immediately
// reflows the remaining year (nothing is deleted — dates slide) and
// reports the new projected finish date.
export default function DaysOff({ family, onChanged }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const blockouts = [...(family?.blockouts ?? [])].sort((a, b) => a.start.localeCompare(b.start));

  async function onAdd() {
    if (!start) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await addBlockout(start, end || start, label || 'Day off');
      setResult(r);
      setStart(''); setEnd(''); setLabel('');
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id) {
    setBusy(true);
    setResult(null);
    try {
      const r = await removeBlockout(id);
      setResult(r);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="daysoff-section">
      <h2>Days off & vacations</h2>
      <p className="daysoff-hint">
        Block out any dates — the rest of the year slides later automatically. Nothing gets deleted.
      </p>

      <div className="daysoff-form">
        <label>
          From
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} disabled={busy} />
        </label>
        <label>
          To
          <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} disabled={busy} />
        </label>
        <label className="daysoff-label-field">
          Label
          <input type="text" placeholder="Vacation, sick, co-op…" value={label} onChange={(e) => setLabel(e.target.value)} disabled={busy} />
        </label>
        <button className="daysoff-add" onClick={onAdd} disabled={busy || !start}>
          {busy ? 'Rescheduling…' : 'Add days off'}
        </button>
      </div>

      {result && (
        <p className="daysoff-result">
          ✅ Moved {result.changed} assignments. Projected last day of school:{' '}
          <strong>{result.projectedEnd}</strong>
          {result.projectedEnd > result.targetEnd
            ? ` — ${'that\'s past the'} June 3 goal`
            : ' — still on or before the June 3 goal'}
        </p>
      )}

      {blockouts.length > 0 && (
        <ul className="daysoff-list">
          {blockouts.map((b) => (
            <li key={b.id}>
              <span className="daysoff-range">
                {b.start === b.end ? b.start : `${b.start} → ${b.end}`}
              </span>
              <span className="daysoff-name">{b.label}</span>
              <button className="daysoff-remove" onClick={() => onRemove(b.id)} disabled={busy}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
