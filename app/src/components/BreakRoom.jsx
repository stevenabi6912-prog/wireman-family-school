import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BREAK_SECONDS, loadGame, saveGame } from '../lib/breaks';
import { makeSudoku, makeWordSearch, WORD_THEMES, SCRAMBLES, TRIVIA, TYPING_WORDS } from './breakGames';
import VersusGames from './VersusGames';
import { watchMyGames, awaitingMe } from '../lib/versus';
import { playDing, playFanfare } from '../lib/sounds';
import './BreakRoom.css';

// Mid-day this is a 5-minute brain break: pick a game, timer runs, hard
// cutoff, progress saved. With `unlimited` (school finished, or no school at
// all today) the same room opens with no clock — there's no work to get back
// to, so nothing to cut them off for.
export default function BreakRoom({
  studentId, large, onClose, initialGame = null, unlimited = false, noSchoolToday = false,
}) {
  const [secondsLeft, setSecondsLeft] = useState(BREAK_SECONDS);
  const [game, setGame] = useState(initialGame); // 'sudoku' | 'wordsearch' | 'builder' | 'trivia' | 'versus'
  const [myTurnCount, setMyTurnCount] = useState(0);

  // Badge on the versus button so a waiting sibling game gets noticed.
  useEffect(
    () => watchMyGames(studentId, (games) =>
      setMyTurnCount(games.filter((g) => g.status !== 'over' && awaitingMe(g, studentId)).length)
    ),
    [studentId]
  );

  useEffect(() => {
    if (unlimited) return undefined; // free play — no clock at all
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setTimeout(onClose, 1200);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onClose, unlimited]);

  const mm = String(Math.floor(secondsLeft / 60));
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const timeUp = !unlimited && secondsLeft === 0;

  return (
    <div className="break-overlay">
      <div className="break-sheet">
        <div className="break-header">
          <h2>{unlimited ? '🎮 Game time!' : '🧠 Brain break!'}</h2>
          {unlimited ? (
            <span className="break-freeplay">no timer ✨</span>
          ) : (
            <span className={`break-timer ${secondsLeft <= 30 ? 'break-timer-low' : ''}`}>{mm}:{ss}</span>
          )}
        </div>
        {unlimited && !game && (
          <p className="break-freeplay-note">
            {noSchoolToday
              ? 'No school today — play as long as you like.'
              : 'School\'s done for today — play as long as you like.'}
          </p>
        )}
        {timeUp ? (
          <p className="break-over">⏰ Break's over — back to it! You've got this.</p>
        ) : !game ? (
          <div className="break-picker">
            <button onClick={() => setGame('sudoku')}>🔢 Sudoku</button>
            <button onClick={() => setGame('wordsearch')}>🔍 Word Search</button>
            <button onClick={() => setGame('builder')}>🔤 Word Builder</button>
            <button onClick={() => setGame('trivia')}>🏰 Castle Trivia</button>
            <button onClick={() => setGame('typing')}>⌨️ Typing Sprint</button>
            <button className="break-versus" onClick={() => setGame('versus')}>
              ⚔️ Play someone{myTurnCount > 0 && <span className="break-turnbadge">{myTurnCount}</span>}
            </button>
          </div>
        ) : (
          <>
            <button className="break-back" onClick={() => setGame(null)}>&larr; Games</button>
            {game === 'sudoku' && <Sudoku studentId={studentId} large={large} />}
            {game === 'wordsearch' && <WordSearch studentId={studentId} />}
            {game === 'builder' && <WordBuilder studentId={studentId} />}
            {game === 'trivia' && <Trivia studentId={studentId} />}
            {game === 'typing' && <TypingSprint studentId={studentId} />}
            {game === 'versus' && <VersusGames studentId={studentId} large={large} />}
          </>
        )}
        {!timeUp && (
          <button className="break-done" onClick={onClose}>
            {unlimited ? 'Done playing →' : 'I\'m ready to keep working →'}
          </button>
        )}
      </div>
    </div>
  );
}

function daySeed() {
  const d = new Date();
  return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
}

