import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { loginEmailFor, idFromLoginEmail } from '../config/students';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading
  const [claims, setClaims] = useState(null);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence);
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const tokenResult = await firebaseUser.getIdTokenResult();
        setClaims(tokenResult.claims);
      } else {
        setClaims(null);
      }
    });
  }, []);

  async function loginWithPin(id, pin) {
    return signInWithEmailAndPassword(auth, loginEmailFor(id), pin);
  }

  async function logout() {
    await firebaseSignOut(auth);
  }

  const value = {
    user,
    role: claims?.role ?? null, // 'student' | 'parent'
    studentId: claims?.studentId ?? null,
    // Who is signed in, kid or parent — the id the versus games use as a
    // player. Parents carry no studentId claim, so fall back to their login.
    personId: claims?.studentId ?? idFromLoginEmail(user?.email),
    loading: user === undefined,
    loginWithPin,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
