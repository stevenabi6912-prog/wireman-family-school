// Correspondence 8-ball: one shot per person per turn, played across two devices.
//
// The whole engine is DETERMINISTIC. Both devices re-simulate the same shot from
// the same stored state and must land on bit-identical positions, so there is no
// Math.random(), no Date.now(), no time-based stepping — fixed timestep only.
//
// Determinism also rules out Math.sin/Math.cos: the spec leaves their precision up
// to the engine, so Safari and Chrome may disagree in the last bits. We use our own
// polynomial sin/cos below, built only from +, -, * and /, which IEEE-754 pins down
// exactly. Math.sqrt is safe (correctly rounded by spec) and so are abs/min/max/round.
//
// The state object is written straight into a Firestore document, so: no nested
// arrays (an array of plain objects is fine), no undefined, no class instances,
// and every number is rounded to keep NaN/Infinity out.

export const TABLE = {
  w: 100,
  h: 50,
  r: 1.4,
  pocketR: 2.6,
  pockets: [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 50 },
    { x: 50, y: 50 },
    { x: 100, y: 50 },
  ],
};

const W = TABLE.w;
const H = TABLE.h;
const R = TABLE.r;
const POCKET_R = TABLE.pocketR;
const POCKETS = TABLE.pockets;

const CUE_X = 25;
const CUE_Y = 25;
const APEX_X = 75;
const APEX_Y = 25;

// Physics constants. DT is small enough that the fastest ball moves 0.67 units per
// step — far less than a ball diameter (2.8) — so nothing can tunnel through anything.
const DT = 1 / 240;
const MIN_SHOT = 20; // a feather-touch tap still moves the cue ball
const MAX_SHOT = 160; // full power rolls the cue ball about four table lengths
// Rolling deceleration, units/s^2. Tuned by experiment: stiffer values (40+) leave the
// rack barely moving on a full-power break and balls die before they reach a pocket,
// which makes the game feel broken. 18 gives a break that genuinely scatters.
const FRICTION = 18;
const CUSHION = 0.9; // cushions give back a bit less than they take
const RESTITUTION = 1; // ball-on-ball is treated as perfectly elastic
const STOP_EPS = 0.6; // below this a ball is snapped to rest so the sim can end
// Hard step cap. Friction already guarantees the sim ends — the worst case we could
// construct (all 16 balls crammed in one corner, full power into the pile) settles in
// ~1600 steps — but the cap means a future tweak to the constants above can never hang
// a kid's device in an infinite loop.
const MAX_STEPS = 6000;
const FRAME_STRIDE = 4; // 60 sampled frames per simulated second
const MAX_FRAMES = 600;

// Standard tight triangle: apex at (75, 25), rows opening toward +x, 8-ball dead
// centre of the third row, and one solid / one stripe in the back corners. Fixed
// pattern on purpose — a shuffled rack could never be reproduced on the other device.
const RACK_ROWS = [
  [1],
  [9, 2],
  [10, 8, 3],
  [11, 4, 12, 5],
  [13, 6, 14, 15, 7],
];
const RACK_GAP = 2 * R + 0.02; // the hair of slack keeps rounding from wedging balls
const RACK_ROW_DX = RACK_GAP * (Math.sqrt(3) / 2);

// --- deterministic trig ---------------------------------------------------------

const TWO_PI = 6.283185307179586;
const HALF_PI = 1.5707963267948966;
const PI = 3.141592653589793;

// Taylor series for sin through x^19, evaluated by Horner. After reduction to
// [-PI/2, PI/2] the truncation error is under 1e-13 — irrelevant next to the
// 6-decimal rounding we store, and identical on every JS engine.
function dsin(a) {
  let x = a - TWO_PI * Math.round(a / TWO_PI);
  if (x > HALF_PI) x = PI - x;
  else if (x < -HALF_PI) x = -PI - x;
  const x2 = x * x;
  let p = -1 / 121645100408832000;
  p = 1 / 355687428096000 + x2 * p;
  p = -1 / 1307674368000 + x2 * p;
  p = 1 / 6227020800 + x2 * p;
  p = -1 / 39916800 + x2 * p;
  p = 1 / 362880 + x2 * p;
  p = -1 / 5040 + x2 * p;
  p = 1 / 120 + x2 * p;
  p = -1 / 6 + x2 * p;
  p = 1 + x2 * p;
  return x * p;
}

function dcos(a) {
  return dsin(a + HALF_PI);
}

// --- small helpers ---------------------------------------------------------------

function r6(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 1000000) / 1000000;
}

function r3(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 1000) / 1000;
}

