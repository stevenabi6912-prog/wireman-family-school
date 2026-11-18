import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import './WeeklyReport.css';

const DONE = new Set(['submitted', 'graded', 'waived']);
const SIBLINGS = { luke: 'Luke', layla: 'Layla', logan: 'Logan', lazarus: 'Lazarus' };

function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The kid's own "week in review" — appears on their page for a few days after
// the weekly report is written (the moment they finish the week's last item,
// normally Thursday). Doc ids are {studentId}-{weekEndISO}, so we probe the
// last few days instead of needing an index. The numbers on the tiles come
// from the page's live year data; the words come from the written report.
export default function WeeklyReport({ studentId, justFinished, yearDocs, streak }) {
  const [report, setReport] = useState(null);
  const [weekEnd, setWeekEnd] = useState(null);
  const [cheers, setCheers] = useState(null); // { got: [...], sent: [...] }
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    const probe = async () => {
      for (let back = 0; back <= 3; back++) {
        const d = new Date();
        d.setDate(d.getDate() - back);
        const iso = isoOf(d);
        try {
          const snap = await getDoc(doc(db, 'kidReports', `${studentId}-${iso}`));
          if (snap.exists() && !cancelled) {
            setReport(snap.data());
            setWeekEnd(iso);
            return;
          }
        } catch { /* keep probing */ }
      }
    };
    probe();
    // day just completed: the report may be generating right now — re-check
    const t = justFinished ? setTimeout(probe, 30000) : null;
    return () => {
      cancelled = true;
      if (t) clearTimeout(t);
    };
  }, [studentId, justFinished]);

  // Monday of the report's week
  const weekStart = useMemo(() => {
    if (!weekEnd) return null;
    const d = new Date(`${weekEnd}T12:00:00`);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return isoOf(d);
  }, [weekEnd]);

  // The week's cheers, both directions.
  useEffect(() => {
    if (!studentId || !weekStart) return;
    let cancelled = false;
    (async () => {
      try {
        const [got, sent] = await Promise.all([
          getDocs(query(collection(db, 'kudos'), where('to', '==', studentId), where('date', '>=', weekStart))),
          getDocs(query(collection(db, 'kudos'), where('from', '==', studentId))),
        ]);
        if (cancelled) return;
        const inWeek = (k) => k.date >= weekStart && k.date <= weekEnd;
        setCheers({
          got: got.docs.map((d) => d.data()).filter(inWeek),
          sent: sent.docs.map((d) => d.data()).filter(inWeek),
        });
      } catch { /* tiles just skip the cheers */ }
    })();
    return () => { cancelled = true; };
  }, [studentId, weekStart, weekEnd]);

  const week = useMemo(() => {
    if (!yearDocs || !weekStart) return null;
    const byDate = {};
    let minutes = 0;
    for (const a of yearDocs) {
      if (a.scheduledDate < weekStart || a.scheduledDate > weekEnd) continue;
      const day = (byDate[a.scheduledDate] ??= { total: 0, done: 0 });
      day.total++;
      if (DONE.has(a.status)) {
        day.done++;
        minutes += a.actualMinutes ?? 0;
      }
    }
    const days = Object.values(byDate);
    return {
      days: days.length,
      fullDays: days.filter((d) => d.done === d.total).length,
      hours: minutes / 60,
    };
  }, [yearDocs, weekStart, weekEnd]);

  if (!report) return null;

  const best = report.stats?.grades?.length ? Math.max(...report.stats.grades.map((g) => g.pct)) : null;

  return (
    <div className="wr-box">
      <div className="wr-card">
        <p className="wr-kicker">📬 Your week in review</p>
        <h3 className="wr-headline">{report.headline}</h3>
        <div className="wr-tiles">
          {week && week.days > 0 && (
            <span className="wr-tile"><strong>{week.fullDays}/{week.days}</strong> days finished</span>
          )}
          <span className="wr-tile"><strong>{report.stats?.finished}/{report.stats?.assigned}</strong> items done</span>
          {best != null && <span className="wr-tile wr-tile-gold"><strong>{best}%</strong> best grade</span>}
          {week && week.hours >= 0.5 && <span className="wr-tile"><strong>{week.hours.toFixed(1)}</strong> hours of work</span>}
          {streak > 0 && <span className="wr-tile wr-tile-fire"><strong>{streak}</strong>-day streak 🔥</span>}
          {cheers && (cheers.got.length > 0 || cheers.sent.length > 0) && (
            <span className="wr-tile wr-tile-cheer">
              💌 <strong>{cheers.got.length}</strong> cheer{cheers.got.length === 1 ? '' : 's'} received
              {cheers.sent.length > 0 && <> · <strong>{cheers.sent.length}</strong> sent</>}
            </span>
          )}
        </div>
        {cheers?.got.length > 0 && (
          <p className="wr-cheers">
            {cheers.got.map((c, i) => <span key={i}>{c.sticker} {SIBLINGS[c.from] ?? c.from}</span>)}
          </p>
        )}
        <button className="wr-open" onClick={() => setOpen(!open)}>
          {open ? 'Close my report' : 'Read my full report ▸'}
        </button>
        {open && (
          <div className="wr-body">
            {report.wins?.length > 0 && (
              <div className="wr-section">
                <h4>⭐ You crushed it</h4>
                <ul>{report.wins.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
            {report.workOn?.length > 0 && (
              <div className="wr-section">
                <h4>🎯 Next week's mission</h4>
                <ul>{report.workOn.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
            {report.note && <p className="wr-note">{report.note}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
