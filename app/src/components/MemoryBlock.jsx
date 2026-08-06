import { useEffect, useMemo, useRef, useState } from 'react';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import {
  currentMemoryWeek,
  fetchMemoryItems,
  itemAppliesTo,
  itemsForWeek,
  pieceTextFor,
  TRACK_META,
  TRACK_ORDER,
} from '../lib/memory';
import './MemoryBlock.css';

// The kid's daily memory-work panel: this week's verses/facts/pieces from
// Abi's plan, with a Day 1-4 rhythm hint. Spanish gets its own audio shelf.
const RHYTHM = {
  1: { normal: 'Day 1 — Meet it: read each one out loud 3 times.', large: 'Day 1: Read it out loud 3 times!' },
  2: { normal: 'Day 2 — Drill it: say it from memory (peeking is allowed).', large: 'Day 2: Try it without looking!' },
  3: { normal: "Day 3 — Mix it: today's items, plus one from an older week.", large: 'Day 3: Say it + one old one!' },
  4: { normal: 'Day 4 — Show it: recite to Mom today! 🎤', large: 'Day 4: Say it for Mom! 🎤' },
};

export default function MemoryBlock({ studentId, large }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [wk, setWk] = useState(null);

  useEffect(() => {
    currentMemoryWeek().then(setWk).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open || items) return;
    fetchMemoryItems().then(setItems).catch(() => setItems([]));
  }, [open, items]);

  const mine = useMemo(() => {
    if (!items || !wk) return null;
    const grouped = {};
    for (const it of itemsForWeek(items, wk.week)) {
      if (!itemAppliesTo(it, studentId)) continue;
      (grouped[it.track] ??= []).push(it);
    }
    return grouped;
  }, [items, wk, studentId]);

  if (!wk) return null;
  const rhythm = RHYTHM[wk.day][large ? 'large' : 'normal'];

  return (
    <section className="memblock">
      <button className="memblock-toggle" onClick={() => setOpen((o) => !o)}>
        <span>🧠 {large ? 'Memory work' : `Memory work — Week ${wk.week}`}</span>
        <span className="memblock-chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="memblock-body">
          <p className="memblock-rhythm">{wk.preSeason ? 'Sneak peek — week 1 starts with the school year!' : rhythm}</p>
          {!mine ? (
            <p className="memblock-loading">Loading your memory work…</p>
          ) : Object.keys(mine).length === 0 ? (
            <p className="memblock-loading">Nothing on the memory list this week. 🎉</p>
          ) : (
            TRACK_ORDER.filter((t) => mine[t]).map((track) => (
              <div key={track} className="memblock-track">
                <h4>
                  {TRACK_META[track].emoji} {TRACK_META[track].label}
                </h4>
                {mine[track].map((it) => (
                  <div key={it.id} className={`memblock-item ${it.isUnitPiece ? 'memblock-piece' : ''}`}>
                    <p className="memblock-title">
                      {it.title}
                      {it.reference && <span className="memblock-ref"> — {it.reference}</span>}
                    </p>
                    {it.isUnitPiece && pieceTextFor(it, studentId) && (
                      <p className="memblock-text">{pieceTextFor(it, studentId)}</p>
                    )}
                    {it.text && <p className="memblock-text">{it.text}</p>}
                  </div>
                ))}
                {track === 'spanish' && <SpanishShelf large={large} />}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

// Browse + play the Flip Flop Spanish audio straight from family Storage.
const SPANISH_FOLDERS = [
  { path: 'curriculum/spanish/sisi-l1-audio', label: 'Sí Sí lessons' },
  { path: 'curriculum/spanish/bridge-audio', label: 'Bridge audio' },
];

function SpanishShelf({ large }) {
  const [folder, setFolder] = useState(null);
  const [files, setFiles] = useState(null);
  const [playing, setPlaying] = useState(null); // { name, url }
  const audioRef = useRef(null);

  useEffect(() => {
    if (!folder) return;
    setFiles(null);
    listAll(ref(storage, folder))
      .then((res) => {
        const list = res.items
          .map((i) => ({ name: i.name, fullPath: i.fullPath }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        setFiles(list);
      })
      .catch(() => setFiles([]));
  }, [folder]);

  async function play(f) {
    const url = await getDownloadURL(ref(storage, f.fullPath));
    setPlaying({ name: f.name, url });
    // let the <audio> mount/update, then start
    setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
  }

  return (
    <div className="spanish-shelf">
      <div className="spanish-folders">
        {SPANISH_FOLDERS.map((f) => (
          <button
            key={f.path}
            className={`spanish-folder-btn ${folder === f.path ? 'active' : ''}`}
            onClick={() => setFolder(folder === f.path ? null : f.path)}
          >
            🎧 {f.label}
          </button>
        ))}
      </div>
      {playing && (
        <div className="spanish-player">
          <span className="spanish-now">▶ {cleanName(playing.name)}</span>
          <audio ref={audioRef} controls src={playing.url} />
        </div>
      )}
      {folder && (
        files === null ? (
          <p className="memblock-loading">Loading songs…</p>
        ) : files.length === 0 ? (
          <p className="memblock-loading">No audio found here yet.</p>
        ) : (
          <div className="spanish-files">
            {files.map((f) => (
              <button
                key={f.fullPath}
                className={`spanish-file-btn ${playing?.name === f.name ? 'playing' : ''}`}
                onClick={() => play(f)}
              >
                {playing?.name === f.name ? '🔊' : '▶'} {cleanName(f.name)}
              </button>
            ))}
          </div>
        )
      )}
      {large && folder === null && <p className="memblock-loading">Tap a button to hear your Spanish! 🎵</p>}
    </div>
  );
}

function cleanName(name) {
  return name.replace(/\.[a-z0-9]+$/i, '').replaceAll('-', ' ');
}
