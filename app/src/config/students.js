// Static login-card directory. Names aren't sensitive, so this can render
// before anyone is authenticated — everything that IS sensitive (grades,
// assignments, submissions) still requires sign-in and lives in Firestore.
// Colors/emoji mirror each kid's signature theme (see config/themes.js).
export const STUDENTS = [
  { id: 'luke', name: 'Luke', grade: 8, color: '#0076B6', emoji: '🦁' },
  { id: 'layla', name: 'Layla', grade: 8, color: '#12939b', emoji: '🐬' },
  { id: 'logan', name: 'Logan', grade: 5, color: '#4a6b3a', emoji: '🎣' },
  { id: 'lazarus', name: 'Lazarus', grade: 3, color: '#1f9e46', emoji: '🎯' },
];

// Both parents get a login. `shortName` is what the kids see (the game lobby
// says "Dad", not "Steven"); `name` is what the grown-up sees.
export const PARENTS = [
  { id: 'abi', name: 'Abi', shortName: 'Mom', color: '#5B4B8A', emoji: '☀️', palette: 'bubblegum' },
  { id: 'steven', name: 'Steven', shortName: 'Dad', color: '#2f6f8f', emoji: '🧔', palette: 'sky' },
];

export const PARENT_IDS = PARENTS.map((p) => p.id);

// Everyone with a login, keyed by id — the roster the versus games play from.
export const PEOPLE = Object.fromEntries(
  [...STUDENTS, ...PARENTS].map((p) => [p.id, p])
);

export const isParentId = (id) => PARENT_IDS.includes(id);

// What to call someone in front of the kids.
export function displayName(id) {
  const p = PEOPLE[id];
  return p?.shortName ?? p?.name ?? id;
}

// Firebase Auth requires an email-shaped identifier; PINs are the password.
// This mapping is internal only — never rendered in the UI.
export function loginEmailFor(id) {
  return `${id}@wireman.local`;
}

// …and back again: the signed-in account's id. Parents have no studentId
// claim, so their identity comes from the address they signed in with.
export function idFromLoginEmail(email) {
  const id = String(email ?? '').split('@')[0];
  return PEOPLE[id] ? id : null;
}
