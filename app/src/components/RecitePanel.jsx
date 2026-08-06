import { useEffect, useMemo, useState } from 'react';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { todayISO } from '../lib/assignments';
import {
  currentMemoryWeek,
  fetchMemoryItems,
  fetchMemoryAttempts,
  itemAppliesTo,
  itemsForWeek,
  pieceTextFor,
  attemptsFor,
  isMastered,
  isAtRisk,
  TRACK_META,
  TRACK_ORDER,
} from '../lib/memory';
import './RecitePanel.css';

// Abi's Day-4 recitation screen: one page, all four kids. Shared items appear
// once (with a button row per kid); each kid's individual items sit under
// their name. Tap pass / almost / again to record the attempt — mastery
// ("said it twice, 2+ weeks apart") and the at-risk list fall out on their own.
const RESULTS = [
  { key: 'pass', label: '✓ Got it', cls: 'pass' },
  { key: 'partial', label: '≈ Almost', cls: 'partial' },
  { key: 'fail', label: '↻ Again', cls: 'fail' },
];

export default function RecitePanel({ students, order }) {
  const [items, setItems] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [week, setWeek] = useState(null);
  const [thisWeek, setThisWeek] = useState(null);
  const [editing, setEditing] = useState(null); // item being edited

  useEffect(() => {
    currentMemoryWeek().then((wk) => {
      setThisWeek(wk.week);
      setWeek(wk.week);
    });
    fetchMemoryItems().then(setItems).catch(() => setItems([]));
    fetchMemoryAttempts().then(setAttempts).catch(() => {});
  }, []);

  const today = todayISO();

  async function record(item, kidId, result) {
    const id = `${item.id}__${kidId}__${today}`;
    const attempt = {
      itemId: item.id,
      studentId: kidId,
      date: today,
      week,
      result,
    };
    setAttempts((prev) => [...prev.filter((a) => a.id !== id), { id, ...attempt }]);
    await setDoc(doc(db, 'memoryAttempts', id), { ...attempt, createdAt: serverTimestamp() }, { merge: true });
  }

  async function score(item, kidId, rubricScore) {
    const id = `${item.id}__${kidId}__${today}`;
    setAttempts((prev) => prev.map((a) => (a.id === id ? { ...a, rubricScore } : a)));
    await setDoc(
      doc(db, 'memoryAttempts', id),
      { itemId: item.id, studentId: kidId, date: today, week, rubricScore, createdAt: serverTimestamp() },
      { merge: true }
    );
  }

  const { shared, perKid, atRisk } = useMemo(() => {
    if (!items || !week) return { shared: [], perKid: {}, atRisk: [] };
    const live = itemsForWeek(items, week).sort(
      (a, b) => TRACK_ORDER.indexOf(a.track) - TRACK_ORDER.indexOf(b.track)
    );
    const shared = live.filter((it) => !it.studentId);
    const perKid = {};
    for (const id of order) {
      perKid[id] = live.filter((it) => it.studentId === id);
    }
    // At-risk sweep runs over EVERY item ever attempted, not just this week —
    // an old verse that fell out of memory should stay on Abi's radar.
    const atRisk = [];
    for (const it of items) {
      for (const kid of order) {
        if (!itemAppliesTo(it, kid)) continue;
        const kidAttempts = attemptsFor(attempts, it.id, kid);
        if (isAtRisk(kidAttempts)) {
          atRisk.push({ item: it, kid });
        }
      }
    }
    return { shared, perKid, atRisk };
  }, [items, attempts, week, order]);

  if (!items || !week) {
    return (
      <section className="recite-section">
        <h2>Day 4 — Recite</h2>
        <p className="daysoff-hint">Loading the memory plan…</p>
      </section>
    );
  }

  return (
    <section className="recite-section">
      <div className="recite-header">
        <h2>Day 4 — Recite</h2>
        <div className="recite-weeknav">
          <button onClick={() => setWeek((w) => Math.max(1, w - 1))}>‹</button>
          <span>
            Week {week}
            {week === thisWeek ? ' (this week)' : ''}
          </span>
          <button onClick={() => setWeek((w) => Math.min(36, w + 1))}>›</button>
        </div>
      </div>
      <p className="daysoff-hint">
        Tap a button as each kid recites — that's the whole gradebook. "Mastered" means they nailed it twice,
        at least two weeks apart. Tap ✏️ on any line to change what the kids see (e.g. the shorter T1/T2 verse
        from your Master List).
      </p>

      {atRisk.length > 0 && (
        <div className="recite-atrisk">
          <strong>🔺 Needs another pass:</strong>{' '}
          {atRisk.slice(0, 8).map(({ item, kid }, i) => (
            <span key={`${item.id}-${kid}`}>
              {i > 0 && ' · '}
              {students[kid]?.name ?? kid}: {item.title}
            </span>
          ))}
          {atRisk.length > 8 && ` · +${atRisk.length - 8} more`}
        </div>
      )}

      {shared.length > 0 && (
        <div className="recite-group">
          <h3>Everyone (say it together, check each kid)</h3>
          {shared.map((item) => (
            <SharedItemRow
              key={item.id}
              item={item}
              students={students}
              order={order}
              attempts={attempts}
              today={today}
              onRecord={record}
              onScore={score}
              onEdit={() => setEditing(item)}
            />
          ))}
        </div>
      )}

      {order.map((kidId) =>
        perKid[kidId]?.length ? (
          <div key={kidId} className="recite-group">
            <h3>{students[kidId]?.name ?? kidId} only</h3>
            {perKid[kidId].map((item) => (
              <div key={item.id} className="recite-item">
                <ItemHeading item={item} kidId={kidId} onEdit={() => setEditing(item)} />
                <KidButtons
                  item={item}
                  kidId={kidId}
                  kidName={students[kidId]?.name ?? kidId}
                  attempts={attempts}
                  today={today}
                  onRecord={record}
                  onScore={score}
                  hideName
                />
              </div>
            ))}
          </div>
        ) : null
      )}

      {editing && (
        <EditItemModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={(patch) => {
            setItems((prev) => prev.map((it) => (it.id === editing.id ? { ...it, ...patch } : it)));
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function ItemHeading({ item, kidId, onEdit }) {
  const meta = TRACK_META[item.track] ?? { emoji: '🧠', label: item.track };
  const piece = kidId && item.isUnitPiece ? pieceTextFor(item, kidId) : null;
  return (
    <div className="recite-item-heading">
      <p className="recite-item-title">
        <span className="recite-track">{meta.emoji}</span> {item.title}
        {item.reference && <span className="recite-ref"> — {item.reference}</span>}
        <button className="recite-edit" title="Edit what the kids see" onClick={onEdit}>✏️</button>
      </p>
      {piece && <p className="recite-piece">{piece}</p>}
      {item.text && <p className="recite-piece">{item.text}</p>}
      {item.tierNote && <p className="recite-tiernote">{item.tierNote}</p>}
    </div>
  );
}

function SharedItemRow({ item, students, order, attempts, today, onRecord, onScore, onEdit }) {
  const kids = order.filter((k) => itemAppliesTo(item, k));
  return (
    <div className="recite-item">
      <ItemHeading item={item} kidId={kids[0]} onEdit={onEdit} />
      <div className="recite-kid-rows">
        {kids.map((kidId) => (
          <KidButtons
            key={kidId}
            item={item}
            kidId={kidId}
            kidName={students[kidId]?.name ?? kidId}
            attempts={attempts}
            today={today}
            onRecord={onRecord}
            onScore={onScore}
          />
        ))}
      </div>
    </div>
  );
}

function KidButtons({ item, kidId, kidName, attempts, today, onRecord, onScore, hideName }) {
  const kidAttempts = attemptsFor(attempts, item.id, kidId);
  const todays = kidAttempts.find((a) => a.date === today);
  const mastered = isMastered(kidAttempts);
  return (
    <div className="recite-kid-row">
      {!hideName && <span className="recite-kid-name">{kidName}</span>}
      <span className="recite-buttons">
        {RESULTS.map((r) => (
          <button
            key={r.key}
            className={`recite-btn ${r.cls} ${todays?.result === r.key ? 'on' : ''}`}
            onClick={() => onRecord(item, kidId, r.key)}
          >
            {r.label}
          </button>
        ))}
      </span>
      {item.isUnitPiece && (
        <span className="recite-rubric" title="Presentation score: voice, pace, posture, expression">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              className={`recite-star ${todays?.rubricScore >= n ? 'on' : ''}`}
              onClick={() => onScore(item, kidId, n)}
            >
              ★
            </button>
          ))}
        </span>
      )}
      {mastered && <span className="recite-mastered" title="Passed twice, 14+ days apart">⭐ mastered</span>}
    </div>
  );
}

// Inline editor so Abi can put her Master List content (shorter T1/T2 verses,
// exact wording, notes) straight onto any item — the kids see it immediately.
function EditItemModal({ item, onClose, onSaved }) {
  const [title, setTitle] = useState(item.title ?? '');
  const [reference, setReference] = useState(item.reference ?? '');
  const [text, setText] = useState(item.text ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const patch = { title, reference, text };
    await updateDoc(doc(db, 'memoryItems', item.id), { ...patch, updatedAt: serverTimestamp() });
    onSaved(patch);
  }

  return (
    <div className="recite-modal-overlay" onClick={onClose}>
      <div className="recite-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit memory item</h3>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Reference (verse, date, etc.)
          <input value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <label>
          Text the kids see (paste the exact words to memorize — for Bible, the
          shorter Lazarus/Logan version works great here)
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="recite-modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
