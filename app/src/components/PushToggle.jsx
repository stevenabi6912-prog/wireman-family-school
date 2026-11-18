import { useEffect, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const VAPID_PUBLIC_KEY = 'BHTVPqb-u2_GUetttDuSMs69zf1GOanH7lgtkaeIyJmS1SidcRwohiMYCHTH0QtCuLxldt0M2pKwC8CviPxJEwU';
const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function keyBytes(b64) {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subId(endpoint) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(hash)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const register = () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);

// Pop-up alerts on this computer or phone: a kid finished the day, a test
// came in, or a grade needs a parent's eyes. Each device opts in on its own.
export default function PushToggle({ personId }) {
  const [state, setState] = useState('loading'); // loading | off | on | blocked | busy
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supported) return;
    if (Notification.permission === 'denied') { setState('blocked'); return; }
    navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, []);

  async function turnOn() {
    setState('busy');
    setError('');
    try {
      if ((await Notification.requestPermission()) !== 'granted') { setState('blocked'); return; }
      await register();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
      await setDoc(doc(db, 'pushSubs', await subId(sub.endpoint)), {
        personId: personId ?? null,
        sub: sub.toJSON(),
        device: navigator.platform ?? '',
        createdAt: serverTimestamp(),
      });
      setState('on');
    } catch (err) {
      setError(err?.message ?? 'Could not turn alerts on.');
      setState('off');
    }
  }

  async function turnOff() {
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deleteDoc(doc(db, 'pushSubs', await subId(sub.endpoint))).catch(() => {});
        await sub.unsubscribe();
      }
    } finally {
      setState('off');
    }
  }

  if (!supported) {
    return (
      <section className="emailprefs-card">
        <h2>🔔 Alerts on this device</h2>
        <p className="emailpref-row">This browser can't show alerts. On an iPhone, add the site to your Home Screen first (Share → Add to Home Screen), then open it from there.</p>
      </section>
    );
  }

  return (
    <section className="emailprefs-card">
      <h2>🔔 Alerts on this device</h2>
      <p className="emailpref-row">
        A pop-up when a kid finishes the day, turns in a test, or a grade needs your eyes — even with the site closed.
      </p>
      {state === 'blocked' ? (
        <p className="emailpref-row">Alerts are blocked for this site in the browser's settings. Allow notifications there, then reload.</p>
      ) : (
        <label className="emailpref-row">
          <input
            type="checkbox"
            checked={state === 'on'}
            disabled={state === 'loading' || state === 'busy'}
            onChange={() => (state === 'on' ? turnOff() : turnOn())}
          />
          {state === 'on' ? 'On for this device' : state === 'busy' ? 'Working…' : 'Turn on for this device'}
        </label>
      )}
      {error && <p className="emailpref-row" style={{ color: 'var(--bad)' }}>{error}</p>}
    </section>
  );
}