function clamp(v, lo, hi) {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

export function isStripe(n) {
  return n >= 9 && n <= 15;
}

export function groupOf(n) {
  if (n === 0) return 'cue';
  if (n === 8) return 'eight';
  return n >= 9 && n <= 15 ? 'stripes' : 'solids';
}

const COLORS = ['#f4f1e8', '#f5c518', '#1a5fd0', '#d0342c', '#6b3fa0', '#ef7f1a', '#1b8a4b', '#7d2b2b', '#1a1a1a'];

// 9-15 repeat the colours of 1-7; the UI paints the white stripe band itself.
export function ballColor(n) {
  if (n >= 9 && n <= 15) return COLORS[n - 8];
  if (n >= 0 && n <= 8) return COLORS[n];
  return '#f4f1e8';
}

function otherGroup(g) {
  return g === 'solids' ? 'stripes' : 'solids';
}

// --- state ------------------------------------------------------------------------

export function initialPool() {
  const balls = [{ n: 0, x: CUE_X, y: CUE_Y, in: false }];
  for (let row = 0; row < RACK_ROWS.length; row++) {
    const ns = RACK_ROWS[row];
    for (let j = 0; j < ns.length; j++) {
      balls.push({
        n: ns[j],
        x: r6(APEX_X + row * RACK_ROW_DX),
        y: r6(APEX_Y + (j - row / 2) * RACK_GAP),
        in: false,
      });
    }
  }
  balls.sort((a, b) => a.n - b.n);
  return {
    balls,
    turn: 0,
    groups: { 0: null, 1: null },
    phase: 'break',
    winner: null,
    lastShot: null,
    message: '',
  };
}

// Count of a player's remaining object balls. Before groups are assigned the honest
// answer is "everything that isn't the 8", which is what the UI wants to show.
export function remainingFor(state, playerIndex) {
  const key = playerIndex === 1 ? '1' : '0';
  const group = state && state.groups ? state.groups[key] : null;
  const balls = state && Array.isArray(state.balls) ? state.balls : [];
  let count = 0;
  for (const b of balls) {
    if (b.in) continue;
    if (b.n === 0 || b.n === 8) continue;
    if (!group || groupOf(b.n) === group) count++;
  }
  return count;
}

// Rebuild a plain, fully-defined copy. Also our defence against a half-written
// Firestore doc: anything missing falls back to something sane rather than undefined.
function cloneState(state) {
  const src = state && typeof state === 'object' ? state : {};
  const balls = [];
  const seen = Array.isArray(src.balls) ? src.balls : [];
  for (const b of seen) {
    if (!b || typeof b !== 'object') continue;
    balls.push({ n: b.n | 0, x: r6(b.x), y: r6(b.y), in: b.in === true });
  }
  balls.sort((a, b) => a.n - b.n);
  const g = src.groups && typeof src.groups === 'object' ? src.groups : {};
  const g0 = g[0] === 'solids' || g[0] === 'stripes' ? g[0] : null;
  const g1 = g[1] === 'solids' || g[1] === 'stripes' ? g[1] : null;
  const phase = ['break', 'open', 'assigned', 'over'].indexOf(src.phase) >= 0 ? src.phase : 'break';
  return {
    balls,
    turn: src.turn === 1 ? 1 : 0,
    groups: { 0: g0, 1: g1 },
    phase,
    winner: src.winner === 0 || src.winner === 1 ? src.winner : null,
    lastShot:
      src.lastShot && typeof src.lastShot === 'object'
        ? { by: src.lastShot.by === 1 ? 1 : 0, angle: r6(src.lastShot.angle), power: r6(src.lastShot.power) }
        : null,
    message: typeof src.message === 'string' ? src.message : '',
  };
}

// --- physics ----------------------------------------------------------------------

function pocketAt(x, y) {
  for (const p of POCKETS) {
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy <= POCKET_R * POCKET_R) return p;
  }
  return null;
}

function spotFree(balls, x, y) {
  if (pocketAt(x, y)) return false;
  for (const b of balls) {
    if (b.in || b.n === 0) continue;
    const dx = b.x - x;
    const dy = b.y - y;
    if (dx * dx + dy * dy < (2 * R) * (2 * R)) return false;
  }
  return true;
}

// Cue ball back to its spot after a scratch. If the rack has drifted over the spot we
// walk toward the head of the table (-x) — the direction with the most open felt.
function respotCue(balls) {
  const cue = balls.find((b) => b.n === 0);
  if (!cue) return;
  cue.in = false;
  cue.vx = 0;
  cue.vy = 0;
  for (let i = 0; i <= 46; i++) {
    const x = CUE_X - i * 0.5;
    if (x < R) break;
    if (spotFree(balls, x, CUE_Y)) {
      cue.x = x;
      cue.y = CUE_Y;
      return;
    }
  }
  for (let i = 1; i <= 150; i++) {
    const x = CUE_X + i * 0.5;
    if (x > W - R) break;
    if (spotFree(balls, x, CUE_Y)) {
      cue.x = x;
      cue.y = CUE_Y;
      return;
    }
  }
  cue.x = CUE_X;
  cue.y = CUE_Y;
}

