import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { todayISO } from '../lib/assignments';
import { DONE_STATUSES } from '../lib/parentData';
import { buildCalendar } from '../lib/calendar';
import { resolveTheme } from '../config/themes';
import './MorningBriefing.css';

// Abi's one-glance start to the day: where each kid stands, what needs HER
// today (recite day, screeners, grading), and the pause-the-day buttons.
export default function MorningBriefing({ students, byStudent, order, reviewCount }) {
  const [family, setFamily] = useState(null);
  const today = todayISO();

  useEffect(() => onSnapshot(doc(db, 'families', 'wireman'), (s) => setFamily(s.data())), []);

  // Which day of the school week is it? Day 4 = recitation day.
  const dayInfo = useMemo(() => {
    if (!family) return null;
    const cal = buildCalendar(family, 150);
    const n = cal.indexOf(today);
    if (n === -1) return { school: false };
    return { school: true, dayNum: n + 1, week: Math.min(36, Math.ceil((n + 1) / 4)), dow: (n % 4) + 1 };
  }, [family, today]);

  const pauseMinutes = family?.pause?.date === today ? family.pause.minutes : 0;

  async function pause(mins) {
    await updateDoc(doc(db, 'families', 'wireman'), {
      pause: mins === 0 ? deleteField() : { date: today, minutes: pauseMinutes + mins },
      updatedAt: serverTimestamp(),
    });
  }

  const needsYou = [];
  if (dayInfo?.school && dayInfo.dow === 4) needsYou.push(`🎤 Day 4 — recitation day (Week ${dayInfo.week}). The recite screen is ready below.`);
  if (reviewCount > 0) needsYou.push(`👀 ${reviewCount} item${reviewCount > 1 ? 's' : ''} in "Needs your eyes."`);
  for (const id of order) {
    const screener = byStudent[id]?.today.find((a) => /screener|reading check/i.test(a.title) && !DONE_STATUSES.has(a.status));
    if (screener) needsYou.push(`📝 ${students[id]?.name}: ${screener.title} — needs you nearby.`);
  }

  return (
    <section className="briefing-card">
      <div className="briefing-head">
        <h2>
          ☕ Today at a glance
          {dayInfo?.school && <span className="briefing-day">Day {dayInfo.dayNum} · Week {dayInfo.week} · Day {dayInfo.dow} of 4</span>}
        </h2>
        <div className="briefing-pause">
          {pauseMinutes > 0 && <span className="pause-chip">⏸ paused {pauseMinutes}m today</span>}
          <button onClick={() => pause(30)} title="Shift the kids' pacing targets 30 minutes later">⏸ +30m</button>
          <button onClick={() => pause(60)} title="Shift the kids' pacing targets an hour later">+1h</button>
          {pauseMinutes > 0 && <button onClick={() => pause(0)}>clear</button>}
        </div>
      </div>

      {!dayInfo?.school ? (
        <p className="briefing-empty">No school today — enjoy it! 🎉</p>
      ) : (
        <>
          <div className="briefing-kids">
            {order.map((id) => {
              const list = byStudent[id]?.today ?? [];
              const done = list.filter((a) => DONE_STATUSES.has(a.status)).length;
              const overdue = byStudent[id]?.overdue.length ?? 0;
              return (
                <span key={id} className={`briefing-kid ${list.length && done === list.length ? 'briefing-kid-done' : ''}`}>
                  {resolveTheme(id, students[id]?.theme).avatar} {students[id]?.name}: {done}/{list.length}
                  {overdue > 0 && <em> +{overdue} old</em>}
                </span>
              );
            })}
          </div>
          {needsYou.length > 0 && (
            <ul className="briefing-needs">
              {needsYou.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

// Family quest: cooperative milestones Abi sets ("1,000 items = pizza night").
// Totals come from the nightly scoreboard the report function writes.
export function FamilyQuest({ editable }) {
  const [family, setFamily] = useState(null);
  const [target, setTarget] = useState('');
  const [reward, setReward] = useState('');
  const [teachWho, setTeachWho] = useState('');

  useEffect(() => onSnapshot(doc(db, 'families', 'wireman'), (s) => setFamily(s.data())), []);

  // family total = everyone's finished items + tutor-credit bonus points
  const total = (family?.scoreboard?.totalDone ?? 0) + (family?.bonusPoints ?? 0);

  const KIDS = { luke: 'Luke', layla: 'Layla', logan: 'Logan', lazarus: 'Lazarus' };
  async function logTeach() {
    if (!teachWho) return;
    await updateDoc(doc(db, 'families', 'wireman'), {
      bonusPoints: (family?.bonusPoints ?? 0) + 2,
      tutorLog: [...(family?.tutorLog ?? []), { helper: teachWho, date: todayISO() }].slice(-50),
    });
    setTeachWho('');
  }
  const milestones = [...(family?.milestones ?? [])].sort((a, b) => a.target - b.target);
  const next = milestones.find((m) => m.target > total);

  async function addMilestone() {
    const t = Number(target);
    if (!t || !reward.trim()) return;
    await updateDoc(doc(db, 'families', 'wireman'), {
      milestones: [...(family?.milestones ?? []), { target: t, reward: reward.trim() }],
    });
    setTarget('');
    setReward('');
  }

  async function removeMilestone(i) {
    const list = [...(family?.milestones ?? [])];
    list.splice(i, 1);
    await updateDoc(doc(db, 'families', 'wireman'), { milestones: list });
  }

  if (!editable && !next) return null;

  return (
    <section className="quest-card">
      <h2>🏆 Family quest</h2>
      <p className="quest-total">The family has finished <strong>{total}</strong> items together{family?.scoreboard?.updatedAt ? '' : ' (counts update each evening)'}.</p>
      {next ? (
        <div className="quest-bar-wrap">
          <div className="quest-bar">
            <div className="quest-bar-fill" style={{ width: `${Math.min(100, (total / next.target) * 100)}%` }} />
          </div>
          <p className="quest-next">{next.target - total} more to go → <strong>{next.reward}</strong></p>
        </div>
      ) : (
        editable && <p className="quest-next">No milestone ahead — add one below!</p>
      )}
      {editable && (
        <div className="quest-teach">
          <span>🤝 Sibling taught something? It's worth double:</span>
          <select value={teachWho} onChange={(e) => setTeachWho(e.target.value)}>
            <option value="">who taught?</option>
            {Object.entries(KIDS).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          <button onClick={logTeach} disabled={!teachWho}>+2 points</button>
          {(family?.bonusPoints ?? 0) > 0 && <em>{family.bonusPoints} tutor points so far</em>}
        </div>
      )}
      {editable && (
        <div className="quest-edit">
          {milestones.map((m, i) => (
            <span key={i} className={`quest-chip ${m.target <= total ? 'quest-chip-hit' : ''}`}>
              {m.target}: {m.reward} {m.target <= total && '✓'}
              <button onClick={() => removeMilestone(i)}>✕</button>
            </span>
          ))}
          <span className="quest-add">
            <input type="number" placeholder="500" value={target} onChange={(e) => setTarget(e.target.value)} />
            <input placeholder="Pizza night!" value={reward} onChange={(e) => setReward(e.target.value)} />
            <button onClick={addMilestone}>Add</button>
          </span>
        </div>
      )}
    </section>
  );
}

// Email preferences: which automatic emails go out. Missing key = on.
const EMAILS = [
  ['nightly', 'Nightly report (Mon–Thu 5:30pm)'],
  ['fridayWins', 'Friday wins email'],
  ['sundayPacket', 'Sunday printable packet'],
  ['kidReports', 'Thursday kid-report fallback email'],
];

export function EmailPrefs() {
  const [family, setFamily] = useState(null);
  useEffect(() => onSnapshot(doc(db, 'families', 'wireman'), (s) => setFamily(s.data())), []);

  async function toggle(key) {
    const cur = family?.emailPrefs?.[key] ?? true;
    await updateDoc(doc(db, 'families', 'wireman'), { [`emailPrefs.${key}`]: !cur });
  }

  return (
    <section className="emailprefs-card">
      <h2>📬 Email settings</h2>
      {EMAILS.map(([key, label]) => {
        const on = family?.emailPrefs?.[key] ?? true;
        return (
          <label key={key} className="emailpref-row">
            <input type="checkbox" checked={on} onChange={() => toggle(key)} />
            {label}
          </label>
        );
      })}
    </section>
  );
}
