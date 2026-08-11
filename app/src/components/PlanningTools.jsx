import { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, getDocs, query, where, addDoc, updateDoc,
  serverTimestamp, deleteField,
} from 'firebase/firestore';
import { ref, listAll, getMetadata, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { todayISO, resolveContentUrl } from '../lib/assignments';
import { DONE_STATUSES, rescheduleAssignment, waiveAssignment, tomorrowISO } from '../lib/parentData';
import { resolveTheme } from '../config/themes';
import './PlanningTools.css';

function shiftISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Shared sticky-note editor: whatever Abi types shows on the kid's card.
async function editNote(assignment) {
  const note = window.prompt(
    `Note for "${assignment.title}" (the kid sees this on the card — leave empty to remove):`,
    assignment.parentNote ?? ''
  );
  if (note === null) return false;
  await updateDoc(doc(db, 'assignments', assignment.id), {
    parentNote: note.trim() ? note.trim() : deleteField(),
    updatedAt: serverTimestamp(),
  });
  return true;
}

// ---- End-of-day sweep: every unfinished item, one decision each, in bulk ----
export function SweepPanel({ assignments, students }) {
  const [checked, setChecked] = useState({});
  const [open, setOpen] = useState(false);

  const unfinished = useMemo(
    () => (assignments ?? []).filter((a) => !DONE_STATUSES.has(a.status))
      .sort((x, y) => x.studentId.localeCompare(y.studentId) || x.scheduledDate.localeCompare(y.scheduledDate)),
    [assignments]
  );

  if (unfinished.length === 0) return null;
  const chosen = unfinished.filter((a) => checked[a.id]);

  async function bulk(action) {
    for (const a of chosen) {
      if (action === 'tomorrow') await rescheduleAssignment(a.id, tomorrowISO());
      else if (action === 'waive') await waiveAssignment(a.id);
    }
    setChecked({});
  }

  return (
    <section className="sweep-card">
      <button className="sweep-toggle" onClick={() => setOpen((o) => !o)}>
        🧹 End-of-day sweep — {unfinished.length} unfinished item{unfinished.length > 1 ? 's' : ''} {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <p className="sweep-hint">
            Check the stragglers, then push them all to tomorrow or waive them in one tap.
            <button className="sweep-all" onClick={() => setChecked(Object.fromEntries(unfinished.map((a) => [a.id, true])))}>
              select all
            </button>
          </p>
          <ul className="sweep-list">
            {unfinished.map((a) => (
              <li key={a.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!checked[a.id]}
                    onChange={(e) => setChecked((c) => ({ ...c, [a.id]: e.target.checked }))}
                  />
                  {resolveTheme(a.studentId, students[a.studentId]?.theme).avatar} {a.title}
                  {a.scheduledDate < todayISO() && <em className="sweep-old"> ({a.scheduledDate})</em>}
                </label>
                <button className="note-btn" title="Note for the kid" onClick={() => editNote(a)}>📌</button>
              </li>
            ))}
          </ul>
          {chosen.length > 0 && (
            <div className="sweep-actions">
              <button onClick={() => bulk('tomorrow')}>→ Push {chosen.length} to tomorrow</button>
              <button className="waive-btn" onClick={() => bulk('waive')}>Waive {chosen.length}</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---- Next-week preview: see what's coming, nudge items between days ----
export function WeekPreview({ students }) {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const [expanded, setExpanded] = useState(null); // assignment id whose details are open

  useEffect(() => {
    if (!open) return;
    const start = tomorrowISO();
    const end = shiftISO(todayISO(), 8);
    getDocs(query(collection(db, 'assignments'), where('scheduledDate', '>=', start), where('scheduledDate', '<=', end)))
      .then((snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => setItems([]));
  }, [open, bump]);

  const byDate = useMemo(() => {
    const map = {};
    for (const a of items ?? []) (map[a.scheduledDate] ??= []).push(a);
    Object.values(map).forEach((l) => l.sort((x, y) => x.studentId.localeCompare(y.studentId) || (x.sequence ?? 0) - (y.sequence ?? 0)));
    return map;
  }, [items]);

  async function shift(a, days) {
    await rescheduleAssignment(a.id, shiftISO(a.scheduledDate, days));
    setBump((b) => b + 1);
  }

  return (
    <section className="weekprev-card">
      <button className="sweep-toggle" onClick={() => setOpen((o) => !o)}>
        📆 Coming up (next 7 days) {open ? '▾' : '▸'}
      </button>
      {open && (
        items === null ? <p className="sweep-hint">Loading…</p> : (
          <div className="weekprev-days">
            {Object.keys(byDate).sort().map((date) => (
              <div key={date} className="weekprev-day">
                <h4>{new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</h4>
                <ul>
                  {byDate[date].map((a) => (
                    <li key={a.id} className={expanded === a.id ? 'weekprev-li-open' : ''}>
                      <div className="weekprev-row">
                        <button
                          className="weekprev-item"
                          title="See what this item asks for"
                          onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                        >
                          {resolveTheme(a.studentId, students[a.studentId]?.theme).avatar} {a.title}
                          {a.parentNote && ' 📌'}
                        </button>
                        <span className="weekprev-actions">
                          <button title="A day earlier" onClick={() => shift(a, -1)}>◀</button>
                          <button title="A day later" onClick={() => shift(a, 1)}>▶</button>
                          <button className="note-btn" title="Note for the kid" onClick={() => editNote(a).then((ok) => ok && setBump((b) => b + 1))}>📌</button>
                        </span>
                      </div>
                      {expanded === a.id && <ItemDetails assignment={a} />}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {Object.keys(byDate).length === 0 && <p className="sweep-hint">Nothing scheduled in the next 7 days.</p>}
          </div>
        )
      )}
    </section>
  );
}

// Expanded view of one upcoming item: what the kid will be asked to do,
// how long it should take, and a button to open the actual material.
const DETAIL_TYPE_LABELS = {
  reading: '📖 Reading', worksheet: '✏️ Worksheet', test: '📝 Test',
  memorization: '🗣️ Memorize & recite', bible: '🙏 Bible', project: '🎨 Project',
  video: '🎬 Video lesson', audio: '🎧 Listen & speak', task: '⭐ From Mom',
};

function ItemDetails({ assignment }) {
  const [opening, setOpening] = useState(false);

  async function openMaterial() {
    setOpening(true);
    try {
      const url = await resolveContentUrl(assignment.contentPath);
      window.open(url, '_blank', 'noopener');
    } catch { /* file missing — nothing to open */ }
    setOpening(false);
  }

  return (
    <div className="weekprev-details">
      <p className="weekprev-meta">
        {DETAIL_TYPE_LABELS[assignment.itemType] ?? assignment.itemType} · ~{assignment.estimatedMinutes} min
      </p>
      {assignment.instructions && <p className="weekprev-instructions">{assignment.instructions}</p>}
      {assignment.parentNote && <p className="weekprev-note">📌 Your note: {assignment.parentNote}</p>}
      <span className="weekprev-links">
        {assignment.contentPath && (
          <button onClick={openMaterial} disabled={opening}>
            {opening ? 'Opening…' : assignment.contentPath.endsWith('.mp3') ? '🎧 Open the audio' : '📄 Open the pages'}
          </button>
        )}
        {assignment.externalUrl && (
          <a href={assignment.externalUrl} target="_blank" rel="noreferrer">🔗 Open the site</a>
        )}
      </span>
    </div>
  );
}

// ---- Quick-add: "Logan, finish piano practice, today" ----
export function QuickAdd({ students, order }) {
  const [kid, setKid] = useState(order[0]);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [when, setWhen] = useState('today');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  async function add() {
    if (!title.trim()) return;
    await addDoc(collection(db, 'assignments'), {
      studentId: kid,
      title: title.trim(),
      subjectId: 'custom',
      itemType: 'task',
      estimatedMinutes: Number(minutes) || 15,
      scheduledDate: when === 'today' ? todayISO() : tomorrowISO(),
      originalDate: when === 'today' ? todayISO() : tomorrowISO(),
      sequence: 50,
      status: 'not_started',
      waivedReason: null,
      contentPath: null,
      keyPath: null,
      externalUrl: null,
      ...(note.trim() ? { parentNote: note.trim() } : {}),
      instructions: 'A special item from Mom — check it off when it\'s done!',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setTitle('');
    setNote('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <section className="quickadd-card">
      <h2>➕ Quick add</h2>
      <div className="quickadd-row">
        <select value={kid} onChange={(e) => setKid(e.target.value)}>
          {order.map((id) => <option key={id} value={id}>{students[id]?.name ?? id}</option>)}
        </select>
        <input
          className="quickadd-title"
          placeholder="e.g. Finish piano practice"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <select value={minutes} onChange={(e) => setMinutes(e.target.value)}>
          {[5, 10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
        </select>
        <select value={when} onChange={(e) => setWhen(e.target.value)}>
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
        </select>
        <button onClick={add} disabled={!title.trim()}>{saved ? 'Added ✓' : 'Add'}</button>
      </div>
      <input
        className="quickadd-note"
        placeholder="Optional note the kid sees (📌)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </section>
  );
}

// ---- Echo shelf: the kids' latest Spanish recordings, playable ----
export function EchoShelf({ students, order }) {
  const [echoes, setEchoes] = useState(null);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(null);

  useEffect(() => {
    if (!open || echoes) return;
    (async () => {
      const all = [];
      for (const kid of order) {
        try {
          const res = await listAll(ref(storage, `submissions/${kid}/echo`));
          const metas = await Promise.all(res.items.map(async (i) => ({ item: i, meta: await getMetadata(i) })));
          metas.sort((a, b) => (a.meta.timeCreated < b.meta.timeCreated ? 1 : -1));
          for (const { item, meta } of metas.slice(0, 4)) {
            all.push({ kid, name: item.name, fullPath: item.fullPath, when: meta.timeCreated });
          }
        } catch { /* no echoes yet */ }
      }
      setEchoes(all.sort((a, b) => (a.when < b.when ? 1 : -1)));
    })();
  }, [open, echoes, order]);

  async function play(e) {
    const url = await getDownloadURL(ref(storage, e.fullPath));
    setPlaying({ ...e, url });
  }

  return (
    <section className="echo-card">
      <button className="sweep-toggle" onClick={() => setOpen((o) => !o)}>
        🎙️ Spanish echoes — hear the kids say it {open ? '▾' : '▸'}
      </button>
      {open && (
        echoes === null ? <p className="sweep-hint">Loading…</p> :
        echoes.length === 0 ? <p className="sweep-hint">No recordings yet — they appear when a kid taps 🎙️ on a Spanish lesson.</p> : (
          <>
            {playing && <audio controls autoPlay src={playing.url} className="echo-player" />}
            <ul className="echo-list">
              {echoes.map((e) => (
                <li key={e.fullPath}>
                  <button onClick={() => play(e)}>
                    ▶ {resolveTheme(e.kid, students[e.kid]?.theme).avatar} {students[e.kid]?.name} — {new Date(e.when).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </section>
  );
}
