// Presentational boards for the versus games. Everything here is driven by
// props — no Firestore, no game rules — so the live games and the GameLab
// review page render exactly the same markup.

import { ownerOf, RED } from '../../lib/games/checkers';
import { GRID, CELLS } from '../../lib/games/battleship';
import { ChessPiece, CrownMark } from './ChessPieces';
import './GameBoards.css';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// ============================ 8x8 boards ============================

export function Checker({ piece, className = '' }) {
  const king = piece === piece.toUpperCase();
  return (
    <span className={`ck-piece ${ownerOf(piece) === RED ? 'ck-red' : 'ck-black'} ${king ? 'ck-king' : ''} ${className}`}>
      {king && <CrownMark className="ck-crown" />}
    </span>
  );
}

function BoardPiece({ kind, piece }) {
  return kind === 'chess' ? <ChessPiece piece={piece} /> : <Checker piece={piece} />;
}

// `board` is the flat 64-array both engines use. `flipped` shows it from the
// second player's side. `anim` is the piece in flight ({ piece, from, to, at })
// and `captureFx` the piece bursting off the board ({ piece, at }).
export function BoardView({
  kind, board, flipped = false, large = false,
  sel = null, targets = [], lastFrom = null, lastTo = null, checkSquare = null,
  anim = null, captureFx = null, onTap,
}) {
  const order = Array.from({ length: 64 }, (_, i) => (flipped ? 63 - i : i));
  const coords = (sq) => {
    const pos = flipped ? 63 - sq : sq;
    return { left: `${(pos % 8) * 12.5}%`, top: `${Math.floor(pos / 8) * 12.5}%` };
  };
  const ranks = Array.from({ length: 8 }, (_, r) => (flipped ? r + 1 : 8 - r));
  const files = flipped ? [...FILES].reverse() : FILES;

  return (
    <div className={`chess-wrap board-${kind} ${large ? 'chess-large' : ''}`}>
      <div className="board-ranks" aria-hidden="true">
        {ranks.map((r) => <span key={r}>{kind === 'chess' ? r : ''}</span>)}
      </div>
      <div className="board-inner">
        <div className="chess-board">
          {order.map((i) => {
            const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
            const piece = board[i];
            const isTarget = targets.includes(i);
            const shown = piece && !(anim && anim.to === i);
            return (
              <button
                key={i}
                className={[
                  'chess-sq',
                  dark ? 'sq-dark' : 'sq-light',
                  sel === i ? 'sq-sel' : '',
                  isTarget ? 'sq-target' : '',
                  isTarget && piece ? 'sq-capture' : '',
                  lastFrom === i ? 'sq-lastfrom' : '',
                  lastTo === i ? 'sq-lastto' : '',
                  checkSquare === i ? 'sq-check' : '',
                ].join(' ')}
                onClick={onTap ? () => onTap(i) : undefined}
              >
                {shown && <BoardPiece kind={kind} piece={piece} />}
                {isTarget && <i className="sq-dot" />}
              </button>
            );
          })}
        </div>

        {anim && (
          <span className="chess-anim-piece" style={coords(anim.at === 'from' ? anim.from : anim.to)}>
            <BoardPiece kind={kind} piece={anim.piece} />
          </span>
        )}

        {captureFx && (
          <span className="chess-capture-fx" style={coords(captureFx.at)}>
            <BoardPiece kind={kind} piece={captureFx.piece} />
            <i className="capture-ring" />
          </span>
        )}
      </div>
      <div className="board-files" aria-hidden="true">
        {files.map((f) => <span key={f}>{kind === 'chess' ? f : ''}</span>)}
      </div>
    </div>
  );
}

export function CapturedTray({ pieces, label }) {
  if (!pieces.length) return null;
  return (
    <div className="captured-tray">
      <span className="captured-label">{label}:</span>
      <span className="captured-pieces">
        {pieces.map((p, i) => <ChessPiece key={i} piece={p} className="cp-small" />)}
      </span>
    </div>
  );
}

export function CheckerTray({ count, color, label }) {
  if (!count) return null;
  return (
    <div className="captured-tray">
      <span className="captured-label">{label}:</span>
      <span className="captured-pieces">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={`ck-taken ${color === RED ? 'ck-red' : 'ck-black'}`} />
        ))}
      </span>
    </div>
  );
}

// ============================ Battleship ============================

