import { useEffect } from 'react';
import PdfViewer from './PdfViewer';
import SubmissionForm from './SubmissionForm';
import { markStarted, completeAssignment } from '../lib/assignments';

const TYPE_LABELS = {
  reading: '📖 Reading',
  worksheet: '✏️ Worksheet',
  test: '📝 Test',
  memorization: '🗣️ Memorize & recite',
  bible: '🙏 Bible',
  project: '🎨 Project',
  video: '🎬 Video lesson',
};

// Checkoff-only types have no typed submission: Bible and memorization are done
// with a parent in person; reading and video just need a "done" tap.
const CHECKOFF_TYPES = new Set(['bible', 'memorization', 'reading', 'video']);

export default function AssignmentCard({ assignment, studentId, state, large, memoryWork }) {
  // state: 'locked' | 'active' | 'done'
  const isActive = state === 'active';

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
        <span className="assignment-time">
          {state === 'done' ? '✅' : state === 'locked' ? '🔒' : `~${assignment.estimatedMinutes} min`}
        </span>
      </div>

      {isActive && (
        <div className="assignment-body">
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

          {assignment.itemType === 'memorization' && memoryWork && (
            <div className="memwork-list">
              <p className="memwork-list-title">📜 Your memory work from Mom:</p>
              <pre className="memwork-list-body">{memoryWork}</pre>
            </div>
          )}

          {assignment.contentPath && <PdfViewer contentPath={assignment.contentPath} />}

          {CHECKOFF_TYPES.has(assignment.itemType) ? (
            <button className="submit-btn" onClick={markDone}>
              {assignment.itemType === 'memorization'
                ? 'I recited it to Mom ✓'
                : assignment.itemType === 'bible'
                  ? 'We finished our Bible lesson ✓'
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
