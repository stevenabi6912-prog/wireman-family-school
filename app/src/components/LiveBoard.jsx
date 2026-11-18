import { useEffect, useState } from 'react';
import { resolveTheme } from '../config/themes';
import { DONE_STATUSES } from '../lib/parentData';
import './LiveBoard.css';

const clock = (d) => `${((d.getHours() + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')}`;

// All four kids' days side by side, live: what's done (and when, and how
// long it took), what each one is on right now, and what's still ahead —
// the view a teacher with four students actually watches.
export default function LiveBoard({ students, byStudent, order }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('liveboard-open') !== '0'; } catch { return true; }
  });
  const [, setTick] = useState(0);

  // elapsed times are clock-driven, so re-render once a minute while open
  useEffect(() => {
    if (!open) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem('liveboard-open', next ? '1' : '0'); } catch { /* private window */ }
  }

  const anyToday = order.some((id) => byStudent[id]?.today.length);
  if (!anyToday) return null;

  return (
    <section className="liveboard">
      <button className="sweep-toggle" onClick={toggle}>
        📋 Live board — all four, right now {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="liveboard-grid">
          {order.map((id) => {
            const s = students[id];
            if (!s) return null;
            const theme = resolveTheme(id, s.theme);
            // same order the kid sees: catch-up first, skipped items last
            const overdue = (byStudent[id]?.overdue ?? []).map((a) => ({ ...a, catchUp: true }));
            const todays = byStudent[id]?.today ?? [];
            const sinks = (a) => (a.skipped && !DONE_STATUSES.has(a.status) ? 1 : 0);
            const list = [...overdue, ...todays]
              .map((a, i) => [a, i])
              .sort((x, y) => sinks(x[0]) - sinks(y[0]) || x[1] - y[1])
              .map(([a]) => a);
            const activeId = list.find((a) => !DONE_STATUSES.has(a.status))?.id;
            const done = list.filter((a) => DONE_STATUSES.has(a.status)).length;

            let remaining = 0;
            for (const a of list) {
              if (DONE_STATUSES.has(a.status)) continue;
              const est = a.estimatedMinutes ?? 20;
              const startedMs = a.startedAt?.toMillis?.();
              remaining += startedMs ? Math.max(est - (Date.now() - startedMs) / 60000, 2) : est;
            }
            const finish = new Date(Math.ceil((Date.now() + remaining * 60000) / 300000) * 300000);

            return (
              <div key={id} className="liveboard-col" style={{ '--s-accent': theme.colors.accent }}>
                <h3>
                  {theme.avatar} {s.name}
                  <span className="liveboard-count">{done}/{list.length}</span>
                </h3>
                <p className="liveboard-eta">
                  {list.length === 0 ? 'nothing today' : done === list.length ? '🎉 finished' : `≈ done ${clock(finish)}`}
                </p>
                <ul>
                  {list.map((a) => {
                    const isDone = DONE_STATUSES.has(a.status);
                    const isActive = a.id === activeId;
                    const startedMs = a.startedAt?.toMillis?.();
                    const finished = a.updatedAt?.toDate?.();
                    const soFar = startedMs ? Math.round((Date.now() - startedMs) / 60000) : null;
                    const est = a.estimatedMinutes ?? 20;
                    const slow = isActive && soFar != null && soFar > est * 2 && soFar - est >= 15;
                    return (
                      <li
                        key={a.id}
                        className={`liveboard-item ${isDone ? 'lb-done' : isActive ? 'lb-active' : 'lb-todo'} ${slow ? 'lb-slow' : ''}`}
                        title={a.title}
                      >
                        <span className="lb-icon">
                          {isDone ? (a.status === 'waived' ? '➖' : '✓') : isActive ? '▶' : a.skipped ? '⏭' : a.catchUp ? '⏰' : '○'}
                        </span>
                        <span className="lb-title">{a.title}</span>
                        <span className="lb-meta">
                          {isDone
                            ? `${finished ? clock(finished) : ''}${a.actualMinutes ? ` · ${a.actualMinutes}m` : ''}`
                            : isActive
                              ? (soFar != null ? `${soFar}m of ~${est}` : 'not started')
                              : `~${est}m`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
