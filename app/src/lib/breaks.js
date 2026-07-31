// Brain-break accounting, per student per day, stored on-device.
// Every WORK_MINUTES of active work earns one 5-minute break.

const WORK_MINUTES = 30;
export const BREAK_SECONDS = 5 * 60;

function key(studentId) {
  const d = new Date();
  return `wfs-break-${studentId}-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function load(studentId) {
  try {
    return JSON.parse(localStorage.getItem(key(studentId))) ?? { workedMin: 0, taken: 0 };
  } catch {
    return { workedMin: 0, taken: 0 };
  }
}

function save(studentId, state) {
  localStorage.setItem(key(studentId), JSON.stringify(state));
}

// Called once per minute while the kid has an active item on screen.
export function tickWork(studentId) {
  const s = load(studentId);
  s.workedMin += 1;
  save(studentId, s);
  return s;
}

export function breakAvailable(studentId) {
  const s = load(studentId);
  return s.workedMin >= WORK_MINUTES;
}

export function minutesUntilBreak(studentId) {
  const s = load(studentId);
  return Math.max(0, WORK_MINUTES - s.workedMin);
}

export function startBreak(studentId) {
  const s = load(studentId);
  s.workedMin = 0;
  s.taken += 1;
  save(studentId, s);
}

// per-game saved progress (persists across breaks)
export function loadGame(studentId, game) {
  try {
    return JSON.parse(localStorage.getItem(`wfs-game-${studentId}-${game}`));
  } catch {
    return null;
  }
}

export function saveGame(studentId, game, state) {
  localStorage.setItem(`wfs-game-${studentId}-${game}`, JSON.stringify(state));
}
