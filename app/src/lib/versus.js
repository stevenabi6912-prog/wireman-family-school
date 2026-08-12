// Sibling-vs-sibling games. A break is only five minutes, so these are
// CORRESPONDENCE games: you take your turn, the game waits, your opponent
// replies on their next break. Matches live for days and that's the point.

import {
  collection, doc, addDoc, setDoc, getDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export const GAME_TYPES = {
  chess: { label: 'Chess', emoji: '♟️' },
  checkers: { label: 'Checkers', emoji: '🔴' },
  battleship: { label: 'Battleship', emoji: '🚢' },
  pool: { label: '8-Ball Pool', emoji: '🎱' },
};

// Is this player the one who needs to act? Battleship's setup phase isn't
// turn-based — both players place their fleet independently — so "my move"
// has to mean "I haven't locked mine in yet" there, not "game.turn === me"
// (which defaults to player 1 and would tell the WRONG person to act, or
// nobody at all, until both are ready). Every place that counts or labels
// pending moves must use this — a second copy of the old turn-only check
// is exactly how this bug came back once already.
export function awaitingMe(game, studentId) {
  if (game.status === 'over') return false;
  if (game.type === 'battleship' && game.status === 'setup') {
    return !game.state?.ready?.[studentId];
  }
  return game.turn === studentId;
}

// Every match this kid is part of. Sorted newest-first on the client so we
// don't need a composite index for a handful of docs.
export function watchMyGames(studentId, callback) {
  const q = query(collection(db, 'games'), where('players', 'array-contains', studentId));
  return onSnapshot(q, (snap) => {
    const games = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));
    callback(games);
  });
}

export function watchGame(gameId, callback) {
  return onSnapshot(doc(db, 'games', gameId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function createGame({ type, players, state, status = 'active' }) {
  const ref = await addDoc(collection(db, 'games'), {
    type,
    players, // [challenger, opponent] — index 0 moves first
    turn: players[0],
    state,
    status, // 'setup' | 'active' | 'over'
    winner: null,
    lastMove: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function saveGame(gameId, patch) {
  await updateDoc(doc(db, 'games', gameId), { ...patch, updatedAt: serverTimestamp() });
}

export async function resignGame(gameId, me, opponent) {
  await saveGame(gameId, {
    status: 'over',
    winner: opponent,
    lastMove: 'Resigned',
  });
}

export async function deleteGame(gameId) {
  await deleteDoc(doc(db, 'games', gameId));
}

// ---- Battleship fleets: secret, one doc per player, rules-locked to them ----
export async function saveFleet(gameId, studentId, fleet) {
  await setDoc(doc(db, 'games', gameId, 'fleets', studentId), fleet);
}

export async function loadFleet(gameId, studentId) {
  const snap = await getDoc(doc(db, 'games', gameId, 'fleets', studentId));
  return snap.exists() ? snap.data() : null;
}
