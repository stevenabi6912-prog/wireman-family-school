// Static login-card directory. Names aren't sensitive, so this can render
// before anyone is authenticated — everything that IS sensitive (grades,
// assignments, submissions) still requires sign-in and lives in Firestore.
export const STUDENTS = [
  { id: 'luke', name: 'Luke', grade: 8, color: '#3B6EA8', initial: 'L' },
  { id: 'layla', name: 'Layla', grade: 8, color: '#B85C8A', initial: 'L' },
  { id: 'logan', name: 'Logan', grade: 5, color: '#4C9A6A', initial: 'L' },
  { id: 'lazarus', name: 'Lazarus', grade: 3, color: '#D98A3D', initial: 'L' },
];

export const PARENT = { id: 'abi', name: 'Abi', color: '#5B4B8A', initial: 'A' };

// Firebase Auth requires an email-shaped identifier; PINs are the password.
// This mapping is internal only — never rendered in the UI.
export function loginEmailFor(id) {
  return `${id}@wireman.local`;
}