// Top-down hull, drawn 10 units per cell along its length. Each class of ship
// gets its own deck so the fleet reads as five different vessels.
function ShipArt({ name, size }) {
  const L = size * 10;
  const hull = `M1.6 5 Q1.6 2.1 4.6 2.1 H${L - 7} Q${L - 2.4} 2.6 ${L - 1} 5 Q${L - 2.4} 7.4 ${L - 7} 7.9 H4.6 Q1.6 7.9 1.6 5 Z`;
  const turret = (x, dir = 1) => (
    <g key={`t${x}`}>
      <path d={`M${x} 5 h${2.6 * dir}`} className="ship-gun" />
      <circle cx={x} cy="5" r="1.25" className="ship-deck" />
    </g>
  );
  let deck;
  if (name === 'Carrier') {
    deck = (
      <>
        <path d={`M5 3.2 H${L - 8} V6.8 H5 Z`} className="ship-flight" />
        <path d={`M6.5 5 H${L - 9}`} className="ship-stripe" />
        <rect x={L * 0.52} y="1.6" width="6" height="1.9" rx="0.6" className="ship-deck" />
      </>
    );
  } else if (name === 'Submarine') {
    deck = (
      <>
        <ellipse cx={L * 0.48} cy="5" rx="3.4" ry="1.5" className="ship-deck" />
        <path d={`M${L * 0.48} 5 h3.2`} className="ship-gun" />
        <path d="M2.2 3.4 v3.2" className="ship-gun" />
      </>
    );
  } else {
    const bridgeW = size >= 4 ? 8 : size === 3 ? 6 : 4;
    const bx = L / 2 - bridgeW / 2 - 1;
    deck = (
      <>
        <rect x={bx} y="3.3" width={bridgeW} height="3.4" rx="0.8" className="ship-deck" />
        <circle cx={bx + bridgeW / 2} cy="5" r="0.9" className="ship-stack" />
        {turret(L - 9)}
        {size >= 3 && turret(5.8, -1)}
        {size >= 4 && turret(L - 13.5)}
      </>
    );
  }
  return (
    <>
      <path d={hull} className="ship-hull" />
      <path d={`M3.4 3.1 H${L - 7.5} Q${L - 4} 3.5 ${L - 2.8} 5`} className="ship-rim" />
      {deck}
    </>
  );
}

// Small picture of each game for lobby rows and the new-game tiles.
export function GameIcon({ type }) {
  return (
    <span className={`game-icon game-icon-${type}`} aria-hidden="true">
      {type === 'chess' && <ChessPiece piece="wN" />}
      {type === 'checkers' && <Checker piece="R" />}
      {type === 'battleship' && (
        <svg viewBox="0 0 30 10" focusable="false"><ShipArt name="Cruiser" size={3} /></svg>
      )}
      {type === 'pool' && <span className="pool-chip" style={{ '--ball': '#1a1a1a' }}><b>8</b></span>}
    </span>
  );
}

function ShipSprite({ ship }) {
  const cells = [...ship.cells].sort((a, b) => a - b);
  const size = cells.length;
  const horizontal = size < 2 || cells[1] - cells[0] === 1;
  const row = Math.floor(cells[0] / GRID);
  const col = cells[0] % GRID;
  const L = size * 10;
  const style = {
    left: `${col * 10}%`,
    top: `${row * 10}%`,
    width: `${(horizontal ? size : 1) * 10}%`,
    height: `${(horizontal ? 1 : size) * 10}%`,
  };
  return (
    <svg
      className={`bs-shipart ${ship.sunk ? 'bs-shipart-sunk' : ''}`}
      style={style}
      viewBox={horizontal ? `0 0 ${L} 10` : `0 0 10 ${L}`}
      aria-hidden="true"
      focusable="false"
    >
      <g transform={horizontal ? undefined : 'translate(10 0) rotate(90)'}>
        <ShipArt name={ship.name} size={size} />
      </g>
    </svg>
  );
}

function Flame() {
  return (
    <svg className="bs-flame" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M10 1.5 C11 5 15.5 6.5 15.5 11.5 a5.5 5.5 0 0 1 -11 0 C4.5 9 6 7.5 6.8 6 C7.5 7.5 8 8 8.6 8.2 C8.4 5.5 9 3.2 10 1.5 Z"
        fill="#ff6a1a"
        stroke="#b3260a"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <path
        d="M10 8.3 c1 2 2.8 2.8 2.8 5 a2.8 2.8 0 0 1 -5.6 0 c0-1.4 0.8-2 1.3-2.9 c0.4 0.6 0.7 0.8 1.1 0.9 c-0.1-1 0.1-2.1 0.4-3 z"
        fill="#ffd84a"
      />
      <ellipse cx="10" cy="14" rx="1.3" ry="1.7" fill="#fff8d6" />
    </svg>
  );
}

// variant 'radar' is the targeting screen, 'sea' is open water with a fleet.
// `ships` are drawn as silhouettes ({ name, cells, sunk }); `shots` are the
// shots fired AT this grid ({ cell, hit }). With `onFire` the cells are buttons.
export function BattleGrid({ variant = 'sea', ships = [], shots = [], live = false, onFire }) {
  const shotAt = new Map(shots.map((s) => [s.cell, s]));
  return (
    <div className={`bs-board bs-${variant} ${live ? 'bs-live' : ''}`}>
      <span className="bs-corner" />
      <div className="bs-cols" aria-hidden="true">
        {Array.from({ length: GRID }, (_, i) => <span key={i}>{String.fromCharCode(65 + i)}</span>)}
      </div>
      <div className="bs-rows" aria-hidden="true">
        {Array.from({ length: GRID }, (_, i) => <span key={i}>{i + 1}</span>)}
      </div>
      <div className="bs-field">
        <i className="bs-fx" />
        <div className="bs-ships">
          {ships.map((s) => <ShipSprite key={s.name} ship={s} />)}
        </div>
        <div className="bs-grid">
          {Array.from({ length: CELLS }, (_, i) => {
            const shot = shotAt.get(i);
            const cls = `bs-cell ${shot ? (shot.hit ? 'bs-hit' : 'bs-miss') : ''}`;
            const mark = shot ? (shot.hit ? <Flame /> : <i className="bs-splash" />) : null;
            return onFire ? (
              <button key={i} className={cls} onClick={() => onFire(i)} disabled={!live || !!shot}>
                {mark}
              </button>
            ) : (
              <span key={i} className={cls}>{mark}</span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
