import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { todayISO } from '../lib/assignments';
import {
  currentMemoryWeek, cachedMemoryWeek, fetchMemoryItems, itemAppliesTo, itemsForWeek,
  pieceTextFor, TRACKS_FOR_SUBJECT, TRACK_META,
} from '../lib/memory';
import { grantBreak } from '../lib/breaks';
import { playDing, playFanfare } from '../lib/sounds';
import { resolveTheme } from '../config/themes';
import './KidExtras.css';

// ---- Verse of the day: the week's Name of God, KJV, greets every kid ----
export function VerseOfDay({ large }) {
  const [verse, setVerse] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const wk = await currentMemoryWeek();
        const items = await fetchMemoryItems();
        const item = items.find((i) => i.track === 'bible' && i.week === wk.week);
        if (item) setVerse(item);
      } catch { /* verse card just stays hidden */ }
    })();
  }, []);

  if (!verse) return null;
  return (
    <div className="verse-card">
      <p className="verse-name">📖 {verse.title}</p>
      {verse.text ? (
        <p className="verse-text">{verse.text}</p>
      ) : (
        <p className="verse-text verse-ref-only">{verse.reference}</p>
      )}
    </div>
  );
}

// ---- Warm-up: 3 minutes of THIS subject's memory work before the lesson ----
// Abi's call — memory work belongs at the front of each subject, not parked in
// a tab at the end of the day.
const WARM_SECONDS = 180;