function collide(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distSq = dx * dx + dy * dy;
  const min = 2 * R;
  if (distSq >= min * min) return;

  let d = Math.sqrt(distSq);
  let nx;
  let ny;
  if (d === 0) {
    // Two balls exactly on top of each other would divide by zero. Never happens in
    // practice, but a fixed fallback normal keeps the result deterministic instead of NaN.
    d = 0.000001;
    nx = 1;
    ny = 0;
  } else {
    nx = dx / d;
    ny = dy / d;
  }

  // Push them apart before applying the impulse. Without this, a pair that ends a step
  // still overlapping re-collides next step and each collision re-flips the normal
  // velocities — they stick together and jitter, and the sim never settles.
  const overlap = (min - d) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;

  // Equal masses, impulse along the line of centres. Only the normal components swap;
  // the tangential components ride through untouched, which is what makes cut shots work.
  const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rvn > 0) return; // already separating
  const j = (-(1 + RESTITUTION) * rvn) / 2;
  a.vx -= j * nx;
  a.vy -= j * ny;
  b.vx += j * nx;
  b.vy += j * ny;
}

function cushion(b) {
  if (b.x < R) {
    b.x = R;
    b.vx = Math.abs(b.vx) * CUSHION;
  } else if (b.x > W - R) {
    b.x = W - R;
    b.vx = -Math.abs(b.vx) * CUSHION;
  }
  if (b.y < R) {
    b.y = R;
    b.vy = Math.abs(b.vy) * CUSHION;
  } else if (b.y > H - R) {
    b.y = H - R;
    b.vy = -Math.abs(b.vy) * CUSHION;
  }
}

function snapshot(balls) {
  const frame = [];
  for (const b of balls) frame.push({ n: b.n, x: r3(b.x), y: r3(b.y), in: b.in });
  return frame;
}

function simulate(balls) {
  const pocketed = [];
  let frames = [snapshot(balls)];

  for (let step = 1; step <= MAX_STEPS; step++) {
    for (const b of balls) {
      if (b.in) continue;
      b.x += b.vx * DT;
      b.y += b.vy * DT;
    }

    for (let i = 0; i < balls.length; i++) {
      if (balls[i].in) continue;
      for (let j = i + 1; j < balls.length; j++) {
        if (balls[j].in) continue;
        collide(balls[i], balls[j]);
      }
    }

    // Cushions before pockets: clamping to the rail is what carries a ball hugging the
    // wood into the jaws of a pocket, exactly like the real table.
    for (const b of balls) {
      if (b.in) continue;
      cushion(b);
      const p = pocketAt(b.x, b.y);
      if (p) {
        b.in = true;
        b.x = p.x;
        b.y = p.y;
        b.vx = 0;
        b.vy = 0;
        pocketed.push(b.n);
      }
    }

    let moving = false;
    for (const b of balls) {
      if (b.in) continue;
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      const next = sp - FRICTION * DT;
      if (next <= STOP_EPS) {
        b.vx = 0;
        b.vy = 0;
      } else {
        const k = next / sp;
        b.vx *= k;
        b.vy *= k;
        moving = true;
      }
    }

    if (step % FRAME_STRIDE === 0) frames.push(snapshot(balls));
    if (!moving) {
      frames.push(snapshot(balls));
      break;
    }
  }

  if (frames.length > MAX_FRAMES) {
    const stride = Math.ceil(frames.length / MAX_FRAMES);
    const thinned = [];
    for (let i = 0; i < frames.length; i += stride) thinned.push(frames[i]);
    const last = frames[frames.length - 1];
    if (thinned[thinned.length - 1] !== last) thinned.push(last);
    frames = thinned;
  }

  return { pocketed, frames };
}

// --- messages ---------------------------------------------------------------------

function listBalls(ns) {
  if (ns.length === 0) return '';
  if (ns.length === 1) return `the ${ns[0]}`;
  if (ns.length === 2) return `the ${ns[0]} and ${ns[1]}`;
  return `the ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`;
}

// --- the shot ---------------------------------------------------------------------

