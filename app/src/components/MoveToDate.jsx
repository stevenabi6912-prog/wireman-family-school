import { useState } from 'react';
import { rescheduleAssignment } from '../lib/parentData';
import './MoveToDate.css';

// "Move Chapter 8 to Monday." Shows where an item sits now; pick a day and it
// goes there. The one-day nudges and "do it tomorrow" buttons couldn't say
// *which* day, so a two-day slip meant clicking twice per item per kid.
export default function MoveToDate({ assignment, onMoved, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [movedTo, setMovedTo] = useState(null);

  // the list this row came from may refresh underneath us (a bulk move, a
  // re-query) — the item's own date wins once it catches up
  const current = assignment.scheduledDate ?? movedTo ?? '';

  async function move(dateISO) {
    if (!dateISO || dateISO === current) return;
    setBusy(true);
    try {
      await rescheduleAssignment(assignment.id, dateISO);
      setMovedTo(dateISO);
      onMoved?.(assignment, dateISO);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={`movedate ${compact ? 'movedate-compact' : ''}`}>
      {!compact && <span className="movedate-label">Move to</span>}
      <input
        type="date"
        title="Move this item to a different day"
        disabled={busy}
        value={current}
        onChange={(e) => move(e.target.value)}
      />
      {movedTo && <span className="movedate-ok">moved ✓</span>}
    </span>
  );
}

// Same thing for a whole set of items at once — a chapter's reading and test
// across both 8th graders is four items that always move together.
export function MoveAllToDate({ assignments, onMoved, noun = 'items' }) {
  const [busy, setBusy] = useState(false);
  const [movedTo, setMovedTo] = useState(null);

  async function moveAll(dateISO) {
    if (!dateISO) return;
    const pretty = new Date(`${dateISO}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'long', month: 'short', day: 'numeric',
    });
    if (!window.confirm(`Move all ${assignments.length} ${noun} shown to ${pretty}?`)) return;
    setBusy(true);
    try {
      for (const a of assignments) await rescheduleAssignment(a.id, dateISO);
      setMovedTo(dateISO);
      onMoved?.(dateISO);
    } finally {
      setBusy(false);
    }
  }

  if (assignments.length < 2) return null;

  return (
    <div className="moveall">
      <span className="movedate-label">
        {busy ? 'Moving…' : `Move all ${assignments.length} to`}
      </span>
      <input type="date" disabled={busy} onChange={(e) => moveAll(e.target.value)} />
      {movedTo && <span className="movedate-ok">all moved ✓</span>}
    </div>
  );
}