export function SubjectWarmUp({ subjectId, studentId, large }) {
  const tracks = TRACKS_FOR_SUBJECT[subjectId];
  const dayKey = `warm:${studentId}:${subjectId}:${todayISO()}`;
  const [done, setDone] = useState(() => localStorage.getItem(dayKey) === '1');
  const [items, setItems] = useState(null);
  const [left, setLeft] = useState(null); // countdown, null = not started

  useEffect(() => {
    if (!tracks || done) return;
    (async () => {
      try {
        const [wk, all] = await Promise.all([cachedMemoryWeek(), fetchMemoryItems()]);
        const mine = itemsForWeek(all, wk.week).filter(
          (it) => tracks.includes(it.track) && itemAppliesTo(it, studentId)
        );
        setItems(mine);
      } catch {
        setItems([]);
      }
    })();
  }, [subjectId, studentId, done]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (left === null) return;
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  function finish() {
    localStorage.setItem(dayKey, '1');
    setDone(true);
    playDing();
  }

  if (!tracks || done || items === null || items.length === 0) return null;

  return (
    <div className="warmup-box">
      <div className="warmup-head">
        <strong>🧠 {large ? 'Practice first!' : 'Warm-up — 3 minutes of memory work'}</strong>
        {left === null ? (
          <button className="warmup-timer-btn" onClick={() => setLeft(WARM_SECONDS)}>Start timer</button>
        ) : (
          <span className={`warmup-timer ${left <= 0 ? 'warmup-timer-done' : ''}`}>
            {left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : "Time's up — nice work!"}
          </span>
        )}
      </div>
      <ul className="warmup-list">
        {items.map((it) => (
          <li key={it.id}>
            <span className="warmup-emoji">{TRACK_META[it.track]?.emoji ?? '•'}</span>
            <span>
              <strong>{it.title}</strong>
              {it.reference && <em> — {it.reference}</em>}
              {(it.text || (it.isUnitPiece && pieceTextFor(it, studentId))) && (
                <span className="warmup-text">{it.text || pieceTextFor(it, studentId)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <button className="warmup-done" onClick={finish}>
        ✓ {large ? 'I practiced it!' : 'Practiced — start the lesson'}
      </button>
    </div>
  );
}

// ---- Daily surprise chest: opens once per day, after the day is done ----
const JOKES = [
  'Why did the math book look sad? It had too many problems!',
  'What do you call a fish with no eyes? A fsh!',
  'Why did the scarecrow win an award? He was outstanding in his field!',
  'What has ears but cannot hear? A cornfield!',
  'Why can\'t you give Elsa a balloon? She\'ll let it go!',
  'What do you call cheese that isn\'t yours? Nacho cheese!',
  'Why did the bicycle fall over? It was two-tired!',
  'What did the ocean say to the beach? Nothing — it just waved!',
  'Why do cows wear bells? Because their horns don\'t work!',
  'What kind of tree fits in your hand? A palm tree!',
  'Why did the golfer bring two pairs of pants? In case he got a hole in one!',
  'What do you call a dinosaur that crashes his car? Tyrannosaurus Wrecks!',
  'How does the moon cut his hair? Eclipse it!',
  'Why was the belt arrested? For holding up a pair of pants!',
  'What building has the most stories? The library!',
];
const FACTS = [
  'A knight\'s full suit of armor weighed about 50 pounds — as much as Lazarus\'s backpack times five!',
  'Octopuses have three hearts and blue blood.',
  'Honey found in ancient Egyptian tombs is still safe to eat — honey never spoils.',
  'Lightning is five times hotter than the surface of the sun.',
  'Medieval castles put their staircases spiraling clockwise so defenders could swing swords downhill.',
  'A group of flamingos is called a flamboyance.',
  'The Vikings reached North America about 500 years before Columbus.',
  'Your heart beats about 100,000 times every single day.',
  'Sea otters hold hands while they sleep so they don\'t drift apart.',
  'The Great Wall of China took over 1,000 years to build.',
  'A bolt of lightning contains enough energy to toast 100,000 slices of bread.',
  'Wombat poop is cube-shaped.',
  'In medieval times, people thought tomatoes were poisonous.',
  'The fastest bird, the peregrine falcon, dives at over 240 miles per hour.',
  'One day on Venus is longer than one year on Venus.',
];

export function SurpriseChest({ studentId, large }) {
  const key = `chest:${studentId}:${todayISO()}`;
  const [opened, setOpened] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  });

  function open() {
    const roll = Math.random();
    let prize;
    if (roll < 0.2) {
      grantBreak(studentId);
      prize = { kind: 'token', text: '🎟️ BONUS BRAIN BREAK! It\'s ready right now — go play!' };
    } else if (roll < 0.6) {
      prize = { kind: 'joke', text: JOKES[Math.floor(Math.random() * JOKES.length)] };
    } else {
      prize = { kind: 'fact', text: FACTS[Math.floor(Math.random() * FACTS.length)] };
    }
    playFanfare();
    localStorage.setItem(key, JSON.stringify(prize));
    setOpened(prize);
  }

  return (
    <div className="chest-zone">
      {opened ? (
        <div className="chest-prize">
          <span className="chest-prize-emoji">{opened.kind === 'token' ? '🎟️' : opened.kind === 'joke' ? '😂' : '🤯'}</span>
          <p>{opened.text}</p>
        </div>
      ) : (
        <button className="chest-btn" onClick={open}>
          🧰 {large ? 'Open your treasure chest!' : 'You earned a surprise — open the chest!'}
        </button>
      )}
    </div>
  );
}

// ---- Sibling kudos: one cheer per day, lands on their page tomorrow ----
const SIBLINGS = { luke: 'Luke', layla: 'Layla', logan: 'Logan', lazarus: 'Lazarus' };
const STICKERS = ['🔥', '⭐', '💪', '🏆', '🦄', '🚀'];

export function KudosSend({ studentId, large }) {
  const today = todayISO();
  const sentKey = `kudos-sent:${studentId}:${today}`;
  const [sent, setSent] = useState(() => localStorage.getItem(sentKey));
  const [to, setTo] = useState(null);

  async function send(sticker) {
    await setDoc(doc(db, 'kudos', `${studentId}-${today}`), {
      from: studentId,
      to,
      sticker,
      date: today,
    });
    playDing();
    localStorage.setItem(sentKey, to);
    setSent(to);
  }

  if (sent) return <p className="kudos-sent">💌 Cheer sent to {SIBLINGS[sent] ?? 'your sibling'}!</p>;

  return (
    <div className="kudos-send">
      <p className="kudos-title">{large ? '💌 Send a cheer!' : '💌 Send a cheer to someone still working:'}</p>
      {!to ? (
        <div className="kudos-row">
          {Object.entries(SIBLINGS).filter(([id]) => id !== studentId).map(([id, name]) => (
            <button key={id} className="kudos-choice" onClick={() => setTo(id)}>
              {resolveTheme(id).avatar} {name}
            </button>
          ))}
        </div>
      ) : (
        <div className="kudos-row">
          {STICKERS.map((s) => (
            <button key={s} className="kudos-choice kudos-sticker" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function KudosInbox({ studentId }) {
  const [cheers, setCheers] = useState([]);

  useEffect(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    getDocs(query(collection(db, 'kudos'), where('to', '==', studentId), where('date', '>=', startIso)))
      .then((snap) => setCheers(snap.docs.map((d) => d.data())))
      .catch(() => {});
  }, [studentId]);

  if (cheers.length === 0) return null;
  return (
    <div className="kudos-inbox">
      {cheers.map((c, i) => (
        <span key={i} className="kudos-cheer">
          {c.sticker} from {SIBLINGS[c.from] ?? c.from}!
        </span>
      ))}
    </div>
  );
}

// ---- Personal records board (racing yourself, never siblings) ----
export function PersonalRecords({ stats, large }) {
  if (!stats) return null;
  const rows = [];
  if (stats.bestStreak > 0) rows.push(['🔥 Best streak', `${stats.bestStreak} day${stats.bestStreak > 1 ? 's' : ''}`]);
  if (stats.fastestDayMinutes) rows.push(['⚡ Fastest full day', `${stats.fastestDayMinutes} min`]);
  if (stats.earliestFinish) rows.push(['🌅 Earliest finish', stats.earliestFinish]);
  if (rows.length === 0) return null;
  return (
    <div className="records-board">
      <h3>🏅 {large ? 'My records!' : 'My personal records'}</h3>
      <div className="records-rows">
        {rows.map(([label, val]) => (
          <span key={label} className="records-chip">{label}: <strong>{val}</strong></span>
        ))}
      </div>
    </div>
  );
}

// ---- 2-minute math-fact sprint (per Abi's plan: top of every math hour) ----
const SPRINT_SECONDS = 120;

function makeProblem(grade) {
  const r = (n) => Math.floor(Math.random() * n);
  if (grade <= 3) {
    // Lazarus: THE priority — ×0, ×1, ×2, ×10 (then wider as he's ready)
    const tables = [0, 1, 2, 10];
    const a = tables[r(tables.length)];
    const b = r(11);
    return { text: `${a} × ${b}`, answer: a * b };
  }
  if (grade <= 5) {
    // Logan: multiplication and division facts 2-12
    if (Math.random() < 0.5) {
      const a = 2 + r(11); const b = 2 + r(11);
      return { text: `${a} × ${b}`, answer: a * b };
    }
    const b = 2 + r(11); const q = 2 + r(11);
    return { text: `${b * q} ÷ ${b}`, answer: q };
  }
  // Luke & Layla: integer operations for Algebra 1 fluency
  const kind = r(3);
  if (kind === 0) { const a = r(25) - 12; const b = r(25) - 12; return { text: `${a} + (${b})`, answer: a + b }; }
  if (kind === 1) { const a = r(25) - 12; const b = r(25) - 12; return { text: `${a} − (${b})`, answer: a - b }; }
  const a = r(13) - 6; const b = r(13) - 6; return { text: `${a} × (${b})`, answer: a * b };
}

export function MathSprint({ studentId, grade, large }) {
  const [state, setState] = useState('idle'); // idle | running | done
  const [problem, setProblem] = useState(null);
  const [input, setInput] = useState('');
  const [correct, setCorrect] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(SPRINT_SECONDS);
  const bestKey = `sprint-best:${studentId}`;
  const [best, setBest] = useState(() => Number(localStorage.getItem(bestKey)) || 0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (state !== 'running') return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(t); setState('done'); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => {
    if (state === 'done' && correct > best) {
      localStorage.setItem(bestKey, String(correct));
      setBest(correct);
      playFanfare();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  function start() {
    setCorrect(0);
    setSecondsLeft(SPRINT_SECONDS);
    setProblem(makeProblem(grade));
    setInput('');
    setState('running');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function submit(e) {
    e.preventDefault();
    if (Number(input) === problem.answer) {
      playDing();
      setCorrect((c) => c + 1);
    }
    setProblem(makeProblem(grade));
    setInput('');
  }

  if (state === 'idle') {
    return (
      <button className="sprint-btn" onClick={start}>
        ⚡ {large ? '2-minute math sprint!' : '2-minute fact sprint first!'}{best > 0 && ` (best: ${best})`}
      </button>
    );
  }

  if (state === 'done') {
    return (
      <div className="sprint-done">
        <p>⚡ {correct} right in 2 minutes!{correct >= best && correct > 0 ? ' 🏅 NEW RECORD!' : best > 0 ? ` (best: ${best})` : ''}</p>
        <button className="sprint-again" onClick={start}>Go again</button>
      </div>
    );
  }

  return (
    <form className="sprint-box" onSubmit={submit}>
      <span className="sprint-timer">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
      <span className="sprint-problem">{problem.text} =</span>
      <input
        ref={inputRef}
        className="sprint-input"
        type="number"
        inputMode="numeric"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <button type="submit">✓</button>
      <span className="sprint-score">{correct} ✔</span>
    </form>
  );
}

// ---- Evolving buddy: your study buddy grows as your total climbs ----
const STAGES = [
  [0, '🥚', 'Egg'],
  [10, '🐣', 'Hatchling'],
  [40, '🐥', 'Fledgling'],
  [100, '🦅', 'Soarer'],
  [220, '🦖', 'Legend'],
  [400, '🐉', 'MYTHIC'],
];

export function buddyStage(totalDone) {
  let stage = STAGES[0];
  for (const s of STAGES) if (totalDone >= s[0]) stage = s;
  const next = STAGES[STAGES.indexOf(stage) + 1];
  return { emoji: stage[1], name: stage[2], next: next ? { at: next[0], emoji: next[1] } : null };
}
