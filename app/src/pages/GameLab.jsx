// A review page for the game graphics: every board, table and the ladder,
// rendered from hardcoded sample states with the same components the live
// games use. Nothing here reads or writes Firestore — moves you try on this
// page stay on this page.

import { useEffect, useMemo, useRef, useState } from 'react';
import { initialChess, applyMove, legalMoves, gameStatus } from '../lib/games/chess';
import { movesFor } from '../lib/games/checkers';
import { revealSunk } from '../lib/games/battleship';
import { initialPool, takeShot } from '../lib/games/pool';
import { buildLadder } from '../lib/games/ladder';
import { BoardView, CapturedTray, CheckerTray, BattleGrid } from '../components/games/Boards';
import { PoolCanvas, PocketedRack, poolPointAt } from '../components/games/PoolTable';
import { LadderBoard } from '../components/games/Ladder';
import { ROSTER, NAMES, avatarOf, GameRow, NewGameTiles, BreakPicker } from '../components/games/Lobby';
import '../components/VersusGames.css';
import '../components/BreakRoom.css';
import './GameLab.css';

// ---- chess: a short opening that ends with the black king in check ----
const sq = (name) => (8 - Number(name[1])) * 8 + (name.charCodeAt(0) - 97);
const CHESS_LINE = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'f3g5', 'd7d5', 'e4d5', 'f6d5', 'g5f7', 'e8f7', 'd1f3'];

function chessSample() {
  let state = initialChess();
  let last = null;
  const taken = [];
  for (const mv of CHESS_LINE) {
    const from = sq(mv.slice(0, 2));
    const to = sq(mv.slice(2, 4));
    if (state.board[to]) taken.push(state.board[to]);
    last = { from, to, captured: state.board[to] || null };
    state = applyMove(state, from, to, 'Q');
  }
  return { state, last, taken };
}

// ---- checkers: mid-game, a king on each side ----
function checkersSample() {
  const board = Array(64).fill('');
  const put = (piece, ...cells) => cells.forEach((c) => { board[c] = piece; });
  put('b', 1, 5, 8, 12, 17, 23);
  put('B', 44);
  put('r', 40, 49, 51, 53, 58, 62, 35);
  put('R', 14);
  return { board, turn: 'r', chain: null };
}

// ---- battleship ----
const MY_FLEET = [
  { name: 'Carrier', size: 5, cells: [11, 12, 13, 14, 15] },
  { name: 'Battleship', size: 4, cells: [37, 47, 57, 67] },
  { name: 'Cruiser', size: 3, cells: [60, 61, 62] },
  { name: 'Submarine', size: 3, cells: [82, 83, 84] },
  { name: 'Destroyer', size: 2, cells: [29, 39], sunk: true },
];
const SHOTS_AT_ME = [
  { cell: 29, hit: true }, { cell: 39, hit: true }, { cell: 13, hit: true }, { cell: 14, hit: true },
  { cell: 3, hit: false }, { cell: 45, hit: false }, { cell: 70, hit: false }, { cell: 88, hit: false },
  { cell: 52, hit: false }, { cell: 57, hit: true },
];
const MY_SHOTS = [
  { cell: 22, hit: false, sunk: '' }, { cell: 44, hit: true, sunk: '' }, { cell: 45, hit: true, sunk: '' },
  { cell: 46, hit: true, sunk: 'Cruiser' }, { cell: 7, hit: false, sunk: '' }, { cell: 71, hit: true, sunk: '' },
  { cell: 81, hit: true, sunk: '' }, { cell: 63, hit: false, sunk: '' }, { cell: 18, hit: false, sunk: '' },
  { cell: 96, hit: false, sunk: '' },
];

// ---- ladder: a made-up season ----
function mockSeason(now) {
  const thisMonth = now.getTime();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).getTime();
  const older = new Date(now.getFullYear(), now.getMonth() - 3, 10).getTime();
  const g = (type, winner, loser, finishedAt) => ({ type, status: 'over', players: [winner, loser], winner, finishedAt });
  return [
    g('chess', 'luke', 'layla', thisMonth), g('chess', 'luke', 'steven', thisMonth), g('pool', 'luke', 'logan', thisMonth),
    g('checkers', 'layla', 'lazarus', thisMonth), g('battleship', 'layla', 'abi', thisMonth),
    g('pool', 'logan', 'lazarus', thisMonth), g('pool', 'logan', 'steven', thisMonth), g('battleship', 'logan', 'luke', thisMonth),
    g('chess', 'logan', 'lazarus', thisMonth),
    g('checkers', 'lazarus', 'abi', thisMonth), g('chess', 'steven', 'abi', thisMonth), g('battleship', 'abi', 'layla', thisMonth),
    g('chess', 'layla', 'luke', lastMonth), g('pool', 'layla', 'logan', lastMonth), g('checkers', 'layla', 'steven', lastMonth),
    g('pool', 'luke', 'abi', lastMonth), g('chess', 'luke', 'abi', lastMonth), g('pool', 'abi', 'logan', lastMonth),
    g('chess', 'steven', 'abi', older), g('pool', 'lazarus', 'logan', older), g('checkers', 'logan', 'lazarus', older),
  ];
}

