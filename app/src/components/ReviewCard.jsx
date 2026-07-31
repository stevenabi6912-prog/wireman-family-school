import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { resolveContentUrl } from '../lib/assignments';
import { gradePct, overrideGrade, approveGrade } from '../lib/grades';

// One grade waiting on Abi — plain words, and the kid's actual work
// (typed answers + photos + the pages they worked from) one tap away.
export default function ReviewCard({ grade, studentName }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [photoUrls, setPhotoUrls] = useState([]);
  const [pagesUrl, setPagesUrl] = useState(null);

  useEffect(() => {
    getDoc(doc(db, 'assignments', grade.assignmentId)).then((s) => {
      if (s.exists()) setAssignment(s.data());
    });
  }, [grade.assignmentId]);

  useEffect(() => {
    if (!open) return;
    getDoc(doc(db, 'submissions', grade.assignmentId)).then((s) => {
      if (s.exists()) setSubmission(s.data());
    });
  }, [open, grade.assignmentId]);

  useEffect(() => {
    if (!open) return;
    if (assignment?.contentPath) {
      resolveContentUrl(assignment.contentPath).then(setPagesUrl).catch(() => {});
    }
    if (submission?.fileUrls?.length) {
      Promise.all(submission.fileUrls.map((p) => resolveContentUrl(p).catch(() => null)))
        .then((urls) => setPhotoUrls(urls.filter(Boolean)));
    }
  }, [open, assignment?.contentPath, submission?.fileUrls]);

  const scored = (grade.overriddenScore ?? grade.score) != null;

  return (
    <li className="review-row">
      <div className="review-row-main">
        <strong>{studentName}</strong> — {assignment?.title ?? 'assignment'}
        {scored && <span className="review-score">Grader's guess: {grade.score}/{grade.maxScore}</span>}
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

        {open && (
          <div className="review-work">
            {submission?.text
              ? <pre className="review-answers">{submission.text}</pre>
              : <p className="review-note">No typed answers{submission?.fileUrls?.length ? ' — see photos below' : ' or photos were turned in'}.</p>}
            {photoUrls.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer">
                <img className="review-photo" src={u} alt={`work photo ${i + 1}`} />
              </a>
            ))}
            {pagesUrl && (
              <p><a className="review-pages-link" href={pagesUrl} target="_blank" rel="noreferrer">📖 Open the pages this came from</a></p>
            )}
          </div>
        )}
      </div>
      <div className="review-actions">
        <input
          type="number"
          placeholder={`Score out of ${grade.maxScore ?? '?'}`}
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button onClick={() => value !== '' && overrideGrade(grade.id, Number(value))} disabled={value === ''}>
          Save my score
        </button>
        <button onClick={() => approveGrade(grade.id)}>{scored ? 'The grader got it right ✓' : 'Mark as handled ✓'}</button>
      </div>
    </li>
  );
}
