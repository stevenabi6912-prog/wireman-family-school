import { useEffect, useRef, useState } from 'react';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';
import PdfViewer from './PdfViewer';
import SubmissionForm from './SubmissionForm';
import { MathSprint } from './KidExtras';
import { markStarted, completeAssignment, resolveContentUrl, undoCompletion } from '../lib/assignments';
import { reopenAssignment } from '../lib/parentData';

const TYPE_LABELS = {
  reading: '📖 Reading',
  worksheet: '✏️ Worksheet',
  test: '📝 Test',
  memorization: '🗣️ Memorize & recite',
  bible: '🙏 Bible',
  project: '🎨 Project',
  video: '🎬 Video lesson',
  audio: '🎧 Listen & speak',
  task: '⭐ From Mom',
};

// Checkoff-only types have no typed submission: Bible and memorization are done
// with a parent in person; reading, video, and audio just need a "done" tap.
const CHECKOFF_TYPES = new Set(['bible', 'memorization', 'reading', 'video', 'audio', 'task']);

function clockLabel(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
}

// Gentle pacing nudge for the active item only: compares now against the
// item's target start (with a 10-minute grace) — a goal, never a lock.
function paceLine(targetMinutes, large) {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  if (nowMins < 8 * 60 + 30 || nowMins > 16 * 60) return null; // outside the school-day window
  const diff = nowMins - targetMinutes;
  if (diff <= 10) return large ? '🕘 Right on track!' : '🕘 Right on pace — nice!';
  if (diff <= 40) return large ? '🕘 A little behind — keep going!' : '🕘 A bit behind pace — no stress, just keep moving!';
  return large ? '🕘 Way behind — power time!' : '🕘 Behind pace — buckle down and you can still catch the day!';
}

