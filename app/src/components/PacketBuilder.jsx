import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, functions, storage } from '../lib/firebase';
import { todayISO } from '../lib/assignments';
import { DONE_STATUSES } from '../lib/parentData';
import { isPrintable, defaultPages } from '../lib/packet';
import './PacketBuilder.css';

// One print job for the day: every worksheet and test page all four kids
// need, listed with the exact pages before anything prints.
export default function PacketBuilder({ students, order, onClose }) {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { url, pageCount, skipped } | { error }

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setResult(null);
    getDocs(query(collection(db, 'assignments'), where('scheduledDate', '==', date)))
      .then((snap) => {
        if (cancelled) return;
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => isPrintable(a) && !DONE_STATUSES.has(a.status))
          .sort((a, b) => order.indexOf(a.studentId) - order.indexOf(b.studentId) || a.sequence - b.sequence);
        setRows(items.map((a) => {
          const p = defaultPages(a);
          return { id: a.id, kid: a.studentId, title: a.title, ...p, include: p.count > 0 };
        }));
      })
      .catch(() => !cancelled && setRows([]));
    return () => { cancelled = true; };
  }, [date, order]);

  const chosen = useMemo(() => (rows ?? []).filter((r) => r.include && r.count > 0), [rows]);
  const totalPages = chosen.reduce((n, r) => n + Number(r.count), 0);

  const patch = (id, change) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));

  async function build() {
    setBusy(true);
    setResult(null);
    try {
      const call = httpsCallable(functions, 'buildDayPacket', { timeout: 300000 });
      const { data } = await call({
        date,
        items: chosen.map((r) => ({
          kid: students[r.kid]?.name ?? r.kid, title: r.title, path: r.path, from: Number(r.from), count: Number(r.count),
        })),
      });
      const url = await getDownloadURL(ref(storage, data.path));
      setResult({ url, pageCount: data.pageCount, skipped: data.skipped ?? [] });
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setResult({ error: err?.message ?? 'The packet could not be built.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="packet-overlay" onClick={onClose}>
      <div className="packet-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="packet-head">
          <h2>🖨️ Print packet</h2>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="packet-close" onClick={onClose}>✕</button>
        </div>
        <p className="packet-hint">
          Every unfinished worksheet and test with pages in the app, for all four kids. Check the pages —
          they're best guesses from how each book is laid out — then build one PDF and print it.
        </p>

        {rows === null ? (
          <p className="packet-hint">Finding the day's pages…</p>
        ) : rows.length === 0 ? (
          <p className="packet-hint">Nothing printable is scheduled that day (or it's all already done).</p>
        ) : (
          <table className="packet-table">
            <thead>
              <tr><th></th><th>Who</th><th>Item</th><th>From page</th><th>Pages</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.include && r.count > 0 ? '' : 'packet-off'}>
                  <td><input type="checkbox" checked={r.include} onChange={(e) => patch(r.id, { include: e.target.checked, count: e.target.checked && !Number(r.count) ? 2 : r.count })} /></td>
                  <td>{students[r.kid]?.name ?? r.kid}</td>
                  <td>{r.title}{r.note && <em> · {r.note}</em>}</td>
                  <td><input type="number" min="1" value={r.from} onChange={(e) => patch(r.id, { from: e.target.value })} /></td>
                  <td><input type="number" min="0" max="40" value={r.count} onChange={(e) => patch(r.id, { count: e.target.value })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="packet-actions">
          <button className="packet-build" onClick={build} disabled={busy || totalPages === 0}>
            {busy ? 'Building the PDF…' : `Build & open — ${totalPages} page${totalPages === 1 ? '' : 's'}`}
          </button>
          {result?.url && (
            <a href={result.url} target="_blank" rel="noreferrer">Open the packet again ({result.pageCount} pages)</a>
          )}
        </div>
        {result?.skipped?.length > 0 && <p className="packet-error">Couldn't include: {result.skipped.join('; ')}</p>}
        {result?.error && <p className="packet-error">{result.error}</p>}
      </div>
    </div>
  );
}
