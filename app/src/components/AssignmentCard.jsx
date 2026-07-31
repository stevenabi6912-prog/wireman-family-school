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

export default function AssignmentCard({ assignment, studentId, state, large }) {
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
          {assignment.instructions && <p className="assignment-instructions">{assignment.instructions}</p>}

          {assignment.itemType === 'video' && (
            assignment.externalUrl ? (
              <a className="video-link" href={assignment.externalUrl} target="_blank" rel="noreferrer">
                ▶ Open your math lesson
              </a>
            ) : (
              <p className="video-placeholder">Your math video link is coming soon — ask Mom which lesson to watch.</p>
            )
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
