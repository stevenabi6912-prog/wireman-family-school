// Dependency-free chess rules engine.
//
// The whole state object is written straight into a Firestore document, and
// Firestore cannot store an array inside an array. So the board is a FLAT
// 64-element array of strings rather than the usual 8x8 nesting, and every
// other field is a plain JSON scalar / flat array / plain object. Nothing here
// may ever produce `undefined`, a Date, or a Map.
//
// Index math: index 0 is a8 (top-left from White's side), index 63 is h1.
//   row = Math.floor(i / 8)  -> row 0 is rank 8, row 7 is rank 1
//   col = i % 8              -> col 0 is file a, col 7 is file h
// Because rank 8 comes first, White advances toward LOWER indices (dir -1)
// and Black toward HIGHER indices (dir +1). Every "forward" below uses that.

export const PIECE_GLYPH = {
  wK: '♔',
  wQ: '♕',
  wR: '♖',
  wB: '♗',
  wN: '♘',
  wP: '♙',
  bK: '♚',
  bQ: '♛',
  bR: '♜',
  bB: '♝',
  bN: '♞',
  bP: '♟'
};

const PIECE_NAME = {
  P: 'Pawn',
  N: 'Knight',
  B: 'Bishop',
  R: 'Rook',
  Q: 'Queen',
  K: 'King'
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const KNIGHT_STEPS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1]
];
const DIAGONALS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTHOGONALS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const ALL_DIRS = ORTHOGONALS.concat(DIAGONALS);

// Home squares of the four castling rooks, used both for granting castling
// moves and for invalidating rights.
const ROOK_HOME = { 0: 'bq', 7: 'bk', 56: 'wq', 63: 'wk' };

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

function colorOf(piece) {
  return piece ? piece[0] : '';
}

function typeOf(piece) {
  return piece ? piece[1] : '';
}

function other(color) {
  return color === 'w' ? 'b' : 'w';
}