export default function AssignmentCard({
  assignment, studentId, state, large, memoryWork, targetMinutes, grade,
  parentView, undoable,
}) {
  // state: 'locked' | 'active' | 'done'
  const isActive = state === 'active';
  const [reopening, setReopening] = useState(false);

  // Abi can always send an item back. A kid can only take back an accidental
  // tap on a check-off item that hasn't been graded yet.
  const canParentReopen = parentView && state === 'done';
  const canKidUndo =
    !parentView && state === 'done' && undoable &&
    assignment.status === 'submitted' && CHECKOFF_TYPES.has(assignment.itemType);

  async function reopen() {
    setReopening(true);
    try {
      await reopenAssignment(assignment.id);
    } finally {
      setReopening(false);
    }
  }

  // Start the clock the first time this item becomes the active one.
  useEffect(() => {
    if (isActive && !assignment.startedAt) {
      markStarted(assignment.id).catch(() => {});
    }
  }, [isActive, assignment.id, assignment.startedAt]);

  async function markDone() {
    await completeAssignment(assignment);
  }

  return (
    <div className={`assignment-card assignment-${state} ${large ? 'assignment-large' : ''}`}>
      <div className="assignment-header">
        <span className="assignment-type">{assignment.catchUp && state !== 'done' ? '⏰ ' : ''}{TYPE_LABELS[assignment.itemType] ?? assignment.itemType}</span>
        <span className="assignment-title">{assignment.title}</span>
        {targetMinutes != null && state !== 'done' && (
          <span className="assignment-target">🕘 {clockLabel(targetMinutes)}</span>
        )}
        <span className="assignment-time">
          {state === 'done' ? '✅' : state === 'locked' ? '🔒' : `~${assignment.estimatedMinutes} min`}
        </span>
      </div>

      {canParentReopen && (
        <div className="reopen-row">
          <button className="reopen-btn" onClick={reopen} disabled={reopening}>
            {reopening ? 'Reopening…' : '↩️ Let them do this again'}
          </button>
          <span className="reopen-hint">Clears the score and the timer — it goes back on their list.</span>
        </div>
      )}

      {canKidUndo && (
        <div className="reopen-row">
          <button className="reopen-btn" onClick={() => undoCompletion(assignment.id)}>
            ↩️ Oops — I'm not done yet!
          </button>
        </div>
      )}

      {isActive && (
        <div className="assignment-body">
          {targetMinutes != null && paceLine(targetMinutes, large) && (
            <p className="pace-line">{paceLine(targetMinutes, large)}</p>
          )}
          {assignment.parentNote && (
            <p className="parent-note">📌 From Mom: {assignment.parentNote}</p>
          )}
          {assignment.parentVoicePath && <MomSays path={assignment.parentVoicePath} />}

          {assignment.subjectId === 'math' && assignment.itemType === 'video' && (
            <MathSprint studentId={studentId} grade={grade ?? 8} large={large} />
          )}
          {assignment.instructions && (
            <p className="assignment-instructions">
              {assignment.instructions}
              {'speechSynthesis' in window && (
                <button
                  className="speak-btn"
                  title="Read it to me"
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance(`${assignment.title}. ${assignment.instructions}`);
                    u.rate = 0.95;
                    window.speechSynthesis.speak(u);
                  }}
                >
                  🔈
                </button>
              )}
            </p>
          )}

          {assignment.itemType === 'video' && (
            assignment.externalUrl ? (
              <a className="video-link" href={assignment.externalUrl} target="_blank" rel="noreferrer">
                ▶ Open your math lesson
              </a>
            ) : (
              <p className="video-placeholder">Your math video link is coming soon — ask Mom which lesson to watch.</p>
            )
          )}

          <ChapterAudio assignment={assignment} />

          {assignment.itemType === 'memorization' && memoryWork && (
            <div className="memwork-list">
              <p className="memwork-list-title">📜 Your memory work from Mom:</p>
              <pre className="memwork-list-body">{memoryWork}</pre>
            </div>
          )}

          {assignment.contentPath && (
            assignment.contentPath.endsWith('.mp3')
              ? <LessonAudio path={assignment.contentPath} large={large} />
              : <PdfViewer contentPath={assignment.contentPath} />
          )}

          {assignment.itemType === 'audio' && (
            <EchoRecorder assignment={assignment} studentId={studentId} large={large} />
          )}

          {CHECKOFF_TYPES.has(assignment.itemType) ? (
            <button className="submit-btn" onClick={markDone}>
              {assignment.itemType === 'memorization'
                ? 'I recited it to Mom ✓'
                : assignment.itemType === 'bible'
                  ? 'We finished our Bible lesson ✓'
                  : assignment.itemType === 'audio'
                    ? 'I said it all out loud ✓'
                    : 'I finished it ✓'}
            </button>
          ) : (
            <SubmissionForm
              assignment={assignment}
              studentId={studentId}
              large={large}
              onSubmitted={() => {}}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Audio players remember where you left off (per track, per device) so a
// snack break doesn't mean starting a 12-minute chapter over.
function useAudioBookmark(path) {
  const audioRef = useRef(null);
  const lastSave = useRef(0);
  const key = `apos:${path}`;

  function onLoadedMetadata() {
    const a = audioRef.current;
    const saved = Number(localStorage.getItem(key));
    if (a && saved > 5 && saved < a.duration - 10) a.currentTime = saved;
  }

  function onTimeUpdate() {
    const a = audioRef.current;
    if (!a) return;
    const now = Date.now();
    if (now - lastSave.current > 3000) {
      lastSave.current = now;
      localStorage.setItem(key, String(a.currentTime));
    }
  }

  function onEnded() {
    localStorage.removeItem(key);
  }

  return { ref: audioRef, onLoadedMetadata, onTimeUpdate, onEnded };
}

// Audio-lesson content (e.g. daily Flip Flop Spanish): a play button that
// resolves the private Storage track and streams it in place.
function LessonAudio({ path, large }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const bookmark = useAudioBookmark(path);

  async function load() {
    setLoading(true);
    try {
      setUrl(await resolveContentUrl(path));
    } catch {
      setUrl(null);
    }
    setLoading(false);
  }

  if (url) return <audio className="chapter-audio" controls autoPlay src={url} {...bookmark} />;
  return (
    <button className="video-link" onClick={load} disabled={loading}>
      {loading ? 'Loading…' : large ? '▶ Play my Spanish!' : '▶ Play today\'s lesson'}
    </button>
  );
}

// Say-it-back recorder for Spanish: record yourself echoing the lesson, hear
// it back, and it lands on Mom's "Spanish echoes" shelf automatically.
function EchoRecorder({ assignment, studentId, large }) {
  const [state, setState] = useState('idle'); // idle | recording | saving | done | error
  const [playbackUrl, setPlaybackUrl] = useState(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        setPlaybackUrl(URL.createObjectURL(blob));
        setState('saving');
        try {
          await uploadBytes(
            ref(storage, `submissions/${studentId}/echo/${assignment.id}-${Date.now()}.webm`),
            blob
          );
          setState('done');
        } catch {
          setState('done'); // playback still works locally even if upload failed
        }
      };
      rec.start();
      recRef.current = rec;
      setState('recording');
    } catch {
      setState('error');
    }
  }

  function stop() {
    recRef.current?.stop();
  }

  if (state === 'error') return null; // no mic — hide quietly

  return (
    <div className="echo-recorder">
      {state === 'recording' ? (
        <button className="echo-btn echo-btn-rec" onClick={stop}>⏹ {large ? 'Stop!' : 'Stop recording'}</button>
      ) : (
        <button className="echo-btn" onClick={start}>
          🎙️ {large ? 'Say it back!' : state === 'idle' ? 'Record yourself saying it' : 'Record again'}
        </button>
      )}
      {playbackUrl && state !== 'recording' && (
        <span className="echo-play">
          <audio controls src={playbackUrl} />
          {state === 'done' && <em className="echo-sent">Sent to Mom ✓</em>}
          {state === 'saving' && <em className="echo-sent">Saving…</em>}
        </span>
      )}
    </div>
  );
}

// Story of the World audiobook: any history item that names a chapter gets a
// listen button, so the younger kids can hear the story read aloud.
function ChapterAudio({ assignment }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const chapter =
    assignment.subjectId === 'history'
      ? assignment.title?.match(/Ch(?:apter|\.)\s*(\d+)/)?.[1]
      : null;

  if (!chapter) return null;

  async function load() {
    setLoading(true);
    try {
      const u = await resolveContentUrl(`curriculum/history/sotw2-audio/chapter-${chapter}.mp3`);
      setUrl(u);
    } catch {
      setUrl('missing');
    }
    setLoading(false);
  }

  if (url && url !== 'missing') {
    return <ChapterAudioPlayer url={url} path={`curriculum/history/sotw2-audio/chapter-${chapter}.mp3`} />;
  }
  if (url === 'missing') return null;
  return (
    <button className="video-link" onClick={load} disabled={loading}>
      {loading ? 'Loading the story…' : `🎧 Listen to Chapter ${chapter}`}
    </button>
  );
}

function ChapterAudioPlayer({ url, path }) {
  const bookmark = useAudioBookmark(path);
  return <audio className="chapter-audio" controls autoPlay src={url} {...bookmark} />;
}

// Abi's recorded voice note on this assignment.
function MomSays({ path }) {
  const [url, setUrl] = useState(null);
  async function load() {
    try { setUrl(await resolveContentUrl(path)); } catch { /* note missing */ }
  }
  if (url) return <audio className="chapter-audio" controls autoPlay src={url} />;
  return <button className="video-link" onClick={load}>▶ Mom says…</button>;
}
