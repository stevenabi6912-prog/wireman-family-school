import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GAME_TYPES, watchMyGames, watchFinishedGames, createGame, saveGame, clearGame, resignGame,
  saveFleet, loadFleet, awaitingMe,
} from '../lib/versus';
import { initialChess, legalMoves, applyMove, gameStatus, moveLabel } from '../lib/games/chess';
import {
  initialCheckers, movesFor, movablePieces, applyCheckersMove, checkersStatus, ownerOf,
} from '../lib/games/checkers';
import {
  initialBattleship, randomFleet, resolveShot, sunkShips, allSunk, cellName, revealSunk,
} from '../lib/games/battleship';
import { initialPool, takeShot, remainingFor } from '../lib/games/pool';
import { buildLadder } from '../lib/games/ladder';
import { BoardView, CapturedTray, CheckerTray, BattleGrid, GameIcon } from './games/Boards';
import { ROSTER, NAMES, avatarOf, GameRow, NewGameTiles } from './games/Lobby';
import { ChessPiece } from './games/ChessPieces';
import { PoolCanvas, PocketedRack, poolPointAt } from './games/PoolTable';
import { LadderBoard } from './games/Ladder';
import { playDing, playFanfare } from '../lib/sounds';
import './VersusGames.css';

// ============================ Lobby ============================
export default function VersusGames({ studentId, large }) {
  const [games, setGames] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [newType, setNewType] = useState(null);

  // Family-wide finished games for the ladder; null until they arrive. If the
  // read is refused (a student before the ladder rule is live) the ladder
  // falls back to the games this player was in.
  const [familyFinished, setFamilyFinished] = useState(null);
  const [ladderDenied, setLadderDenied] = useState(false);

  useEffect(() => watchMyGames(studentId, setGames), [studentId]);
  useEffect(() => watchFinishedGames(setFamilyFinished, () => setLadderDenied(true)), []);

  const ladder = useMemo(
    () => buildLadder(familyFinished ?? (games ?? []).filter((g) => g.status === 'over'), ROSTER),
    [familyFinished, games]
  );

  const open = games?.find((g) => g.id === openId && !g.cleared);
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
  const finished = (games ?? []).filter((g) => g.status === 'over' && !g.cleared).slice(0, 4);

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

          <h4 className="vs-heading">🎲 Start a new game</h4>
          {!newType ? (
            <NewGameTiles onPick={setNewType} />
          ) : (
            <div className="vs-pick">
              <span className="vs-pick-title">
                <GameIcon type={newType} /> Who do you want to play {GAME_TYPES[newType].label} against?
              </span>
              <div className="vs-pick-people">
                {ROSTER.filter((k) => k !== studentId).map((k) => (
                  <button key={k} className="vs-person" onClick={() => start(newType, k)}>
                    <span className="vs-person-avatar">{avatarOf(k)}</span>
                    {NAMES[k]}
                  </button>
                ))}
              </div>
              <button className="vs-cancel" onClick={() => setNewType(null)}>cancel</button>
            </div>
          )}
          {(games ?? []).filter((g) => !g.cleared).length === 0 && (
            <p className="vs-hint">No games yet — start one above. Challenge a sibling, or take on Mom or Dad; they play their turn when they get a minute.</p>
          )}

          <LadderBoard
            ladder={ladder}
            me={studentId}
            nameOf={(id) => NAMES[id] ?? id}
            avatarOf={avatarOf}
            partial={ladderDenied}
          />
        </>
      )}
    </div>
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
      {/* Chess and checkers print a richer last-move line under their boards
          (who moved, and what it took), so don't say it twice. */}
      {game.lastMove && game.type !== 'chess' && game.type !== 'checkers' && (
        <span className="vs-last">Last: {game.lastMove}</span>
      )}
    </div>
  );
}