export function takeShot(state, angle, power) {
  const prev = cloneState(state);

  if (prev.phase === 'over') {
    return { state: { ...prev, message: 'That game is already finished.' }, frames: [], events: [] };
  }

  const a = r6(Number.isFinite(angle) ? angle : 0);
  const p = clamp(r6(Number.isFinite(power) ? power : 0), 0, 1);
  const speed = MIN_SHOT + (MAX_SHOT - MIN_SHOT) * p;

  const sim = prev.balls.map((b) => ({ n: b.n, x: b.x, y: b.y, in: b.in, vx: 0, vy: 0 }));
  const cue = sim.find((b) => b.n === 0);
  if (cue) {
    if (cue.in) respotCue(sim); // shouldn't happen — scratches respot immediately — but be safe
    cue.vx = dcos(a) * speed;
    cue.vy = dsin(a) * speed;
  }

  const { pocketed, frames } = simulate(sim);

  const shooter = prev.turn;
  const other = shooter === 0 ? 1 : 0;
  const sKey = shooter === 1 ? '1' : '0';
  const oKey = other === 1 ? '1' : '0';

  const scratched = pocketed.indexOf(0) >= 0;
  const sankEight = pocketed.indexOf(8) >= 0;
  const objectBalls = pocketed.filter((n) => n !== 0 && n !== 8);

  const events = [];
  for (const n of pocketed) {
    if (n === 0) events.push('Scratch!');
    else if (n === 8) events.push('Sank the 8-ball');
    else events.push(`Sank the ${n}`);
  }

  const groups = { 0: prev.groups[0], 1: prev.groups[1] };
  let phase = prev.phase;
  let turn = shooter;
  let winner = null;
  let message = '';
  let assigned = null;

  if (phase === 'break') {
    // The table stays open after the break — sinking a ball does not pick your group.
    phase = 'open';
    if (sankEight) {
      winner = other;
      message = 'The 8-ball went down on the break — that loses the game.';
    } else if (scratched) {
      turn = other;
      message = 'Scratch on the break — the cue ball goes back on the table. Turn passes.';
    } else if (objectBalls.length > 0) {
      message = `Big break — ${listBalls(objectBalls)} dropped! Table is still open. Go again.`;
    } else {
      turn = other;
      message = 'Break made, nothing dropped. Table is open. Turn passes.';
    }
  } else if (phase === 'open') {
    if (sankEight) {
      winner = other;
      message = 'The 8-ball went down way too early — that loses the game.';
    } else if (scratched) {
      // A foul never assigns groups, so the table stays open.
      turn = other;
      message = 'Scratch — the cue ball goes back on the table. Table is still open. Turn passes.';
    } else if (objectBalls.length > 0) {
      assigned = groupOf(objectBalls[0]);
      groups[sKey] = assigned;
      groups[oKey] = otherGroup(assigned);
      phase = 'assigned';
      message = `Sank ${listBalls(objectBalls)} — that means ${assigned}! Go again.`;
    } else {
      turn = other;
      message = 'No luck that time, table is still open. Turn passes.';
    }
  } else {
    const mine = groups[sKey];
    let myLeft = 0;
    for (const b of sim) {
      if (b.in || b.n === 0 || b.n === 8) continue;
      if (!mine || groupOf(b.n) === mine) myLeft++;
    }
    if (sankEight) {
      if (!scratched && myLeft === 0) {
        winner = shooter;
        message = 'The last ball and then the 8-ball, clean as you like — that wins the game!';
      } else {
        winner = other;
        message = scratched
          ? 'The 8-ball and a scratch on the same shot — that loses the game.'
          : 'The 8-ball dropped with balls still on the table — that loses the game.';
      }
    } else if (scratched) {
      turn = other;
      message = `Scratch — the cue ball goes back on the table.${
        objectBalls.length ? ` ${listBalls(objectBalls)} still counts as down.` : ''
      } Turn passes.`;
    } else if (objectBalls.some((n) => groupOf(n) === mine)) {
      const good = objectBalls.filter((n) => groupOf(n) === mine);
      message = `Nice — sank ${listBalls(good)}! Go again.`;
      if (good.length !== objectBalls.length) {
        const theirs = objectBalls.filter((n) => groupOf(n) !== mine);
        message = `Nice — sank ${listBalls(good)} (and ${listBalls(theirs)} for the other player). Go again.`;
      }
    } else {
      turn = other;
      message = objectBalls.length
        ? `${listBalls(objectBalls)} dropped, but that is the other player's group. Turn passes.`
        : 'No luck that time. Turn passes.';
    }
  }

  if (winner !== null) {
    phase = 'over';
    turn = shooter;
    events.push('Game over');
  } else if (turn !== shooter) {
    events.push('Turn passes');
  }
  if (assigned) events.push(`Groups set: ${assigned}`);

  if (scratched) respotCue(sim);

  const balls = sim
    .map((b) => ({ n: b.n, x: r6(b.x), y: r6(b.y), in: b.in === true }))
    .sort((x, y) => x.n - y.n);

  const next = {
    balls,
    turn,
    groups: { 0: groups[0], 1: groups[1] },
    phase,
    winner,
    lastShot: { by: shooter, angle: a, power: p },
    message,
  };

  return { state: next, frames, events };
}
