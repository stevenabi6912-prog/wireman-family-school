// One-time admin script: creates the 6 family accounts in Firebase Auth with
// custom claims (role + studentId), and mirrors a matching /users/{uid} doc in
// Firestore for display purposes. Run this once against your real Firebase
// project after it's created (or against the emulator suite for local dev).
//
// Usage:
//   node scripts/seed-users.js                       # targets the live project (needs GOOGLE_APPLICATION_CREDENTIALS)
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//     node scripts/seed-users.js                       # targets the local emulator suite
//
// PINs are read from environment variables so they're never committed to the
// repo. Set them before running:
//   LUKE_PIN=123456 LAYLA_PIN=234567 LOGAN_PIN=345678 LAZARUS_PIN=456789 \
//   ABI_PIN=12345678 STEVEN_PIN=12345678 node scripts/seed-users.js
//
// Re-running is safe: an account whose PIN variable isn't set is skipped
// untouched, so adding one person means setting just their PIN:
//   STEVEN_PIN=12345678 npm run seed:users

import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || undefined });
}

const auth = admin.auth();
const db = admin.firestore();

const ACCOUNTS = [
  { id: 'luke', role: 'student', studentId: 'luke', pinEnv: 'LUKE_PIN' },
  { id: 'layla', role: 'student', studentId: 'layla', pinEnv: 'LAYLA_PIN' },
  { id: 'logan', role: 'student', studentId: 'logan', pinEnv: 'LOGAN_PIN' },
  { id: 'lazarus', role: 'student', studentId: 'lazarus', pinEnv: 'LAZARUS_PIN' },
  { id: 'abi', role: 'parent', pinEnv: 'ABI_PIN' },
  { id: 'steven', role: 'parent', pinEnv: 'STEVEN_PIN' },
];

function loginEmailFor(id) {
  return `${id}@wireman.local`;
}

async function upsertAccount({ id, role, studentId, pinEnv }) {
  const pin = process.env[pinEnv];
  const minLength = 6; // family decision: parent PIN same length as students'
  if (!/^\d+$/.test(pin) || pin.length < minLength) {
    throw new Error(
      `${pinEnv} must be a numeric PIN of at least ${minLength} digits (Firebase Auth's password minimum is 6 chars)`
    );
  }

  const email = loginEmailFor(id);
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, { password: pin });
    console.log(`Updated existing account for "${id}" (${userRecord.uid})`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    userRecord = await auth.createUser({ email, password: pin, emailVerified: true });
    console.log(`Created account for "${id}" (${userRecord.uid})`);
  }

  const claims = studentId ? { role, studentId } : { role };
  await auth.setCustomUserClaims(userRecord.uid, claims);

  // `id` is for humans reading the console/Firestore — the two parent accounts
  // are otherwise identical documents.
  await db.doc(`users/${userRecord.uid}`).set({ ...claims, id }, { merge: true });

  return userRecord.uid;
}

async function main() {
  const requested = ACCOUNTS.filter((a) => process.env[a.pinEnv]);
  if (!requested.length) {
    throw new Error(
      `No PINs given. Set at least one of: ${ACCOUNTS.map((a) => a.pinEnv).join(', ')}`
    );
  }
  const skipped = ACCOUNTS.filter((a) => !process.env[a.pinEnv]).map((a) => a.id);
  for (const account of requested) {
    await upsertAccount(account);
  }
  if (skipped.length) console.log(`Skipped (no PIN given, left untouched): ${skipped.join(', ')}`);
  console.log('\nDone. Every account must sign out and back in (or refresh) to pick up new custom claims.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