function EndActions({ game, studentId }) {
  const them = game.players.find((p) => p !== studentId);
  if (game.status === 'over') {
    return <button className="vs-resign" onClick={() => clearGame(game.id)}>🗑 Clear this game</button>;
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
// Material at the start of a game, so captured pieces can be derived by
// diffing the live board instead of maintaining a separate list.
const START_MATERIAL = { P: 8, N: 2, B: 2, R: 2, Q: 1 };

function capturedPieces(board, color) {
  const alive = {};
  for (const p of board) {
    if (p && p[0] === color) alive[p[1]] = (alive[p[1]] ?? 0) + 1;
  }
  const gone = [];
  for (const [kind, n] of Object.entries(START_MATERIAL)) {
    for (let k = 0; k < n - (alive[kind] ?? 0); k++) gone.push(color + kind);
  }
  return gone;
}

function ChessGame({ game, studentId, large }) {
  const [sel, setSel] = useState(null);
  const [anim, setAnim] = useState(null); // { piece, from, to, at } mid-slide
  const seenMove = useRef(null);
  const state = game.state;
  const iAmWhite = game.players[0] === studentId;
  const myColor = iAmWhite ? 'w' : 'b';
  const myTurn = game.turn === studentId && game.status !== 'over';
  const status = useMemo(() => gameStatus(state), [state]);

  const targets = useMemo(
    () => (sel === null || !myTurn ? [] : legalMoves(state, sel)),
    [sel, state, myTurn]
  );

  // Slide the piece that just moved. The board already holds the NEW position,
  // so the destination square is left blank while an overlay travels into it —
  // that reads as movement without ever rendering a stale board.
  useEffect(() => {
    const { lastFrom, lastTo, moveSeq } = game;
    if (lastFrom == null || lastTo == null || moveSeq == null) return undefined;
    if (seenMove.current === moveSeq) return undefined;
    seenMove.current = moveSeq;

    const piece = state.board[lastTo];
    if (!piece) return undefined;
    setAnim({ piece, from: lastFrom, to: lastTo, at: 'from' });
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => {
      setAnim((a) => (a ? { ...a, at: 'to' } : a));
    }));
    const done = setTimeout(() => setAnim(null), 380);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, [game.moveSeq, game.lastFrom, game.lastTo, state.board]);

  async function tap(i) {
    if (!myTurn) return;
    const piece = state.board[i];
    if (sel !== null) {
      const move = targets.find((m) => m.to === i);
      if (move) {
        const label = moveLabel(state, sel, i, 'Q');
        // What this move takes off the board — the occupant of the target
        // square, or the pawn beside it on an en-passant capture.
        const captured = move.ep
          ? state.board[i + (state.board[sel][0] === 'w' ? 8 : -8)]
          : state.board[i] || null;
        const next = applyMove(state, sel, i, 'Q');
        const after = gameStatus(next);
        setSel(null);
        playDing();
        if (after.checkmate || after.draw) playFanfare();
        await saveGame(game.id, {
          state: next,
          turn: after.checkmate || after.draw ? game.turn : game.players.find((p) => p !== studentId),
          lastMove: label + (after.checkmate ? ' — checkmate!' : after.check ? ' — check!' : ''),
          lastFrom: sel,
          lastTo: i,
          lastCaptured: captured || null,
          lastBy: studentId,
          moveSeq: (game.moveSeq ?? 0) + 1,
          status: after.checkmate || after.draw ? 'over' : 'active',
          winner: after.checkmate ? studentId : null,
        });
        return;
      }
    }
    setSel(piece && piece[0] === myColor ? i : null);
  }

  const myLoss = capturedPieces(state.board, myColor);
  const theirLoss = capturedPieces(state.board, myColor === 'w' ? 'b' : 'w');
  const them = game.players.find((p) => p !== studentId);

  return (
    <div className="vs-game">
      <Banner game={game} studentId={studentId} statusLabel={status.label} />

      <CapturedTray pieces={theirLoss} label={`You've taken`} />

      {/* Black sees the board from their own side. */}
      <BoardView
        kind="chess"
        board={state.board}
        flipped={!iAmWhite}
        large={large}
        sel={sel}
        targets={targets.map((m) => m.to)}
        lastFrom={game.lastFrom}
        lastTo={game.lastTo}
        checkSquare={status.check ? state.board.indexOf((state.turn === 'b' ? 'b' : 'w') + 'K') : null}
        anim={anim}
        captureFx={anim && game.lastCaptured ? { piece: game.lastCaptured, at: anim.to } : null}
        onTap={tap}
      />

      <CapturedTray pieces={myLoss} label={`${NAMES[them]} has taken`} />

      {game.lastMove && (
        <p className="chess-lastmove">
          {/* Games that predate lastBy still attribute correctly: whoever is
              NOT on move made the last move. */}
          {(game.lastBy ?? (game.turn === studentId ? them : studentId)) === studentId ? 'You' : NAMES[them]}: {game.lastMove}
          {game.lastCaptured && (
            <span className="chess-took"> — took <ChessPiece piece={game.lastCaptured} className="cp-inline" /></span>
          )}
        </p>
      )}

      <p className="vs-hint">You are {iAmWhite ? 'White (you moved first)' : 'Black'}. Tap a piece, then tap where it goes.</p>
      <EndActions game={game} studentId={studentId} />
    </div>
  );
}

// ============================ Checkers ============================
// Checkers starts with 12 a side, so captures are just the shortfall.
function checkersCaptured(board, color) {
  let alive = 0;
  for (const p of board) if (p && ownerOf(p) === color) alive++;
  return Math.max(0, 12 - alive);
}

function CheckersGame({ game, studentId, large }) {
  const [sel, setSel] = useState(null);
  const [anim, setAnim] = useState(null); // { piece, from, to, at }
  const seenMove = useRef(null);
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

  // A chained jump keeps the same player on move — auto-select the jumper.
  useEffect(() => {
    if (state.chain !== null && myTurn) setSel(state.chain);
  }, [state.chain, myTurn]);

  // Slide the piece that just moved, same approach as chess: the board holds
  // the new position and an overlay travels into the empty destination.
  useEffect(() => {
    const { lastFrom, lastTo, moveSeq } = game;
    if (lastFrom == null || lastTo == null || moveSeq == null) return undefined;
    if (seenMove.current === moveSeq) return undefined;
    seenMove.current = moveSeq;
    const piece = state.board[lastTo];
    if (!piece) return undefined;
    setAnim({ piece, from: lastFrom, to: lastTo, at: 'from' });
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => {
      setAnim((a) => (a ? { ...a, at: 'to' } : a));
    }));
    const done = setTimeout(() => setAnim(null), 380);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, [game.moveSeq, game.lastFrom, game.lastTo, state.board]);

  async function tap(i) {
    if (!myTurn) return;
    if (sel !== null) {
      const move = targets.find((m) => m.to === i);
      if (move) {
        const jumpedPiece = move.jumped !== null ? state.board[move.jumped] : null;
        const wasKing = state.board[sel] === state.board[sel]?.toUpperCase();
        const next = applyCheckersMove(state, sel, i);
        const after = checkersStatus(next);
        playDing();
        if (after.over) playFanfare();
        // chain === same player continues; otherwise hand over the turn
        const keepGoing = next.chain !== null;
        const crowned = !wasKing && next.board[i] === next.board[i]?.toUpperCase();
        setSel(keepGoing ? next.chain : null);
        await saveGame(game.id, {
          state: next,
          turn: after.over || keepGoing ? game.turn : game.players.find((p) => p !== studentId),
          lastMove: crowned
            ? 'Crowned a king! 👑'
            : move.jumped !== null
              ? (keepGoing ? 'Jumped — and going again!' : 'Jumped a piece!')
              : 'Moved',
          lastFrom: sel,
          lastTo: i,
          lastCaptured: jumpedPiece || null,
          lastCapturedAt: move.jumped ?? null,
          lastBy: studentId,
          moveSeq: (game.moveSeq ?? 0) + 1,
          status: after.over ? 'over' : 'active',
          winner: after.over ? (after.winner === myColor ? studentId : game.players.find((p) => p !== studentId)) : null,
        });
        return;
      }
    }
    setSel(ownerOf(state.board[i]) === myColor && movable.includes(i) ? i : null);
  }

  const them = game.players.find((p) => p !== studentId);
  const theirColor = myColor === 'r' ? 'b' : 'r';
  const iTook = checkersCaptured(state.board, theirColor);
  const theyTook = checkersCaptured(state.board, myColor);

  return (
    <div className="vs-game">
      <Banner game={game} studentId={studentId} statusLabel={status.label} />

      <CheckerTray count={iTook} color={theirColor} label="You've taken" />

      <BoardView
        kind="checkers"
        board={state.board}
        flipped={!iAmRed}
        large={large}
        sel={sel}
        targets={targets.map((m) => m.to)}
        lastFrom={game.lastFrom}
        lastTo={game.lastTo}
        anim={anim}
        captureFx={anim && game.lastCaptured && game.lastCapturedAt != null
          ? { piece: game.lastCaptured, at: game.lastCapturedAt }
          : null}
        onTap={tap}
      />

      <CheckerTray count={theyTook} color={myColor} label={`${NAMES[them]} has taken`} />

      {game.lastMove && (
        <p className="chess-lastmove">
          {/* lastBy is absent on games started before it existed; whoever is
              not on move made the last move. */}
          {(game.lastBy ?? (game.turn === studentId ? them : studentId)) === studentId ? 'You' : NAMES[them]}: {game.lastMove}
        </p>
      )}

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
    return (
      <div className="vs-game">
        <Banner game={game} studentId={studentId} />
        <p className="vs-hint">Place your fleet! Shuffle until you like it, then lock it in.</p>
        <BattleGrid variant="sea" ships={draft.ships} />
        <div className="bs-actions">
          <button onClick={() => setDraft(randomFleet())}>🔀 Shuffle my fleet</button>
          <button className="bs-lock" onClick={lockFleet}>🔒 Lock it in!</button>
        </div>
      </div>
    );
  }

  const myTurn = game.turn === me && game.status === 'active' && !state.pending;
  const sunkByMe = myShots.map((s) => s.sunk).filter(Boolean);
  const myLost = fleet ? sunkShips(fleet, theirShots) : [];
  const myShips = (fleet?.ships ?? []).map((s) => ({ ...s, sunk: myLost.includes(s.name) }));

  return (
    <div className="vs-game">
      <Banner game={game} studentId={studentId} />
      {game.status === 'setup' ? (
        <p className="vs-hint">🔒 Fleet locked. Waiting for {NAMES[them]} to place their ships…</p>
      ) : (
        <>
          <h4 className="bs-title">🎯 {NAMES[them]}'s waters {myTurn ? '— fire away!' : ''}</h4>
          <BattleGrid variant="radar" ships={revealSunk(myShots)} shots={myShots} live={myTurn} onFire={fire} />
          {sunkByMe.length > 0 && <p className="vs-hint">You sank: {sunkByMe.join(', ')}</p>}

          <h4 className="bs-title">🚢 Your fleet</h4>
          <BattleGrid variant="sea" ships={myShips} shots={theirShots} />
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
  const [locked, setLocked] = useState(false); // aim pinned by a click

  // The break can end mid-animation; don't leave a timer running behind us.
  useEffect(() => () => clearInterval(timerRef.current), []);
  const state = game.state;
  const meIndex = game.players.indexOf(studentId);
  const them = game.players.find((p) => p !== studentId);
  const myTurn = game.turn === studentId && game.status !== 'over' && !anim;

  const balls = anim ?? state.balls;

  function angleAt(e) {
    const { x, y } = poolPointAt(canvasRef.current, e);
    const cue = state.balls.find((b) => b.n === 0);
    return cue ? Math.atan2(y - cue.y, x - cue.x) : null;
  }

  // Hovering previews the aim; it used to keep tracking the mouse right up
  // until you dragged off the table, which was the only way to hold it
  // still. A click now locks the angle in place — click again to unlock and
  // re-aim. Touch has no hover state, so dragging a finger always aims.
  function previewAim(e) {
    if (!myTurn || locked) return;
    const a = angleAt(e);
    if (a != null) setAngle(a);
  }

  function clickAim(e) {
    if (!myTurn) return;
    if (locked) {
      setLocked(false);
      return;
    }
    const a = angleAt(e);
    if (a != null) setAngle(a);
    setLocked(true);
  }

  function touchAim(e) {
    if (!myTurn) return;
    const a = angleAt(e);
    if (a != null) setAngle(a);
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
    setLocked(false); // next turn starts free-aiming again
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
      <PoolCanvas
        canvasRef={canvasRef}
        balls={balls}
        aim={myTurn ? { angle, power } : null}
        locked={locked}
        onMouseMove={previewAim}
        onClick={clickAim}
        onTouchMove={touchAim}
      />
      <PocketedRack balls={balls} />
      {myTurn ? (
        <div className="pool-controls">
          <span className="pool-lock-hint">
            {locked ? '🔒 Aim locked — click the table to re-aim' : 'Move over the table to aim, click to lock it in'}
          </span>
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
      <p className="vs-hint">On a touchscreen, drag your finger across the table to aim.</p>
      <EndActions game={game} studentId={studentId} />
    </div>
  );
}