function onBoard(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function idx(row, col) {
  return row * 8 + col;
}

function isSquare(i) {
  return Number.isInteger(i) && i >= 0 && i < 64;
}

function findKing(board, color) {
  const king = color + 'K';
  for (let i = 0; i < 64; i++) {
    if (board[i] === king) return i;
  }
  return -1; // only reachable from a hand-built board with no king
}

/* ------------------------------------------------------------------ */
/* attack detection                                                    */
/* ------------------------------------------------------------------ */

// Is `square` attacked by any piece of color `by` on this board?
// Written as a reverse scan from the target square: cheaper than generating
// every enemy move, and it is called once per candidate move.
function isAttacked(board, square, by) {
  const r = Math.floor(square / 8);
  const c = square % 8;

  // Pawns. A white pawn attacks toward lower indices, so a white pawn that
  // hits `square` must be sitting on the row BELOW it (r + 1); black is the
  // mirror image.
  const pawnRow = by === 'w' ? r + 1 : r - 1;
  if (pawnRow >= 0 && pawnRow < 8) {
    const pawn = by + 'P';
    if (c - 1 >= 0 && board[idx(pawnRow, c - 1)] === pawn) return true;
    if (c + 1 < 8 && board[idx(pawnRow, c + 1)] === pawn) return true;
  }

  const knight = by + 'N';
  for (let k = 0; k < KNIGHT_STEPS.length; k++) {
    const nr = r + KNIGHT_STEPS[k][0];
    const nc = c + KNIGHT_STEPS[k][1];
    if (onBoard(nr, nc) && board[idx(nr, nc)] === knight) return true;
  }

  const king = by + 'K';
  for (let k = 0; k < ALL_DIRS.length; k++) {
    const nr = r + ALL_DIRS[k][0];
    const nc = c + ALL_DIRS[k][1];
    if (onBoard(nr, nc) && board[idx(nr, nc)] === king) return true;
  }

  // Sliding pieces: walk each ray until it leaves the board or hits something.
  for (let k = 0; k < ORTHOGONALS.length; k++) {
    const dr = ORTHOGONALS[k][0];
    const dc = ORTHOGONALS[k][1];
    let nr = r + dr;
    let nc = c + dc;
    while (onBoard(nr, nc)) {
      const p = board[idx(nr, nc)];
      if (p) {
        if (colorOf(p) === by && (typeOf(p) === 'R' || typeOf(p) === 'Q')) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }
  for (let k = 0; k < DIAGONALS.length; k++) {
    const dr = DIAGONALS[k][0];
    const dc = DIAGONALS[k][1];
    let nr = r + dr;
    let nc = c + dc;
    while (onBoard(nr, nc)) {
      const p = board[idx(nr, nc)];
      if (p) {
        if (colorOf(p) === by && (typeOf(p) === 'B' || typeOf(p) === 'Q')) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  return false;
}

function kingAttacked(board, color) {
  const k = findKing(board, color);
  if (k < 0) return false;
  return isAttacked(board, k, other(color));
}

/* ------------------------------------------------------------------ */
/* move generation                                                     */
/* ------------------------------------------------------------------ */

function mv(from, to, capture, castle, ep, promotion) {
  return { from: from, to: to, capture: capture, castle: castle, ep: ep, promotion: promotion };
}

// Pseudo-legal moves for the piece on `from`: correct in every way except
// that they may leave the mover's own king in check. legalMoves() filters.
function pseudoMoves(state, from) {
  const board = state.board;
  const piece = board[from];
  if (!piece) return [];

  const color = colorOf(piece);
  const type = typeOf(piece);
  const foe = other(color);
  const r = Math.floor(from / 8);
  const c = from % 8;
  const out = [];

  if (type === 'P') {
    const dir = color === 'w' ? -1 : 1; // white climbs toward index 0
    const startRow = color === 'w' ? 6 : 1;
    const promoRow = color === 'w' ? 0 : 7;
    const fr = r + dir;

    if (fr >= 0 && fr < 8) {
      // Single push, then double push (only from the home row, and only if
      // BOTH squares are empty).
      if (board[idx(fr, c)] === '') {
        out.push(mv(from, idx(fr, c), false, null, false, fr === promoRow));
        if (r === startRow) {
          const dr2 = r + 2 * dir;
          if (board[idx(dr2, c)] === '') {
            out.push(mv(from, idx(dr2, c), false, null, false, false));
          }
        }
      }
      for (let d = -1; d <= 1; d += 2) {
        const nc = c + d;
        if (!onBoard(fr, nc)) continue;
        const t = idx(fr, nc);
        const target = board[t];
        if (target && colorOf(target) === foe) {
          out.push(mv(from, t, true, null, false, fr === promoRow));
        } else if (target === '' && state.ep !== null && t === state.ep) {
          // En passant: the target square is empty; the pawn we capture is
          // beside us, on the square the enemy pawn actually occupies.
          out.push(mv(from, t, true, null, true, false));
        }
      }
    }
    return out;
  }

  if (type === 'N' || type === 'K') {
    const steps = type === 'N' ? KNIGHT_STEPS : ALL_DIRS;
    for (let k = 0; k < steps.length; k++) {
      const nr = r + steps[k][0];
      const nc = c + steps[k][1];
      if (!onBoard(nr, nc)) continue;
      const t = idx(nr, nc);
      const target = board[t];
      if (target && colorOf(target) === color) continue;
      out.push(mv(from, t, target !== '', null, false, false));
    }

    if (type === 'K') {
      const home = color === 'w' ? 60 : 4; // e1 / e8
      const rights = state.castling || {};
      const kSide = color === 'w' ? rights.wk : rights.bk;
      const qSide = color === 'w' ? rights.wq : rights.bq;
      const rook = color + 'R';
      // A king may never castle out of check, and never through an attacked
      // square. The landing square is covered by the legality filter below,
      // but the other two must be checked here.
      if (from === home && (kSide || qSide) && !isAttacked(board, home, foe)) {
        if (kSide && board[home + 3] === rook &&
            board[home + 1] === '' && board[home + 2] === '' &&
            !isAttacked(board, home + 1, foe)) {
          out.push(mv(from, home + 2, false, 'K', false, false));
        }
        // Queenside also needs the b-file square (home - 3) empty: the rook
        // slides across it even though the king never touches it.
        if (qSide && board[home - 4] === rook &&
            board[home - 1] === '' && board[home - 2] === '' && board[home - 3] === '' &&
            !isAttacked(board, home - 1, foe)) {
          out.push(mv(from, home - 2, false, 'Q', false, false));
        }
      }
    }
    return out;
  }

  let dirs;
  if (type === 'B') dirs = DIAGONALS;
  else if (type === 'R') dirs = ORTHOGONALS;
  else dirs = ALL_DIRS; // queen

  for (let k = 0; k < dirs.length; k++) {
    const dr = dirs[k][0];
    const dc = dirs[k][1];
    let nr = r + dr;
    let nc = c + dc;
    while (onBoard(nr, nc)) {
      const t = idx(nr, nc);
      const target = board[t];
      if (target === '') {
        out.push(mv(from, t, false, null, false, false));
      } else {
        if (colorOf(target) !== color) out.push(mv(from, t, true, null, false, false));
        break;
      }
      nr += dr;
      nc += dc;
    }
  }
  return out;
}

function normalizePromotion(promotion) {
  return promotion === 'R' || promotion === 'B' || promotion === 'N' ? promotion : 'Q';
}

// Apply a move to a copy of the board only (no rights/counters). Used both by
// the legality filter and by applyMove.
function boardAfter(board, move, promotion) {
  const next = board.slice();
  const piece = next[move.from];
  const color = colorOf(piece);

  next[move.from] = '';

  if (move.ep) {
    // The captured pawn is NOT on the destination square: it is one rank
    // behind it from the capturer's point of view.
    next[move.to + (color === 'w' ? 8 : -8)] = '';
  }

  next[move.to] = move.promotion ? color + normalizePromotion(promotion) : piece;

  // Castling moves two pieces. The king has already landed on `to`; slide the
  // corner rook to the square the king crossed.
  if (move.castle === 'K') {
    next[move.to + 1] = '';
    next[move.to - 1] = color + 'R';
  } else if (move.castle === 'Q') {
    next[move.to - 2] = '';
    next[move.to + 1] = color + 'R';
  }

  return next;
}

function legalFrom(state, from) {
  const piece = state.board[from];
  if (!piece) return [];
  const color = colorOf(piece);
  const candidates = pseudoMoves(state, from);
  const legal = [];
  for (let i = 0; i < candidates.length; i++) {
    const m = candidates[i];
    // Promotion choice can never change whether the king is safe, so testing
    // with a queen is enough.
    if (!kingAttacked(boardAfter(state.board, m, 'Q'), color)) legal.push(m);
  }
  return legal;
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

export function initialChess() {
  const board = new Array(64).fill('');
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let c = 0; c < 8; c++) {
    board[c] = 'b' + back[c];       // row 0 = rank 8
    board[8 + c] = 'bP';            // row 1 = rank 7
    board[48 + c] = 'wP';           // row 6 = rank 2
    board[56 + c] = 'w' + back[c];  // row 7 = rank 1
  }
  return {
    board: board,
    turn: 'w',
    castling: { wk: true, wq: true, bk: true, bq: true },
    ep: null,
    halfmove: 0,
    fullmove: 1
  };
}

export function legalMoves(state, from) {
  if (!state || !Array.isArray(state.board) || !isSquare(from)) return [];
  const piece = state.board[from];
  if (!piece || colorOf(piece) !== state.turn) return [];
  return legalFrom(state, from).map(function (m) {
    return { to: m.to, capture: m.capture, castle: m.castle, ep: m.ep, promotion: m.promotion };
  });
}

export function allLegalMoves(state) {
  if (!state || !Array.isArray(state.board)) return [];
  const out = [];
  for (let i = 0; i < 64; i++) {
    const piece = state.board[i];
    if (!piece || colorOf(piece) !== state.turn) continue;
    const moves = legalFrom(state, i);
    for (let k = 0; k < moves.length; k++) {
      const m = moves[k];
      out.push({ from: m.from, to: m.to, capture: m.capture, castle: m.castle, ep: m.ep, promotion: m.promotion });
    }
  }
  return out;
}

export function applyMove(state, from, to, promotion) {
  if (!state || !Array.isArray(state.board) || !isSquare(from) || !isSquare(to)) return state;
  const piece = state.board[from];
  if (!piece || colorOf(piece) !== state.turn) return state;

  let move = null;
  const moves = legalFrom(state, from);
  for (let i = 0; i < moves.length; i++) {
    if (moves[i].to === to) { move = moves[i]; break; }
  }
  if (!move) return state;

  const color = state.turn;
  const board = boardAfter(state.board, move, promotion);
  const rights = {
    wk: !!state.castling.wk,
    wq: !!state.castling.wq,
    bk: !!state.castling.bk,
    bq: !!state.castling.bq
  };

  // Rights die when the king moves at all, when a rook leaves its corner, and
  // when a rook is captured on its corner. The last case is easy to forget:
  // the loser never "moved", so we key off the destination square instead.
  if (typeOf(piece) === 'K') {
    if (color === 'w') { rights.wk = false; rights.wq = false; }
    else { rights.bk = false; rights.bq = false; }
  }
  if (ROOK_HOME[from]) rights[ROOK_HOME[from]] = false;
  if (ROOK_HOME[to]) rights[ROOK_HOME[to]] = false;

  // A double pawn push is the only thing that creates an en-passant target,
  // and the target is the square it skipped over.
  let ep = null;
  if (typeOf(piece) === 'P' && Math.abs(to - from) === 16) ep = (from + to) / 2;

  const resetClock = typeOf(piece) === 'P' || move.capture;

  return {
    board: board,
    turn: other(color),
    castling: rights,
    ep: ep,
    halfmove: resetClock ? 0 : (state.halfmove || 0) + 1,
    fullmove: (state.fullmove || 1) + (color === 'b' ? 1 : 0)
  };
}

export function inCheck(state, color) {
  if (!state || !Array.isArray(state.board)) return false;
  return kingAttacked(state.board, color === 'b' ? 'b' : 'w');
}

function insufficientMaterial(board) {
  const minors = [];
  let count = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    count++;
    const t = typeOf(p);
    if (t === 'P' || t === 'R' || t === 'Q') return false;
    if (t === 'B' || t === 'N') minors.push(t);
  }
  // Only the three cases the app cares about: bare kings, or a lone bishop or
  // knight against a bare king.
  if (count === 2) return true;
  return count === 3 && minors.length === 1;
}

export function gameStatus(state) {
  const result = {
    check: false,
    checkmate: false,
    stalemate: false,
    draw: false,
    winner: null,
    label: ''
  };
  if (!state || !Array.isArray(state.board)) return result;

  const turn = state.turn === 'b' ? 'b' : 'w';
  const mover = turn === 'w' ? 'White' : 'Black';
  const check = kingAttacked(state.board, turn);
  const hasMove = allLegalMoves(state).length > 0;

  result.check = check;
  result.checkmate = check && !hasMove;
  result.stalemate = !check && !hasMove;

  const fiftyMove = (state.halfmove || 0) >= 100;
  const thin = insufficientMaterial(state.board);
  result.draw = result.stalemate || fiftyMove || thin;

  if (result.checkmate) {
    const winner = other(turn);
    result.winner = winner;
    result.label = 'Checkmate — ' + (winner === 'w' ? 'White' : 'Black') + ' wins!';
  } else if (result.stalemate) {
    result.label = 'Stalemate — it’s a draw!';
  } else if (thin) {
    result.label = 'Draw — not enough pieces left to checkmate!';
  } else if (fiftyMove) {
    result.label = 'Draw — 50 moves with no capture or pawn move!';
  } else if (check) {
    result.label = mover + ' is in check!';
  }

  return result;
}

export function squareName(i) {
  if (!isSquare(i)) return '';
  // Row 0 holds rank 8, so the rank number counts down as the row goes up.
  return FILES[i % 8] + String(8 - Math.floor(i / 8));
}

export function moveLabel(state, from, to, promotion) {
  if (!state || !Array.isArray(state.board) || !isSquare(from) || !isSquare(to)) return '';
  const piece = state.board[from];
  if (!piece) return '';

  const type = typeOf(piece);
  const name = PIECE_NAME[type] || 'Piece';
  const target = state.board[to];
  const fromCol = from % 8;
  const toCol = to % 8;
  const toRow = Math.floor(to / 8);

  if (type === 'K' && Math.abs(toCol - fromCol) === 2) {
    return toCol > fromCol ? 'Castles kingside' : 'Castles queenside';
  }

  const enPassant = type === 'P' && target === '' && fromCol !== toCol && state.ep !== null && to === state.ep;
  const capture = target !== '' || enPassant;
  const promotes = type === 'P' && (toRow === 0 || toRow === 7);
  const promoted = PIECE_NAME[normalizePromotion(promotion)];

  if (promotes) {
    if (capture) return 'Pawn takes ' + squareName(to) + ' and promotes to ' + promoted;
    return 'Pawn promotes to ' + promoted;
  }
  if (enPassant) return 'Pawn takes ' + squareName(to) + ' en passant';
  if (capture) return name + ' takes ' + squareName(to);
  return name + ' ' + squareName(from) + '→' + squareName(to);
}