const LOBBY_GAMES = [
  { id: 'a', type: 'chess', players: ['luke', 'layla'], status: 'active', turn: 'luke', awaiting: true },
  { id: 'b', type: 'battleship', players: ['luke', 'abi'], status: 'setup', turn: 'luke', awaiting: true },
  { id: 'c', type: 'pool', players: ['logan', 'luke'], status: 'active', turn: 'logan' },
  { id: 'd', type: 'checkers', players: ['luke', 'steven'], status: 'active', turn: 'steven' },
  { id: 'e', type: 'pool', players: ['luke', 'lazarus'], status: 'over', winner: 'luke' },
  { id: 'f', type: 'chess', players: ['luke', 'steven'], status: 'over', winner: 'steven' },
];

const SURFACES = {
  page: 'Light page',
  sheet: 'White sheet',
  dark: 'Dark theme',
};

export default function GameLab() {
  const [surface, setSurface] = useState('page');
  return (
    <div className={`lab lab-${surface}`}>
      <header className="lab-top">
        <h1>Game Lab</h1>
        <p>Sample states only — nothing on this page touches a real game.</p>
        <div className="lab-surfaces">
          {Object.entries(SURFACES).map(([key, label]) => (
            <button key={key} className={surface === key ? 'lab-on' : ''} onClick={() => setSurface(key)}>{label}</button>
          ))}
        </div>
      </header>

      <div className="lab-grid">
        <Panel title="Chess"><ChessLab /></Panel>
        <Panel title="Checkers"><CheckersLab /></Panel>
        <Panel title="Battleship"><BattleshipLab /></Panel>
        <Panel title="8-Ball Pool"><PoolLab /></Panel>
        <Panel title="Lobby">
          <div className="vs-wrap">
            <h4 className="vs-heading">⚡ Your move!</h4>
            <div className="vs-list">
              {LOBBY_GAMES.filter((g) => g.awaiting).map((g) => <GameRow key={g.id} game={g} me="luke" awaiting />)}
            </div>
            <h4 className="vs-heading">⏳ Waiting on them</h4>
            <div className="vs-list">
              {LOBBY_GAMES.filter((g) => !g.awaiting && g.status !== 'over').map((g) => <GameRow key={g.id} game={g} me="luke" />)}
            </div>
            <h4 className="vs-heading">🏁 Finished</h4>
            <div className="vs-list">
              {LOBBY_GAMES.filter((g) => g.status === 'over').map((g) => <GameRow key={g.id} game={g} me="luke" />)}
            </div>
            <h4 className="vs-heading">🎲 Start a new game</h4>
            <NewGameTiles onPick={() => {}} />
          </div>
        </Panel>
        <Panel title="Season ladder">
          <div className="vs-wrap">
            <LadderBoard
              ladder={buildLadder(mockSeason(new Date()), ROSTER)}
              me="luke"
              nameOf={(id) => NAMES[id] ?? id}
              avatarOf={avatarOf}
            />
          </div>
        </Panel>
        <Panel title="Break room picker">
          <BreakPicker onPick={() => {}} myTurnCount={2} />
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="lab-panel">
      <h2>{title}</h2>
      <div className="lab-body">{children}</div>
    </section>
  );
}

