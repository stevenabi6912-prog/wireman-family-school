import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GAME_TYPES, watchMyGames, createGame, saveGame, deleteGame, resignGame,
  saveFleet, loadFleet,
} from '../lib/versus';
import { initialChess, legalMoves, applyMove, gameStatus, moveLabel, PIECE_GLYPH } from '../lib/games/chess';
import {
  initialCheckers, movesFor, movablePieces, applyCheckersMove, checkersStatus, ownerOf, RED,
} from '../lib/games/checkers';
import {
  initialBattleship, randomFleet, resolveShot, sunkShips, allSunk, cellName, GRID, CELLS, SHIPS,
} from '../lib/games/battleship';
import { initialPool, takeShot, ballColor, isStripe, remainingFor, TABLE } from '../lib/games/pool';
import { playDing, playFanfare } from '../lib/sounds';
import { resolveTheme } from '../config/themes';
import { PEOPLE, displayName, isParentId } from '../config/students';
import './VersusGames.css';

// Mom and Dad are opponents too, so the roster is the whole family — anyone
// with a login can be challenged, and the games work the same either way.
const ROSTER = Object.keys(PEOPLE);
const NAMES = Object.fromEntries(ROSTER.map((id) => [id, displayName(id)]));
const avatarOf = (id) => (isParentId(id) ? PEOPLE[id].emoji : resolveTheme(id).avatar);

