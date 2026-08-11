import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { overrideGrade, approveGrade, scoreLabel } from '../lib/grades';
import WorkViewer from './WorkViewer';

// One grade waiting on Abi — plain words, and the kid's actual work
// (typed answers + photos + the pages they worked from) one tap away.
export default function ReviewCard({ grade, studentName }) {
  const [value, setValue] = useState('');
  const [outOf, setOutOf] = useState('');
  const [open, setOpen] = useState(false);
  const [assignment, setAssignment] = useState(null);

  useEffect(() => {
    getDoc(doc(db, 'assignments', grade.assignmentId)).then((s) => {
      if (s.exists()) setAssignment(s.data());
    });
  }, [grade.assignmentId]);



  const scored = (grade.overriddenScore ?? grade.score) != null;
  // Keyless items have no "out of" on file — ask for it, or the saved score
  // has nothing to be out of and can't count toward an average.
  const needsOutOf = !(grade.maxScore > 0);
  const canSave = value !== '' && (!needsOutOf || Number(outOf) > 0);

  return (
    <li className="review-row">
      <div className="review-row-main">
        <strong>{studentName}</strong> — {assignment?.title ?? 'assignment'}
        {scored && <span className="review-score">Grader's guess: {scoreLabel(grade)}</span>}
        <p className="review-reason">
          {grade.reviewReason?.includes('No answer key')
            ? 'There\'s no answer key for this one, so it\'s all yours to grade.'
            : 'The grader wasn\'t sure about this one and wants you to double-check.'}
        </p>
        {grade.misunderstandingSummary && (
          <p className="review-note">What the grader noticed: “{grade.misunderstandingSummary}”</p>
        )}

        <button className="review-see-work" onClick={() => setOpen(!open)}>
          {open ? 'Hide their work' : '👀 See their work'}
        </button>

        <WorkViewer grade={grade} open={open} />
      </div>
      <div className="review-actions">
        <input
          type="number"
          placeholder={needsOutOf ? 'Score' : `Score out of ${grade.maxScore}`}
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {needsOutOf && (
          <>
            <span className="review-outof-sep">out of</span>
            <input
              type="number"
              placeholder="e.g. 10"
              min="1"
              value={outOf}
              onChange={(e) => setOutOf(e.target.value)}
            />
          </>
        )}
        <button
          onClick={() => canSave && overrideGrade(grade.id, Number(value), needsOutOf ? Number(outOf) : null)}
          disabled={!canSave}
        >
          Save my score
        </button>
        <button onClick={() => approveGrade(grade.id)}>{scored ? 'The grader got it right ✓' : 'Mark as handled ✓'}</button>
      </div>
    </li>
  );
}
