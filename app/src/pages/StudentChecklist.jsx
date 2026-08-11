import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { watchDayAssignments, watchUpcomingAssignments, watchOverdueAssignments, todayISO, resolveContentUrl } from '../lib/assignments';
import { resolveTheme } from '../config/themes';
import { playDing, playFanfare, isMuted, setMuted } from '../lib/sounds';
import AssignmentCard from '../components/AssignmentCard';
import ThemePicker from '../components/ThemePicker';
import Confetti from '../components/Confetti';
import BreakRoom from '../components/BreakRoom';
import YearTrail from '../components/YearTrail';
import SchoolCalendar from '../components/SchoolCalendar';
import WeeklyReport from '../components/WeeklyReport';
import ExplorerClub from '../components/ExplorerClub';
import BugReport from '../components/BugReport';
import MemoryBlock from '../components/MemoryBlock';
import { FamilyQuest } from '../components/MorningBriefing';
import { VerseOfDay, SurpriseChest, KudosSend, KudosInbox, PersonalRecords, buddyStage } from '../components/KidExtras';
import { tickWork, breakAvailable, minutesUntilBreak, startBreak } from '../lib/breaks';
import { fetchStreakStats } from '../lib/streaks';
import './StudentChecklist.css';

const DONE_STATUSES = new Set(['submitted', 'graded', 'waived']);

const EMPTY_DAY_LINES = [
  'No school today — go build a fort!',
  'Nothing on the list. Free day!',
  'School\'s closed. Adventure time!',
];

function cheerLine(done, total, large) {
  if (total === 0 || done === 0) return null;
  const frac = done / total;
  if (frac === 1) return null;
  if (total - done === 1) return large ? 'LAST ONE! 💪' : 'One more to go! 💪';
  if (frac >= 0.5) return large ? 'Over halfway! 🚀' : 'Past halfway — keep rolling! 🚀';
  return large ? 'Great start! 🔥' : 'Nice — momentum! 🔥';
}