// ============================ Lobby ============================
export default function VersusGames({ studentId, large }) {
  const [games, setGames] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [newType, setNewType] = useState(null);

  useEffect(() => watchMyGames(studentId, setGames), [studentId]);

  const open = games?.find((g) => g.id === openId);
  if (open) {
    return (
      <div className="vs-wrap">
        <button className="vs-back" onClick={() => setOpenId(null)}>&larr; All games</button>
        <GameBoard game={open} studentId={studentId} large={large} onFinished={() => setOpenId(null)} />
      </div>
    );
  }

  const yourTurn = (games ?? []).filter((g) => g.status !== 'over' && awaitingMe(g, studentId));
  const waiting = (games ?? []).filter((g) => g.status !== 'over' && !awaitingMe(g, studentId));
  const finished = (games ?? []).filter((g) => g.status === 'over').slice(0, 4);

  async function start(type, opponent) {
    const state =
      type === 'chess' ? initialChess()
      : type === 'checkers' ? initialCheckers()
      : type === 'pool' ? initialPool()
      : initialBattleship();
    const id = await createGame({
      type,
      players: [studentId, opponent],
      state,
      status: type === 'battleship' ? 'setup' : 'active',
    });
    setNewType(null);
    setOpenId(id);
  }

  return (
    <div className="vs-wrap">
      {games === null ? <p className="vs-hint">Loading your games…</p> : (
        <>
          {yourTurn.length > 0 && (
            <>
              <h4 className="vs-heading">⚡ Your move!</h4>
              <div className="vs-list">
                {yourTurn.map((g) => <GameRow key={g.id} game={g} me={studentId} onOpen={() => setOpenId(g.id)} awaiting />)}
              </div>
            </>
          )}
          {waiting.length > 0 && (
            <>
              <h4 className="vs-heading">⏳ Waiting on them</h4>
              <div className="vs-list">
                {waiting.map((g) => <GameRow key={g.id} game={g} me={studentId} onOpen={() => setOpenId(g.id)} />)}
              </div>
            </>
          )}
          {finished.length > 0 && (
            <>
              <h4 className="vs-heading">🏁 Finished</h4>
              <div className="vs-list">
                {finished.map((g) => <GameRow key={g.id} game={g} me={studentId} onOpen={() => setOpenId(g.id)} />)}
              </div>
            </>
          )}

          {!newType ? (
            <div className="vs-newgrid">
              {Object.entries(GAME_TYPES).map(([key, t]) => (
                <button key={key} className="vs-newbtn" onClick={() => setNewType(key)}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="vs-newgrid">
              <span className="vs-hint">Who do you want to play {GAME_TYPES[newType].label} against?</span>
              {ROSTER.filter((k) => k !== studentId).map((k) => (
                <button key={k} className="vs-newbtn" onClick={() => start(newType, k)}>
                  {avatarOf(k)} {NAMES[k]}
                </button>
              ))}
              <button className="vs-cancel" onClick={() => setNewType(null)}>cancel</button>
            </div>
          )}
          {(games?.length ?? 0) === 0 && (
            <p className="vs-hint">No games yet — start one above. Challenge a sibling, or take on Mom or Dad; they play their turn when they get a minute.</p>
          )}
        </>
      )}
    </div>
  );
}

// Battleship's setup phase isn't turn-based — both players place their fleet
// independently — so "your move" has to mean "you haven't locked yours in"
// there, not "game.turn === you" (which defaults to player 1 and would tell
// the WRONG person to act, or tell nobody anything useful, until both are in).
function awaitingMe(game, studentId) {
  if (game.status === 'over') return false;
  if (game.type === 'battleship' && game.status === 'setup') {
    return !game.state?.ready?.[studentId];
  }
  return game.turn === studentId;
}

function GameRow({ game, me, onOpen, awaiting }) {
  const them = game.players.find((p) => p !== me) ?? '?';
  const t = GAME_TYPES[game.type] ?? { emoji: '🎲', label: game.type };
  const settingUp = game.type === 'battleship' && game.status === 'setup';
  return (
    <button className={`vs-row ${awaiting ? 'vs-row-turn' : ''}`} onClick={onOpen}>
      <span className="vs-row-title">{t.emoji} vs {avatarOf(them)} {NAMES[them] ?? them}</span>
      <span className="vs-row-meta">
        {game.status === 'over'
          ? (game.winner === me ? '🏆 You won!' : game.winner ? 'They won' : 'Draw')
          : settingUp
            ? (awaiting ? 'Place your fleet' : "Waiting on their fleet")
            : awaiting ? 'Your move' : 'Waiting'}
      </span>
    </button>
  );
}

function GameBoard({ game, studentId, large, onFinished }) {
  const props = { game, studentId, large, onFinished };
  if (game.type === 'chess') return <ChessGame {...props} />;
  if (game.type === 'checkers') return <CheckersGame {...props} />;
  if (game.type === 'battleship') return <BattleshipGame {...props} />;
  if (game.type === 'pool') return <PoolGame {...props} />;
  return null;
}

// Shared header: who's who, whose turn, last move, resign/rematch.
function Banner({ game, studentId, statusLabel }) {
  const them = game.players.find((p) => p !== studentId);
  const settingUp = game.type === 'battleship' && game.status === 'setup';
  const awaiting = awaitingMe(game, studentId);
  return (
    <div className="vs-banner">
      <span className="vs-vs">
        {avatarOf(studentId)} You vs {avatarOf(them)} {NAMES[them]}
      </span>
      <span className={`vs-turn ${awaiting ? 'vs-turn-mine' : ''}`}>
        {game.status === 'over'
          ? (game.winner === studentId ? '🏆 You won!' : game.winner ? `${NAMES[them]} won` : 'Draw')
          : settingUp
            ? (awaiting ? '⚓ Place your fleet!' : `Waiting for ${NAMES[them]} to place their fleet`)
            : awaiting ? '⚡ Your move' : `Waiting for ${NAMES[them]}`}
      </span>
      {statusLabel && <span className="vs-status">{statusLabel}</span>}
      {game.lastMove && <span className="vs-last">Last: {game.lastMove}</span>}
    </div>
  );
}

function EndActions({ game, studentId }) {
  const them = game.players.find((p) => p !== studentId);
  if (game.status === 'over') {
    return <button className="vs-resign" onClick={() => deleteGame(game.id)}>🗑 Clear this game</button>;
  }
  return (
    <button
      className="vs-resign"
      onClick={() => window.confirm('Give up this game?') && resignGame(game.id, studentId, them)}
    >
      🏳️ Resign
    </button>
  );
}

// ============================ Chess ============================
function ChessGame({ game, studentId, large }) {
  const [sel, setSel] = useState(null);
  const state = game.state;
  const iAmWhite = game.players[0] === studentId;
  const myColor = iAmWhite ? 'w' : 'b';
  const myTurn = game.turn === studentId && game.status !== 'over';
  const status = useMemo(() => gameStatus(state), [state]);

  const targets = useMemo(
    () => (sel === null || !myTurn ? [] : legalMoves(state, sel)),
    [sel, state, myTurn]
  );

  // Black sees the board from their own side.
  const order = useMemo(() => {
    const idx = Array.from({ length: 64 }, (_, i) => i);
    return iAmWhite ? idx : idx.reverse();
  }, [iAmWhite]);

  async function tap(i) {
    if (!myTurn) return;
    const piece = state.board[i];
    if (sel !== null) {
      const move = targets.find((m) => m.to === i);
      if (move) {
        const label = moveLabel(state, sel, i, 'Q');
        const next = applyMove(state, sel, i, 'Q');
        const after = gameStatus(next);
        setSel(null);
        playDing();
        if (after.checkmate || after.draw) playFanfare();
        await saveGame(game.id, {
          state: next,
          turn: after.checkmate || after.draw ? game.turn : game.players.find((p) => p !== studentId),
          lastMove: label + (after.checkmate ? ' — checkmate!' : after.check ? ' — check!' : ''),
          status: after.checkmate || after.draw ? 'over' : 'active',
          winner: after.checkmate ? studentId : null,
        });
        return;
      }
    }
    setSel(piece && piece[0] === myColor ? i : null);
  }

  return (
    <div className="vs-game">
      <Banner game={game} studentId={studentId} statusLabel={status.label} />
      <div className={`chess-board ${large ? 'chess-large' : ''}`}>
        {order.map((i) => {
          const row = Math.floor(i / 8);
          const light = (row + (i % 8)) % 2 === 0;
          const piece = state.board[i];
          const isTarget = targets.some((m) => m.to === i);
          return (
            <button
              key={i}
              className={`chess-sq ${light ? 'sq-light' : 'sq-dark'} ${sel === i ? 'sq-sel' : ''} ${isTarget ? 'sq-target' : ''}`}
              onClick={() => tap(i)}
            >
              <span className={piece && piece[0] === 'w' ? 'pc-white' : 'pc-black'}>
                {piece ? PIECE_GLYPH[piece] : ''}
              </span>
              {isTarget && <i className="sq-dot" />}
            </button>
          );
        })}
      </div>
      <p className="vs-hint">You are {iAmWhite ? 'White (you moved first)' : 'Black'}. Tap a piece, then tap where it goes.</p>
      <EndActions game={game} studentId={studentId} />
    </div>
  );
}

// ============================ Checkers ============================
function CheckersGame({ game, studentId, large }) {
  const [sel, setSel] = useState(null);
  const state = game.state;
  const iAmRed = game.players[0] === studentId;
  const myColor = iAmRed ? 'r' : 'b';
  const myTurn = game.turn === studentId && game.status !== 'over';
  const status = useMemo(() => checkersStatus(state), [state]);

  const targets = useMemo(
    () => (sel === null || !myTurn ? [] : movesFor(state, sel, state.chain !== null)),
    [sel, state, myTurn]
  );
  const movable = useMemo(() => (myTurn ? movablePieces(state) : []), [state, myTurn]);

  const order = useMemo(() => {
    const idx = Array.from({ length: 64 }, (_, i) => i);
    return iAmRed ? idx : idx.reverse();
  }, [iAmRed]);

  // A chained jump keeps the same player on move — auto-select the jumper.
  useEffect(() => {
    if (state.chain !== null && myTurn) setSel(state.chain);
  }, [state.chain, myTurn]);

  async function tap(i) {
    if (!myTurn) return;
    if (sel !== null) {
      const move = targets.find((m) => m.to === i);
      if (move) {
        const next = applyCheckersMove(state, sel, i);
        const after = checkersStatus(next);
        playDing();
        if (after.over) playFanfare();
        // chain === same player continues; otherwise hand over the turn
        const keepGoing = next.chain !== null;
        setSel(keepGoing ? next.chain : null);
        await saveGame(game.id, {
          state: next,
          turn: after.over || keepGoing ? game.turn : game.players.find((p) => p !== studentId),
          lastMove: move.jumped !== null ? 'Jumped a piece!' : 'Moved',
          status: after.over ? 'over' : 'active',
          winner: after.over ? (after.winner === myColor ? studentId : game.players.find((p) => p !== studentId)) : null,
        });
        return;
      }
    }
    setSel(ownerOf(state.board[i]) === myColor && movable.includes(i) ? i : null);
  }

  return (
    <div className="vs-game">
      <Banner game={game} studentId={studentId} statusLabel={status.label} />
      <div className={`chess-board ${large ? 'chess-large' : ''}`}>
        {order.map((i) => {
          const row = Math.floor(i / 8);
          const dark = (row + (i % 8)) % 2 === 1;
          const piece = state.board[i];
          const isTarget = targets.some((m) => m.to === i);
          return (
            <button
              key={i}
              className={`chess-sq ${dark ? 'sq-dark' : 'sq-light'} ${sel === i ? 'sq-sel' : ''} ${isTarget ? 'sq-target' : ''}`}
              onClick={() => tap(i)}
            >
              {piece && (
                <span className={`ck-piece ${ownerOf(piece) === RED ? 'ck-red' : 'ck-black'}`}>
                  {piece === piece.toUpperCase() ? '♛' : ''}
                </span>
              )}
              {isTarget && <i className="sq-dot" />}
            </button>
          );
        })}
      </div>
      <p className="vs-hint">
        You are {iAmRed ? 'Red' : 'Black'}. {state.chain !== null && myTurn ? 'Keep jumping — you can go again!' : 'Tap a piece, then tap where it goes.'}
      </p>
      <EndActions game={game} studentId={studentId} />
    </div>
  );
}

// ============================ Battleship ============================
function BattleshipGame({ game, studentId, large }) {
  const [fleet, setFleet] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const state = game.state;
  const me = studentId;
  const them = game.players.find((p) => p !== me);
  const iAmA = game.players[0] === me;
  const myShots = iAmA ? state.shotsA : state.shotsB;
  const theirShots = iAmA ? state.shotsB : state.shotsA;
  const iAmReady = !!state.ready?.[me];

  useEffect(() => {
    loadFleet(game.id, me).then((f) => {
      setFleet(f);
      if (!f) setDraft(randomFleet());
    });
  }, [game.id, me]);

  // The defender's device resolves an incoming shot — it is the only device
  // that can see this fleet, which is exactly what keeps the ships secret.
  useEffect(() => {
    const pending = state.pending;
    if (!pending || pending.by === me || !fleet || busy) return;
    (async () => {
      setBusy(true);
      try {
        const result = resolveShot(fleet, pending.cell);
        const theirs = [...theirShots, { cell: pending.cell, hit: result.hit }];
        const sunk = sunkShips(fleet, theirs);
        const lost = allSunk(fleet, theirs);
        await saveGame(game.id, {
          state: {
            ...state,
            [iAmA ? 'shotsB' : 'shotsA']: theirs.map((s, idx) =>
              idx === theirs.length - 1
                ? { ...s, sunk: result.hit && sunk.includes(result.ship) ? result.ship : '' }
                : s
            ),
            pending: null,
          },
          turn: lost ? game.turn : me,
          status: lost ? 'over' : 'active',
          winner: lost ? them : null,
          lastMove: `${NAMES[them]} fired at ${cellName(pending.cell)} — ${result.hit ? 'HIT!' : 'miss'}`,
        });
      } catch (err) {
        // A dropped write here would otherwise leave `busy` stuck true forever —
        // the pending shot never resolves and the game looks permanently frozen.
        console.error('battleship shot resolution failed, will retry on next render:', err);
      } finally {
        setBusy(false);
      }
    })();
  }, [state.pending, fleet]); // eslint-disable-line react-hooks/exhaustive-deps

  async function lockFleet() {
    await saveFleet(game.id, me, draft);
    setFleet(draft);
    const ready = { ...(state.ready ?? {}), [me]: true };
    const bothIn = game.players.every((p) => ready[p]);
    await saveGame(game.id, {
      state: { ...state, ready },
      status: bothIn ? 'active' : 'setup',
      lastMove: bothIn ? 'Battle stations — fire!' : 'Fleet ready…',
    });
  }

  async function fire(cell) {
    if (game.turn !== me || game.status !== 'active' || state.pending) return;
    if (myShots.some((s) => s.cell === cell)) return;
    playDing();
    await saveGame(game.id, {
      state: { ...state, pending: { by: me, cell } },
      turn: them,
      lastMove: `You fired at ${cellName(cell)}…`,
    });
  }

  if (!fleet && draft) {
    const occupied = new Set(draft.ships.flatMap((s) => s.cells));
    return (
      <div className="vs-game">
        <Banner game={game} studentId={studentId} />
        <p className="vs-hint">Place your fleet! Shuffle until you like it, then lock it in.</p>
        <div className="bs-grid">
          {Array.from({ length: CELLS }, (_, i) => (
            <span key={i} className={`bs-cell ${occupied.has(i) ? 'bs-ship' : ''}`} />
          ))}
        </div>
        <div className="bs-actions">
          <button onClick={() => setDraft(randomFleet())}>🔀 Shuffle my fleet</button>
          <button className="bs-lock" onClick={lockFleet}>🔒 Lock it in!</button>
        </div>
      </div>
    );
  }

  const myTurn = game.turn === me && game.status === 'active' && !state.pending;
  const hitsOnMe = new Set(theirShots.filter((s) => s.hit).map((s) => s.cell));
  const missesOnMe = new Set(theirShots.filter((s) => !s.hit).map((s) => s.cell));
  const myFleetCells = new Set((fleet?.ships ?? []).flatMap((s) => s.cells));
  const sunkByMe = myShots.map((s) => s.sunk).filter(Boolean);

  return (
    <div className="vs-game">
      <Banner game={game} studentId={studentId} />
      {game.status === 'setup' ? (
        <p className="vs-hint">🔒 Fleet locked. Waiting for {NAMES[them]} to place their ships…</p>
      ) : (
        <>
          <h4 className="bs-title">🎯 {NAMES[them]}'s waters {myTurn ? '— fire away!' : ''}</h4>
          <div className={`bs-grid ${myTurn ? 'bs-live' : ''}`}>
            {Array.from({ length: CELLS }, (_, i) => {
              const shot = myShots.find((s) => s.cell === i);
              return (
                <button
                  key={i}
                  className={`bs-cell ${shot ? (shot.hit ? 'bs-hit' : 'bs-miss') : ''}`}
                  onClick={() => fire(i)}
                  disabled={!myTurn || !!shot}
                >
                  {shot ? (shot.hit ? '💥' : '·') : ''}
                </button>
              );
            })}
          </div>
          {sunkByMe.length > 0 && <p className="vs-hint">You sank: {sunkByMe.join(', ')}</p>}

          <h4 className="bs-title">🚢 Your fleet</h4>
          <div className="bs-grid bs-mine">
            {Array.from({ length: CELLS }, (_, i) => (
              <span
                key={i}
                className={`bs-cell ${myFleetCells.has(i) ? 'bs-ship' : ''} ${hitsOnMe.has(i) ? 'bs-hit' : missesOnMe.has(i) ? 'bs-miss' : ''}`}
              >
                {hitsOnMe.has(i) ? '💥' : missesOnMe.has(i) ? '·' : ''}
              </span>
            ))}
          </div>
        </>
      )}
      <EndActions game={game} studentId={studentId} />
    </div>
  );
}

// ============================ Pool ============================
function PoolGame({ game, studentId, large }) {
  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  const [angle, setAngle] = useState(0);
  const [power, setPower] = useState(0.6);
  const [anim, setAnim] = useState(null); // frames being played

  // The break can end mid-animation; don't leave a timer running behind us.
  useEffect(() => () => clearInterval(timerRef.current), []);
  const state = game.state;
  const meIndex = game.players.indexOf(studentId);
  const them = game.players.find((p) => p !== studentId);
  const myTurn = game.turn === studentId && game.status !== 'over' && !anim;

  const balls = anim ?? state.balls;

  // Draw the table, the balls, and the aim line.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    const scale = cv.width / TABLE.w;
    g.clearRect(0, 0, cv.width, cv.height);

    g.fillStyle = '#0b6b3a';
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#06210f';
    for (const p of TABLE.pockets) {
      g.beginPath();
      g.arc(p.x * scale, p.y * scale, TABLE.pocketR * scale, 0, Math.PI * 2);
      g.fill();
    }

    for (const b of balls) {
      if (b.in) continue;
      const x = b.x * scale;
      const y = b.y * scale;
      const r = TABLE.r * scale;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = ballColor(b.n);
      g.fill();
      if (isStripe(b.n)) {
        g.save();
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.clip();
        g.fillStyle = '#fff';
        g.fillRect(x - r, y - r, r * 2, r * 0.55);
        g.fillRect(x - r, y + r * 0.45, r * 2, r * 0.55);
        g.restore();
      }
      g.strokeStyle = 'rgba(0,0,0,.35)';
      g.stroke();
      if (b.n !== 0) {
        g.fillStyle = isStripe(b.n) || b.n === 8 ? '#fff' : '#000';
        g.font = `bold ${r}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = b.n === 8 ? '#fff' : '#000';
        g.fillText(String(b.n), x, y);
      }
    }

    // aim line from the cue ball
    const cue = balls.find((b) => b.n === 0);
    if (myTurn && cue && !cue.in) {
      g.strokeStyle = 'rgba(255,255,255,.85)';
      g.lineWidth = 2;
      g.setLineDash([6, 5]);
      g.beginPath();
      g.moveTo(cue.x * scale, cue.y * scale);
      g.lineTo((cue.x + Math.cos(angle) * 30 * power + 6 * Math.cos(angle)) * scale,
               (cue.y + Math.sin(angle) * 30 * power + 6 * Math.sin(angle)) * scale);
      g.stroke();
      g.setLineDash([]);
    }
  }, [balls, angle, power, myTurn]);

  // Aim by tapping/dragging anywhere on the felt.
  function aimAt(e) {
    if (!myTurn) return;
    const cv = canvasRef.current;
    const rect = cv.getBoundingClientRect();
    const p = e.touches?.[0] ?? e;
    const x = ((p.clientX - rect.left) / rect.width) * TABLE.w;
    const y = ((p.clientY - rect.top) / rect.height) * TABLE.h;
    const cue = state.balls.find((b) => b.n === 0);
    if (!cue) return;
    setAngle(Math.atan2(y - cue.y, x - cue.x));
  }

  // Roll the stored frames past the eye. Cosmetic only — the shot is already
  // saved, so a break timing out mid-animation costs nothing.
  function play(frames) {
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

  async function shoot() {
    if (!myTurn) return;
    // Keep ONE snapshot for the replay button — dropping the old snapshot first,
    // otherwise every shot would nest the whole history inside the doc.
    const { prev: _dropped, ...prev } = state;
    const { state: next, frames } = takeShot(state, angle, power);
    playDing();
    play(frames);

    // Save straight away: the turn must survive the break timer running out.
    const over = next.phase === 'over';
    if (over) playFanfare();
    await saveGame(game.id, {
      state: { ...next, prev },
      turn: game.players[next.turn] ?? game.turn,
      status: over ? 'over' : 'active',
      winner: over ? (game.players[next.winner] ?? null) : null,
      lastMove: next.message,
    });
  }

  // Watch what your sibling just did — the physics are deterministic, so
  // re-simulating their stored shot reproduces it exactly.
  function replay() {
    if (!state.prev || !state.lastShot) return;
    play(takeShot(state.prev, state.lastShot.angle, state.lastShot.power).frames);
  }

  const myGroup = state.groups?.[String(meIndex)];
  return (
    <div className="vs-game">
      <Banner game={game} studentId={studentId} statusLabel={state.message} />
      <p className="vs-hint">
        {myGroup ? `You're ${myGroup} — ${remainingFor(state, meIndex)} left, then the 8-ball.` : 'Table is open — sink one to claim solids or stripes!'}
      </p>
      <canvas
        ref={canvasRef}
        className="pool-canvas"
        width={600}
        height={300}
        onMouseMove={aimAt}
        onClick={aimAt}
        onTouchMove={aimAt}
      />
      {myTurn ? (
        <div className="pool-controls">
          <label>
            Power
            <input type="range" min="0.15" max="1" step="0.05" value={power} onChange={(e) => setPower(Number(e.target.value))} />
          </label>
          <button className="pool-shoot" onClick={shoot}>🎱 Shoot!</button>
        </div>
      ) : (
        <div className="pool-controls">
          {state.prev && state.lastShot && (
            <button className="pool-replay" onClick={replay} disabled={!!anim}>
              ▶ Replay {NAMES[them]}'s shot
            </button>
          )}
        </div>
      )}
      <p className="vs-hint">Move your finger (or mouse) over the table to aim, set the power, then shoot.</p>
      <EndActions game={game} studentId={studentId} />
    </div>
  );
}