// ---------- Sudoku ----------
function Sudoku({ studentId, large }) {
  const size = large ? 4 : 6;
  const saved = loadGame(studentId, 'sudoku');
  const fresh = useMemo(() => makeSudoku(size, daySeed() + (saved?.round ?? 0)), [size, saved?.round]);
  const [state, setState] = useState(() =>
    saved?.cells && saved.seedDay === daySeed() ? saved : { seedDay: daySeed(), round: saved?.round ?? 0, cells: fresh.given.map((r) => [...r]) }
  );
  const { solution, given, boxW } = fresh;
  const solvedNow = state.cells.every((row, r) => row.every((v, c) => v === solution[r][c]));

  function tap(r, c) {
    if (given[r][c]) return;
    const next = state.cells.map((row) => [...row]);
    next[r][c] = (next[r][c] % size) + 1;
    const nextState = { ...state, cells: next };
    setState(nextState);
    saveGame(studentId, 'sudoku', nextState);
    if (next.every((row, ri) => row.every((v, ci) => v === solution[ri][ci]))) playFanfare();
  }

  function newPuzzle() {
    const nextState = { seedDay: daySeed(), round: (state.round ?? 0) + 1, cells: null };
    saveGame(studentId, 'sudoku', nextState);
    setState({ ...nextState, cells: makeSudoku(size, daySeed() + nextState.round).given.map((r) => [...r]) });
  }

  return (
    <div className="game-box">
      <p className="game-hint">Tap a square to cycle numbers. Fill every row, column and box with 1–{size}.</p>
      <div className="sudoku-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {state.cells.map((row, r) =>
          row.map((v, c) => (
            <button
              key={`${r}-${c}`}
              className={`sudoku-cell ${given[r][c] ? 'sudoku-given' : ''} ${(c + 1) % boxW === 0 && c !== size - 1 ? 'sudoku-boxr' : ''} ${(r + 1) % 2 === 0 && r !== size - 1 ? 'sudoku-boxb' : ''}`}
              onClick={() => tap(r, c)}
            >
              {v || ''}
            </button>
          ))
        )}
      </div>
      {solvedNow && <p className="game-win">🎉 Solved! <button onClick={newPuzzle}>Another?</button></p>}
    </div>
  );
}

// ---------- Word search ----------
function WordSearch({ studentId }) {
  const saved = loadGame(studentId, 'wordsearch');
  const round = saved?.seedDay === daySeed() ? (saved.round ?? 0) : 0;
  const theme = WORD_THEMES[(daySeed() + round) % WORD_THEMES.length];
  const puzzle = useMemo(() => makeWordSearch(theme, daySeed() + round * 7), [theme, round]);
  const [found, setFound] = useState(saved?.seedDay === daySeed() ? saved.found ?? [] : []);
  const [sel, setSel] = useState(null);

  function tap(r, c) {
    if (!sel) { setSel([r, c]); return; }
    const [r0, c0] = sel;
    setSel(null);
    for (const p of puzzle.placed) {
      const match = (p.r0 === r0 && p.c0 === c0 && p.r1 === r && p.c1 === c) ||
                    (p.r0 === r && p.c0 === c && p.r1 === r0 && p.c1 === c0);
      if (match && !found.includes(p.word)) {
        const next = [...found, p.word];
        setFound(next);
        saveGame(studentId, 'wordsearch', { seedDay: daySeed(), round, found: next });
        playDing();
        if (next.length === puzzle.placed.length) playFanfare();
      }
    }
  }

  function newPuzzle() {
    saveGame(studentId, 'wordsearch', { seedDay: daySeed(), round: round + 1, found: [] });
    setFound([]);
    setSel(null);
  }

  const foundCells = new Set();
  for (const p of puzzle.placed) {
    if (!found.includes(p.word)) continue;
    const dr = Math.sign(p.r1 - p.r0);
    const dc = Math.sign(p.c1 - p.c0);
    for (let i = 0; i < p.word.length; i++) foundCells.add(`${p.r0 + dr * i}-${p.c0 + dc * i}`);
  }

  return (
    <div className="game-box">
      <p className="game-hint">{puzzle.theme}: tap the FIRST letter of a word, then its LAST letter.</p>
      <div className="ws-grid">
        {puzzle.grid.map((row, r) =>
          row.map((ch, c) => (
            <button
              key={`${r}-${c}`}
              className={`ws-cell ${sel && sel[0] === r && sel[1] === c ? 'ws-sel' : ''} ${foundCells.has(`${r}-${c}`) ? 'ws-found' : ''}`}
              onClick={() => tap(r, c)}
            >
              {ch}
            </button>
          ))
        )}
      </div>
      <p className="ws-words">
        {puzzle.placed.map((p) => (
          <span key={p.word} className={found.includes(p.word) ? 'ws-word-done' : ''}>{p.word}</span>
        ))}
      </p>
      {found.length === puzzle.placed.length && (
        <p className="game-win">🎉 All found! <button onClick={newPuzzle}>Another?</button></p>
      )}
    </div>
  );
}

