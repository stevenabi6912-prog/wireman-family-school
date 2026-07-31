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

export const PARENT = { id: 'abi', name: 'Abi', color: '#5B4B8A', emoji: '☀️' };

// Firebase Auth requires an email-shaped identifier; PINs are the password.
// This mapping is internal only — never rendered in the UI.
export function loginEmailFor(id) {
  return `${id}@wireman.local`;
}