export default function StudentChecklist() {
  const { studentId: ownStudentId, logout } = useAuth();
  // Abi peeking: /dashboard/kid/:kidId renders a kid's page under her login.
  const { kidId } = useParams();
  const studentId = kidId ?? ownStudentId;
  const parentView = Boolean(kidId);
  const [student, setStudent] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [burst, setBurst] = useState(null); // 'small' | 'big' | null
  const [muted, setMutedState] = useState(isMuted());
  const [headerImageUrl, setHeaderImageUrl] = useState(null);
  const [upcoming, setUpcoming] = useState([]); // future-dated items for the bonus round
  const [overdueRaw, setOverdueRaw] = useState([]); // unfinished from earlier days
  const [breakOpen, setBreakOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [breakReady, setBreakReady] = useState(false);
  const [minsToBreak, setMinsToBreak] = useState(30);
  const [family, setFamily] = useState(null); // pause-the-day + family quest
  const [streakStats, setStreakStats] = useState(null);
  const prevDone = useRef(null);
  const prevBonusDone = useRef(null);
  const date = todayISO();

  useEffect(() => {
    if (!studentId) return;
    const unsubStudent = onSnapshot(doc(db, 'students', studentId), (snap) => {
      if (snap.exists()) setStudent(snap.data());
    });
    const unsubFamily = onSnapshot(doc(db, 'families', 'wireman'), (s) => setFamily(s.data()));
    fetchStreakStats(studentId, date).then(setStreakStats).catch(() => {});
    const unsubDay = watchDayAssignments(studentId, date, setAssignments);
    const unsubUpcoming = watchUpcomingAssignments(studentId, date, setUpcoming);
    const unsubOverdue = watchOverdueAssignments(studentId, date, setOverdueRaw);
    return () => {
      unsubStudent();
      unsubFamily();
      unsubDay();
      unsubUpcoming();
      unsubOverdue();
    };
  }, [studentId, date]);

  // Resolve the kid's optional custom header image (private Storage path)
  useEffect(() => {
    const path = student?.theme?.headerImagePath;
    if (!path) {
      setHeaderImageUrl(null);
      return;
    }
    let cancelled = false;
    resolveContentUrl(path)
      .then((u) => !cancelled && setHeaderImageUrl(u))
      .catch(() => !cancelled && setHeaderImageUrl(null));
    return () => {
      cancelled = true;
    };
  }, [student?.theme?.headerImagePath]);

  // Catch-up first: unfinished items from earlier days go to the FRONT of
  // today's list (plus any caught-up today, so progress doesn't jump around).
  const combined = useMemo(() => {
    if (!assignments) return null;
    const isToday = (t) => {
      const w = t?.toDate?.();
      return w && todayISO() === `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
    };
    const catchUp = overdueRaw
      .filter((a) => !DONE_STATUSES.has(a.status) || isToday(a.updatedAt))
      .map((a) => ({ ...a, catchUp: true }));
    return [...catchUp, ...assignments];
  }, [assignments, overdueRaw]);

  const { doneCount, activeIndex } = useMemo(() => {
    if (!combined) return { doneCount: 0, activeIndex: -1 };
    let done = 0;
    let active = -1;
    for (let i = 0; i < combined.length; i++) {
      if (DONE_STATUSES.has(combined[i].status)) done++;
      else if (active === -1) active = i;
    }
    return { doneCount: done, activeIndex: active };
  }, [combined]);
  const catchUpLeft = combined?.filter((a) => a.catchUp && !DONE_STATUSES.has(a.status)).length ?? 0;

  // ---- pacing guide: the family plan starts school at 8:30. Each item gets
  // a target clock time (8:30 + the estimates of everything before it) so the
  // kids always know roughly where they should be in the day. If Abi paused
  // the day (appointment, errand), every target shifts by that much. ----
  const pauseMinutes = family?.pause?.date === date ? family.pause.minutes : 0;
  const targets = useMemo(() => {
    let t = 8 * 60 + 30 + pauseMinutes;
    if (!combined) return [];
    return combined.map((a) => {
      const start = t;
      t += a.estimatedMinutes ?? 20;
      return start;
    });
  }, [combined, pauseMinutes]);

  const total = combined?.length ?? 0;
  const allDone = total > 0 && activeIndex === -1;

  // ---- bonus round: work ahead, max ONE extra item per subject per day ----
  // "Done ahead today" = future-dated items completed today (updatedAt today).
  const { bonusCandidates, bonusDoneToday, bonusUncapped } = useMemo(() => {
    const doneAheadBySubject = {};
    for (const a of upcoming) {
      if (!DONE_STATUSES.has(a.status)) continue;
      const when = a.updatedAt?.toDate?.();
      if (when && todayISO() === `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`) {
        doneAheadBySubject[a.subjectId] = a;
      }
    }
    // On SCHOOL days: one extra per subject (no six-history binges).
    // On BREAK days (nothing scheduled today): uncapped — items come in
    // plan order, so a day off can be spent doing "the next school day".
    const isBreakDay = (assignments?.length ?? 0) === 0;
    let candidates;
    if (isBreakDay) {
      candidates = upcoming
        .filter((a) => !DONE_STATUSES.has(a.status))
        .sort((x, y) => x.dayIndex - y.dayIndex || x.sequence - y.sequence)
        .slice(0, 10);
    } else {
      const nextBySubject = {};
      for (const a of upcoming) {
        if (DONE_STATUSES.has(a.status)) continue;
        if (doneAheadBySubject[a.subjectId]) continue;
        if (!nextBySubject[a.subjectId]) nextBySubject[a.subjectId] = a;
      }
      candidates = Object.values(nextBySubject).sort((x, y) => x.sequence - y.sequence);
    }
    return {
      bonusCandidates: candidates,
      bonusDoneToday: Object.values(doneAheadBySubject),
      bonusUncapped: isBreakDay,
    };
  }, [upcoming, assignments]);

  // celebrate bonus completions too
  useEffect(() => {
    if (prevBonusDone.current === null) {
      prevBonusDone.current = bonusDoneToday.length;
      return;
    }
    if (bonusDoneToday.length > prevBonusDone.current) {
      playDing(student?.theme?.ding);
      setBurst('small');
    }
    prevBonusDone.current = bonusDoneToday.length;
  }, [bonusDoneToday.length]);

  // Celebrate transitions: ding+confetti per item, fanfare+big confetti for the day
  useEffect(() => {
    if (assignments === null) return;
    if (prevDone.current === null) {
      prevDone.current = doneCount; // first load — no celebration for old progress
      return;
    }
    if (doneCount > prevDone.current) {
      if (allDone) {
        playFanfare();
        setBurst('big');
      } else {
        playDing(student?.theme?.ding);
        setBurst('small');
      }
      // streak/badge numbers move with each completion
      fetchStreakStats(studentId, date).then(setStreakStats).catch(() => {});
    }
    prevDone.current = doneCount;
  }, [doneCount, allDone, assignments]);

  // Work clock: one tick per minute while there's an active item on a visible
  // tab. 30 worked minutes earn a 5-minute brain break.
  useEffect(() => {
    if (!studentId) return;
    setBreakReady(breakAvailable(studentId));
    setMinsToBreak(minutesUntilBreak(studentId));
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && activeIndex >= 0 && !breakOpen) {
        tickWork(studentId);
        setBreakReady(breakAvailable(studentId));
        setMinsToBreak(minutesUntilBreak(studentId));
      }
    }, 60000);
    return () => clearInterval(t);
  }, [studentId, activeIndex, breakOpen]);

  function openBreak() {
    startBreak(studentId);
    setBreakReady(false);
    setMinsToBreak(30);
    setBreakOpen(true);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  const theme = resolveTheme(studentId, student?.theme);
  const large = (student?.grade ?? 8) <= 3;
  const firstName = student?.name ?? '';
  const emptyLine = EMPTY_DAY_LINES[date.split('-').reduce((a, b) => a + Number(b), 0) % EMPTY_DAY_LINES.length];
  const cheer = cheerLine(doneCount, total, large);
  const pct = total ? (doneCount / total) * 100 : 0;

  if (!combined) {
    return <div className="loading-screen">Getting your list ready…</div>;
  }

  const styleVars = {
    '--t-bg': theme.colors.bg,
    '--t-card': theme.colors.card,
    '--t-accent': theme.colors.accent,
    '--t-accent-soft': theme.colors.accentSoft,
    '--t-header': theme.colors.header,
    '--t-text': theme.colors.darkBg ? '#f2f2f8' : '#2a2a2a',
  };

  return (
    <div className={`checklist-screen ${large ? 'checklist-large' : ''}`} style={styleVars}>
      {parentView && (
        <div className="parentview-bar">
          <Link to="/dashboard">← Back to my dashboard</Link>
          <span>You're seeing {firstName}'s page exactly as they do — checking things off here is real.</span>
        </div>
      )}
      <header
        className={`hero-header ${headerImageUrl ? 'hero-header-image' : ''}`}
        style={headerImageUrl ? { backgroundImage: `url(${headerImageUrl})` } : undefined}
      >
        <div className="hero-left">
          <button className="hero-avatar" onClick={() => setPickerOpen(true)} title="Change your look">
            {theme.avatar}
          </button>
          <div>
            <h1>{large ? `Hi ${firstName}!` : `Let's go, ${firstName}!`}</h1>
            <p className="hero-date">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="hero-actions">
          {breakReady && !allDone && (
            <button className="break-btn" onClick={openBreak}>🧠 {large ? 'Break time!' : 'Brain break earned!'}</button>
          )}
          <button className="mine-btn" onClick={() => setPickerOpen(true)}>✨ {large ? 'My look' : 'Make it mine'}</button>
          <div className="hero-small-actions">
            <BugReport studentId={studentId} large={large} />
            <button className="mute-btn" onClick={() => setCalOpen(true)} title="School calendar">📅</button>
            <button className="mute-btn" onClick={toggleMute} title={muted ? 'Turn sounds on' : 'Turn sounds off'}>
              {muted ? '🔇' : '🔊'}
            </button>
            <button className="logout-btn" onClick={logout}>Switch</button>
          </div>
        </div>
      </header>

      <VerseOfDay large={large} />

      <KudosInbox studentId={studentId} />

      {streakStats && (
        <div className="streak-strip">
          {(() => {
            const stage = buddyStage(streakStats.totalDone);
            return (
              <span className="streak-badge streak-buddy" title={stage.next ? `Grows again at ${stage.next.at} items!` : 'Fully grown!'}>
                {stage.emoji} {stage.name}{stage.next && ` · next: ${stage.next.emoji} at ${stage.next.at}`}
              </span>
            );
          })()}
          {streakStats.streak > 0 && (
            <span className="streak-flame">🔥 {streakStats.streak}-day streak{large ? '!' : ''}</span>
          )}
          {streakStats.badges.map((b) => (
            <span key={b.label} className="streak-badge" title={b.label}>{b.emoji} {b.label}</span>
          ))}
        </div>
      )}

      {total === 0 ? (
        <div className="empty-day">
          <div className="empty-day-emoji">{theme.avatar}</div>
          <h2>{emptyLine}</h2>
          <BonusRound
            candidates={bonusCandidates}
            doneToday={bonusDoneToday}
            studentId={studentId}
            large={large}
            uncapped={bonusUncapped}
          />
          <ExplorerClub large={large} />
        </div>
      ) : (
        <>
          <div className="progress-zone">
            <div className="progress-track" role="progressbar" aria-valuenow={doneCount} aria-valuemax={total}>
              <div className="progress-fill" style={{ width: `${pct}%` }} />
              <span className="progress-runner" style={{ left: `calc(${pct}% - 18px)` }}>
                {theme.avatar}
              </span>
              <span className="progress-label">
                {doneCount} of {total} done
              </span>
            </div>
            {catchUpLeft > 0 && (
              <p className="catchup-banner">
                ⏰ {large ? `Finish ${catchUpLeft} from before first!` : `First: ${catchUpLeft} item${catchUpLeft > 1 ? 's' : ''} to catch up from earlier days — then today's list.`}
              </p>
            )}
            {cheer && <p className="cheer-line">{cheer}</p>}
          </div>

          {allDone ? (
            <div className="day-complete">
              <div className="day-complete-emoji">{theme.avatar}</div>
              <div className="day-complete-burst">🌟🎉🌟</div>
              <h2>{large ? 'ALL DONE! You rock!' : `That's everything — great work today, ${firstName}!`}</h2>
              <p>School's out. Go tell Mom!</p>
              <SurpriseChest studentId={studentId} large={large} />
              <KudosSend studentId={studentId} large={large} />
              <BonusRound
                candidates={bonusCandidates}
                doneToday={bonusDoneToday}
                studentId={studentId}
                large={large}
              />
              <ExplorerClub large={large} />
            </div>
          ) : (
            <div className="assignment-list">
              {combined.map((a, i) => (
                <AssignmentCard
                  key={a.id}
                  assignment={a}
                  studentId={studentId}
                  large={large}
                  memoryWork={student?.memoryWork}
                  targetMinutes={targets[i]}
                  grade={student?.grade}
                  state={DONE_STATUSES.has(a.status) ? 'done' : i === activeIndex ? 'active' : 'locked'}
                />
              ))}
            </div>
          )}
        </>
      )}

      <MemoryBlock studentId={studentId} large={large} />

      <WeeklyReport studentId={studentId} justFinished={allDone} />

      <FamilyQuest />

      <PersonalRecords stats={streakStats} large={large} />

      <YearTrail studentId={studentId} avatar={theme.avatar} />

      {burst && <Confetti size={burst} style={student?.theme?.confetti} onDone={() => setBurst(null)} />}

      {breakOpen && (
        <BreakRoom studentId={studentId} large={large} onClose={() => setBreakOpen(false)} />
      )}

      {calOpen && <SchoolCalendar onClose={() => setCalOpen(false)} />}

      {pickerOpen && (
        <ThemePicker
          studentId={studentId}
          current={{
            palette: theme.palette,
            avatar: theme.avatar,
            headerImagePath: student?.theme?.headerImagePath ?? null,
            ding: student?.theme?.ding ?? 'classic',
            confetti: student?.theme?.confetti ?? 'classic',
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// Work ahead after the day is done: the NEXT item from each subject, one
// extra per subject per day. Worked-ahead items keep their future date, so
// that day starts already partly finished.
function BonusRound({ candidates, doneToday, studentId, large, uncapped }) {
  const [open, setOpen] = useState(false);

  if (candidates.length === 0 && doneToday.length === 0) return null;

  return (
    <div className="bonus-round">
      {doneToday.length > 0 && (
        <p className="bonus-banked">
          🏦 {doneToday.length} bonus item{doneToday.length > 1 ? 's' : ''} banked for later days!
        </p>
      )}
      {candidates.length > 0 && !open && (
        <button className="bonus-open-btn" onClick={() => setOpen(true)}>
          {large ? '⚡ Do more!' : '⚡ Feeling unstoppable? Get a head start'}
        </button>
      )}
      {open && candidates.length > 0 && (
        <div className="bonus-list">
          <p className="bonus-hint">
            {uncapped
              ? (large ? 'Day off — do as much as you want!' : 'It\'s a day off — no limits today. Items come in order; everything you finish is banked.')
              : (large ? 'Pick one from each — tomorrow gets easier!' : 'One bonus item per subject — anything you finish is already done when its day comes.')}
          </p>
          {candidates.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              studentId={studentId}
              large={large}
              state="active"
            />
          ))}
        </div>
      )}
    </div>
  );
}