function ChessLab() {
  const sample = useMemo(chessSample, []);
  const [flipped, setFlipped] = useState(false);
  const [sel, setSel] = useState(sq('d8'));
  const [anim, setAnim] = useState(null);
  const { state, last, taken } = sample;
  const status = gameStatus(state);
  const targets = sel == null ? [] : legalMoves(state, sel).map((m) => m.to);

  // Replays the last move the way a live game animates an incoming one.
  function replay() {
    setAnim({ piece: state.board[last.to], from: last.from, to: last.to, at: 'from' });
    requestAnimationFrame(() => requestAnimationFrame(() => setAnim((a) => (a ? { ...a, at: 'to' } : a))));
    setTimeout(() => setAnim(null), 380);
  }
  // …and a capture, borrowing the knight-takes-pawn from earlier in the line.
  function replayCapture() {
    setAnim({ piece: 'wQ', from: last.from, to: last.to, at: 'from', captured: 'bN' });
    requestAnimationFrame(() => requestAnimationFrame(() => setAnim((a) => (a ? { ...a, at: 'to' } : a))));
    setTimeout(() => setAnim(null), 380);
  }

  return (
    <div className="vs-game">
      <CapturedTray pieces={taken.filter((p) => p[0] === 'b')} label="You've taken" />
      <BoardView
        kind="chess"
        board={state.board}
        flipped={flipped}
        sel={sel}
        targets={targets}
        lastFrom={last.from}
        lastTo={last.to}
        checkSquare={status.check ? state.board.indexOf(state.turn + 'K') : null}
        anim={anim}
        captureFx={anim?.captured ? { piece: anim.captured, at: anim.to } : null}
        onTap={(i) => setSel(state.board[i] ? i : null)}
      />
      <CapturedTray pieces={taken.filter((p) => p[0] === 'w')} label="Layla has taken" />
      <p className="chess-lastmove">You: Queen to f3 — check!</p>
      <div className="bs-actions">
        <button onClick={() => setFlipped((f) => !f)}>Flip board</button>
        <button onClick={replay}>Replay move</button>
        <button onClick={replayCapture}>Capture burst</button>
      </div>
      <p className="vs-hint">Tap any piece to see its legal-move dots.</p>
    </div>
  );
}

function CheckersLab() {
  const state = useMemo(checkersSample, []);
  const [sel, setSel] = useState(35);
  const targets = sel == null ? [] : movesFor(state, sel).map((m) => m.to);
  return (
    <div className="vs-game">
      <CheckerTray count={5} color="b" label="You've taken" />
      <BoardView
        kind="checkers"
        board={state.board}
        sel={sel}
        targets={targets}
        lastFrom={30}
        lastTo={44}
        onTap={(i) => setSel(state.board[i] ? i : null)}
      />
      <CheckerTray count={4} color="r" label="Dad has taken" />
      <p className="chess-lastmove">Dad: Crowned a king! 👑</p>
    </div>
  );
}

function BattleshipLab() {
  const [shots, setShots] = useState(MY_SHOTS);
  return (
    <div className="vs-game">
      <h4 className="bs-title">🎯 Mom's waters — fire away!</h4>
      <BattleGrid
        variant="radar"
        ships={revealSunk(shots)}
        shots={shots}
        live
        onFire={(cell) => setShots((s) => [...s, { cell, hit: cell % 3 === 0, sunk: '' }])}
      />
      <p className="vs-hint">You sank: Cruiser</p>
      <h4 className="bs-title">🚢 Your fleet</h4>
      <BattleGrid variant="sea" ships={MY_FLEET} shots={SHOTS_AT_ME} />
    </div>
  );
}

function PoolLab() {
  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  // A real break, so the sample is a table the engine itself produced.
  const [state, setState] = useState(() => takeShot(initialPool(), 0.03, 0.95).state);
  const [angle, setAngle] = useState(-0.5);
  const [power, setPower] = useState(0.6);
  const [locked, setLocked] = useState(false);
  const [anim, setAnim] = useState(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  function aimAt(e) {
    const { x, y } = poolPointAt(canvasRef.current, e);
    const cue = state.balls.find((b) => b.n === 0);
    if (cue) setAngle(Math.atan2(y - cue.y, x - cue.x));
  }

  function shoot() {
    const { state: next, frames } = takeShot(state, angle, power);
    setLocked(false);
    setState(next);
    let i = 0;
    setAnim(frames[0] ?? null);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      i += 1;
      if (i >= frames.length) {
        clearInterval(timerRef.current);
        setAnim(null);
        return;
      }
      setAnim(frames[i]);
    }, 22);
  }

  const balls = anim ?? state.balls;
  return (
    <div className="vs-game">
      <PoolCanvas
        canvasRef={canvasRef}
        balls={balls}
        aim={anim ? null : { angle, power }}
        locked={locked}
        onMouseMove={(e) => !locked && !anim && aimAt(e)}
        onClick={(e) => { if (locked) setLocked(false); else { aimAt(e); setLocked(true); } }}
        onTouchMove={(e) => !anim && aimAt(e)}
      />
      <PocketedRack balls={balls} />
      <div className="pool-controls">
        <span className="pool-lock-hint">
          {locked ? '🔒 Aim locked — click the table to re-aim' : 'Move over the table to aim, click to lock it in'}
        </span>
        <label>
          Power
          <input type="range" min="0.15" max="1" step="0.05" value={power} onChange={(e) => setPower(Number(e.target.value))} />
        </label>
        <button className="pool-shoot" onClick={shoot} disabled={!!anim}>🎱 Shoot!</button>
        <button className="pool-replay" onClick={() => setState(takeShot(initialPool(), 0.03, 0.95).state)}>Re-rack</button>
      </div>
    </div>
  );
}
