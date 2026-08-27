import { useEffect, useState } from 'react';

// The kids keep the app open in a tab for days, so after a deploy they're
// still running the old page ("there is no paw button") until a manual
// refresh. This checks the served index.html every few minutes and, when the
// bundle name changes, offers a one-tap reload.
export default function UpdateNudge() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = document.querySelector('script[src*="assets/index-"]')?.getAttribute('src');
    if (!current) return undefined;

    let stopped = false;
    async function check() {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}index.html`, { cache: 'no-store' });
        const html = await res.text();
        const served = html.match(/assets\/index-[^"]+\.js/)?.[0];
        if (!stopped && served && !current.includes(served)) setReady(true);
      } catch { /* offline or blocked — try again next tick */ }
    }
    const id = setInterval(check, 5 * 60 * 1000);
    return () => { stopped = true; clearInterval(id); };
  }, []);

  if (!ready) return null;
  return (
    <button
      onClick={() => window.location.reload()}
      style={{
        position: 'fixed', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, border: 'none', borderRadius: 999, padding: '10px 20px',
        background: '#6c5ce7', color: '#fff', fontWeight: 700, font: 'inherit',
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)', cursor: 'pointer',
      }}
    >
      ✨ The app got an update — tap to load it!
    </button>
  );
}
