import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import './WeeklyReport.css';

// The kid's own weekly report — appears on their page for a few days after
// it's written each Thursday evening. Doc ids are {studentId}-{weekEndISO},
// so we probe the last few days instead of needing an index.
export default function WeeklyReport({ studentId, justFinished }) {
  const [report, setReport] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    const probe = async () => {
      for (let back = 0; back <= 3; back++) {
        const d = new Date();
        d.setDate(d.getDate() - back);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        try {
          const snap = await getDoc(doc(db, 'kidReports', `${studentId}-${iso}`));
          if (snap.exists() && !cancelled) {
            setReport(snap.data());
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

  if (!report) return null;

  return (
    <div className="wr-box">
      <button className="wr-open" onClick={() => setOpen(!open)}>
        📬 {open ? 'Close my report' : 'My weekly report is here!'}
      </button>
      {open && (
        <div className="wr-body">
          <h3 className="wr-headline">{report.headline}</h3>
          <p className="wr-stats">
            ✅ {report.stats?.finished} of {report.stats?.assigned} finished
            {report.stats?.grades?.length > 0 && (
              <> · 📊 {report.stats.grades.map((g) => `${g.pct}%`).join(', ')}</>
            )}
          </p>
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
  );
}
