// Battleship on a 10x10 grid. Cell indices are flat 0..99 (row = i/10, col = i%10)
// because Firestore refuses nested arrays.
//
// Secrecy: a player's ship positions NEVER go in the shared game doc — they live
// in games/{id}/fleets/{studentId}, which security rules expose only to that kid.
// So the DEFENDER's device resolves each incoming shot against its own fleet and
// writes back only "hit" or "miss". Nobody can read the other fleet, even from
// the browser console.

export const GRID = 10;
export const CELLS = GRID * GRID;

export const SHIPS = [
  { name: 'Carrier', size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser', size: 3 },
  { name: 'Submarine', size: 3 },
  { name: 'Destroyer', size: 2 },
];

export const TOTAL_SHIP_CELLS = SHIPS.reduce((n, s) => n + s.size, 0); // 17

// Lay out a full fleet at random without overlaps or wrap-around.
// Each kid rolls their own fleet locally, so randomness here is harmless.
export function randomFleet() {
  const taken = new Set();
  const ships = [];

  for (const ship of SHIPS) {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * GRID);
      const col = Math.floor(Math.random() * GRID);
      // Keep the whole ship on one row (or column) — no wrapping at the edges.
      if (horizontal && col + ship.size > GRID) continue;
      if (!horizontal && row + ship.size > GRID) continue;

      const cells = [];
      for (let k = 0; k < ship.size; k++) {
        cells.push(horizontal ? row * GRID + col + k : (row + k) * GRID + col);
      }
      if (cells.some((c) => taken.has(c))) continue;

      cells.forEach((c) => taken.add(c));
      ships.push({ name: ship.name, size: ship.size, cells });
      placed = true;
    }
  }
  return { ships };
}

// Resolve one incoming shot against MY fleet. Returns what the shooter is told.
export function resolveShot(fleet, cell) {
  for (const ship of fleet.ships) {
    if (!ship.cells.includes(cell)) continue;
    return { hit: true, ship: ship.name };
  }
  return { hit: false, ship: null };
}

// Is a ship completely destroyed given every shot fired at me?
export function sunkShips(fleet, shotsAtMe) {
  const hits = new Set(shotsAtMe.filter((s) => s.hit).map((s) => s.cell));
  return fleet.ships.filter((ship) => ship.cells.every((c) => hits.has(c))).map((s) => s.name);
}

export function allSunk(fleet, shotsAtMe) {
  return sunkShips(fleet, shotsAtMe).length === SHIPS.length;
}

export function initialBattleship() {
  return {
    shotsA: [], // shots fired BY players[0], each { cell, hit, sunk (ship name or '') }
    shotsB: [], // shots fired BY players[1]
    pending: null, // { by: studentId, cell } awaiting the defender's device
    ready: {}, // { [studentId]: true } once a fleet is locked in
  };
}

export function cellName(i) {
  return `${String.fromCharCode(65 + (i % GRID))}${Math.floor(i / GRID) + 1}`;
}

// Where the ships I have sunk were lying, worked out from my own shots alone
// (the enemy fleet doc is never readable). The shot that finished a ship names
// it; the ship is the straight run of earlier hits through that cell. If two
// runs fit — ships lying side by side — the answer is left out rather than
// guessed, so the board never shows a ship somewhere it wasn't.
export function revealSunk(shots) {
  const used = new Set();
  const found = [];
  shots.forEach((shot, idx) => {
    if (!shot.sunk) return;
    const size = SHIPS.find((s) => s.name === shot.sunk)?.size;
    if (!size) return;
    const hits = new Set(
      shots.slice(0, idx + 1).filter((s) => s.hit && !used.has(s.cell)).map((s) => s.cell)
    );
    const row = Math.floor(shot.cell / GRID);
    const col = shot.cell % GRID;
    const fits = [];
    for (let k = 0; k < size; k++) {
      const across = [];
      const down = [];
      for (let j = 0; j < size; j++) {
        if (col - k + j >= 0 && col - k + j < GRID) across.push(row * GRID + col - k + j);
        if (row - k + j >= 0 && row - k + j < GRID) down.push((row - k + j) * GRID + col);
      }
      if (across.length === size && across.every((c) => hits.has(c))) fits.push(across);
      if (down.length === size && down.every((c) => hits.has(c))) fits.push(down);
    }
    if (fits.length !== 1) return;
    fits[0].forEach((c) => used.add(c));
    found.push({ name: shot.sunk, size, cells: fits[0], sunk: true });
  });
  return found;
}
