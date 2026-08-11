// Checkers, played on the dark squares of an 8x8 board.
// Board is a FLAT 64-array (Firestore rejects nested arrays): index 0 is the
// top-left square as red sees it, row = i/8, col = i%8.
// Pieces: 'r' | 'b' (men), 'R' | 'B' (kings), '' = empty.
// Red starts on the bottom rows and moves toward row 0; black moves the other way.

export const RED = 'r';
export const BLACK = 'b';

export function initialCheckers() {
  const board = Array(64).fill('');
  for (let i = 0; i < 64; i++) {
    const row = Math.floor(i / 8);
    const dark = (row + (i % 8)) % 2 === 1; // only dark squares hold pieces
    if (!dark) continue;
    if (row < 3) board[i] = BLACK;
    if (row > 4) board[i] = RED;
  }
  return { board, turn: RED, chain: null };
}

const isRed = (p) => p === 'r' || p === 'R';
const isBlack = (p) => p === 'b' || p === 'B';
const isKing = (p) => p === 'R' || p === 'B';
export const ownerOf = (p) => (isRed(p) ? RED : isBlack(p) ? BLACK : null);

function onBoard(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

// Which diagonal directions a piece may travel: men go forward only, kings both.
function directions(piece) {
  const forward = isRed(piece) ? -1 : 1; // red moves toward row 0
  return isKing(piece)
    ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
    : [[forward, -1], [forward, 1]];
}

// Legal destinations for one piece. Jumps and simple moves are returned
// together; the caller decides. During a multi-jump chain only jumps count.
export function movesFor(state, from, jumpsOnly = false) {
  const piece = state.board[from];
  if (!piece || ownerOf(piece) !== state.turn) return [];
  const row = Math.floor(from / 8);
  const col = from % 8;
  const out = [];

  for (const [dr, dc] of directions(piece)) {
    const r1 = row + dr;
    const c1 = col + dc;
    if (!onBoard(r1, c1)) continue;
    const over = state.board[r1 * 8 + c1];

    if (!over && !jumpsOnly) {
      out.push({ to: r1 * 8 + c1, jumped: null });
      continue;
    }
    // A jump needs an enemy piece adjacent and an empty square right behind it.
    if (over && ownerOf(over) !== state.turn) {
      const r2 = row + dr * 2;
      const c2 = col + dc * 2;
      if (onBoard(r2, c2) && !state.board[r2 * 8 + c2]) {
        out.push({ to: r2 * 8 + c2, jumped: r1 * 8 + c1 });
      }
    }
  }
  return out;
}

// Squares whose piece can move right now. Mid-chain, only the jumping piece may go.
export function movablePieces(state) {
  if (state.chain !== null) return [state.chain];
  const out = [];
  for (let i = 0; i < 64; i++) {
    if (ownerOf(state.board[i]) === state.turn && movesFor(state, i).length) out.push(i);
  }
  return out;
}

export function applyCheckersMove(state, from, to) {
  const move = movesFor(state, from, state.chain !== null).find((m) => m.to === to);
  if (!move) return state;

  const board = [...state.board];
  let piece = board[from];
  board[from] = '';
  if (move.jumped !== null) board[move.jumped] = '';

  // Crowning ends your turn even if another jump looks available — standard rule.
  const landedRow = Math.floor(to / 8);
  let crowned = false;
  if (!isKing(piece) && ((isRed(piece) && landedRow === 0) || (isBlack(piece) && landedRow === 7))) {
    piece = piece.toUpperCase();
    crowned = true;
  }
  board[to] = piece;

  // A jumper that can jump again keeps the turn (chained capture).
  const next = { board, turn: state.turn, chain: null };
  if (move.jumped !== null && !crowned && movesFor({ ...next, chain: to }, to, true).length) {
    return { ...next, chain: to };
  }
  return { board, turn: state.turn === RED ? BLACK : RED, chain: null };
}

export function checkersStatus(state) {
  let red = 0;
  let black = 0;
  for (const p of state.board) {
    if (isRed(p)) red++;
    else if (isBlack(p)) black++;
  }
  if (red === 0) return { over: true, winner: BLACK, label: 'Black wins — all red pieces captured!' };
  if (black === 0) return { over: true, winner: RED, label: 'Red wins — all black pieces captured!' };
  // No legal move on your turn means you lose, the standard checkers rule.
  if (movablePieces(state).length === 0) {
    const winner = state.turn === RED ? BLACK : RED;
    return { over: true, winner, label: `${winner === RED ? 'Red' : 'Black'} wins — no moves left!` };
  }
  return { over: false, winner: null, label: '', red, black };
}