// ---------- Word builder ----------
function WordBuilder({ studentId }) {
  const saved = loadGame(studentId, 'builder');
  const idx = saved?.seedDay === daySeed() ? saved.idx ?? daySeed() % SCRAMBLES.length : daySeed() % SCRAMBLES.length;
  const puzzle = SCRAMBLES[idx % SCRAMBLES.length];
  const [got, setGot] = useState(saved?.seedDay === daySeed() ? saved.got ?? [] : []);
  const [entry, setEntry] = useState('');
  const [flash, setFlash] = useState(null);

  function submit() {
    const w = entry.toUpperCase().trim();
    setEntry('');
    if (!w) return;
    if (got.includes(w)) { setFlash('already'); return; }
    if (puzzle.words.includes(w)) {
      const next = [...got, w];
      setGot(next);
      saveGame(studentId, 'builder', { seedDay: daySeed(), idx, got: next });
      playDing();
      setFlash('yes');
      if (next.length >= 10) playFanfare();
    } else {
      setFlash('no');
    }
  }

  function newPuzzle() {
    saveGame(studentId, 'builder', { seedDay: daySeed(), idx: idx + 1, got: [] });
    setGot([]);
  }

  return (
    <div className="game-box">
      <p className="game-hint">Make words from these letters (3+ letters):</p>
      <div className="builder-letters">{puzzle.letters.split('').map((L, i) => <span key={i}>{L}</span>)}</div>
      <div className="builder-entry">
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="type a word"
          autoCapitalize="characters"
        />
        <button onClick={submit}>Try it</button>
      </div>
      {flash === 'yes' && <p className="builder-flash-yes">Nice! ✓</p>}
      {flash === 'no' && <p className="builder-flash-no">Not on my list — try another!</p>}
      {flash === 'already' && <p className="builder-flash-no">Already got that one!</p>}
      <p className="ws-words">{got.map((w) => <span key={w} className="ws-word-done">{w}</span>)}</p>
      <p className="game-hint">{got.length} of {puzzle.words.length} found {got.length >= 10 && <button onClick={newPuzzle}>New letters?</button>}</p>
    </div>
  );
}

// ---------- Typing sprint: 45 seconds, type the words, beat your best ----------
function TypingSprint({ studentId }) {
  const best = loadGame(studentId, 'typing')?.best ?? 0;
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(45);
  const [word, setWord] = useState('');
  const [entry, setEntry] = useState('');
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(null);

  function nextWord() {
    setWord(TYPING_WORDS[Math.floor(Math.random() * TYPING_WORDS.length)]);
  }

  function start() {
    setScore(0);
    setFinalScore(null);
    setLeft(45);
    setRunning(true);
    nextWord();
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    if (!running && left === 0) {
      setFinalScore(score);
      const prior = loadGame(studentId, 'typing')?.best ?? 0;
      if (score > prior) {
        saveGame(studentId, 'typing', { best: score });
        playFanfare();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, left]);

  function onType(v) {
    setEntry(v);
    if (v.trim().toLowerCase() === word) {
      setScore((s) => s + 1);
      playDing();
      setEntry('');
      nextWord();
    }
  }

  return (
    <div className="game-box">
      <p className="game-hint">Type the word exactly, as fast as you can! Best: {Math.max(best, finalScore ?? 0)} words</p>
      {!running ? (
        <div>
          {finalScore !== null && <h3 className="trivia-q">⏱️ {finalScore} words{finalScore > best ? ' — NEW BEST! 🏆' : ''}</h3>}
          <button className="submit-btn" onClick={start}>{finalScore === null ? 'Start 45-second sprint' : 'Go again!'}</button>
        </div>
      ) : (
        <div>
          <h3 className="typing-word">{word}</h3>
          <input
            className="typing-input"
            autoFocus
            value={entry}
            onChange={(e) => onType(e.target.value)}
            placeholder="type here"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <p className="game-hint">⏱️ {left}s · {score} words</p>
        </div>
      )}
    </div>
  );
}

// ---------- Trivia ----------
function Trivia({ studentId }) {
  const saved = loadGame(studentId, 'trivia');
  const [i, setI] = useState(saved?.seedDay === daySeed() ? saved.i ?? 0 : 0);
  const [score, setScore] = useState(saved?.seedDay === daySeed() ? saved.score ?? 0 : 0);
  const [picked, setPicked] = useState(null);
  const [deck, setDeck] = useState([]);

  // Their own missed-question review cards (grading writes reviewDecks/{kid})
  // lead the rotation, so break time quietly re-teaches last week's misses.
  useEffect(() => {
    getDoc(doc(db, 'reviewDecks', studentId))
      .then((s) => {
        const cards = s.data()?.cards ?? [];
        setDeck(cards.map((c) => ({ q: c.question, a: c.choices, c: c.answerIndex, why: c.explanation, review: true })));
      })
      .catch(() => {});
  }, [studentId]);

  const pool = deck.length ? [...deck, ...TRIVIA] : TRIVIA;
  const q = pool[(daySeed() + i) % pool.length];

  function pick(idx) {
    if (picked !== null) return;
    setPicked(idx);
    const right = idx === q.c;
    if (right) { playDing(); setScore((s) => s + 1); }
    setTimeout(() => {
      setPicked(null);
      const next = i + 1;
      setI(next);
      saveGame(studentId, 'trivia', { seedDay: daySeed(), i: next, score: score + (right ? 1 : 0) });
    }, 1400);
  }

  return (
    <div className="game-box">
      <p className="game-hint">🏰 {score} right so far</p>
      <h3 className="trivia-q">{q.review && <span className="trivia-review-tag">📚 from your work! </span>}{q.q}</h3>
      <div className="trivia-answers">
        {q.a.map((ans, idx) => (
          <button
            key={idx}
            className={picked === null ? '' : idx === q.c ? 'trivia-right' : picked === idx ? 'trivia-wrong' : ''}
            onClick={() => pick(idx)}
          >
            {ans}
          </button>
        ))}
      </div>
      {picked !== null && q.why && <p className="trivia-why">{q.why}</p>}
    </div>
  );
}
