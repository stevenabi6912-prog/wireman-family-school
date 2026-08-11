import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { resolveContentUrl } from '../lib/assignments';
import './WorkViewer.css';

// The kid's actual work for one assignment: what they typed, the photos they
// took, the grader's question-by-question marks, and the pages it came from.
// Shared by the review queue and the gradebook so Abi sees the same thing
// wherever she is.
export default function WorkViewer({ grade, assignmentId, open }) {
  const id = assignmentId ?? grade?.assignmentId;
  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [photoUrls, setPhotoUrls] = useState([]);
  const [pagesUrl, setPagesUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !id) return;
    setLoading(true);
    Promise.all([
      getDoc(doc(db, 'assignments', id)).then((s) => (s.exists() ? s.data() : null)),
      getDoc(doc(db, 'submissions', id)).then((s) => (s.exists() ? s.data() : null)),
    ])
      .then(([a, sub]) => {
        setAssignment(a);
        setSubmission(sub);
      })
      .finally(() => setLoading(false));
  }, [open, id]);

  useEffect(() => {
    if (!open) return;
    if (assignment?.contentPath) {
      resolveContentUrl(assignment.contentPath).then(setPagesUrl).catch(() => setPagesUrl(null));
    }
    if (submission?.fileUrls?.length) {
      Promise.all(submission.fileUrls.map((p) => resolveContentUrl(p).catch(() => null)))
        .then((urls) => setPhotoUrls(urls.filter(Boolean)));
    }
  }, [open, assignment?.contentPath, submission?.fileUrls]);

  if (!open) return null;
  if (loading) return <p className="work-note">Loading their work…</p>;

  const wrong = (grade?.perQuestion ?? []).filter((q) => q.correct === false);

  return (
    <div className="work-viewer">
      {assignment?.instructions && (
        <p className="work-instructions"><strong>The assignment:</strong> {assignment.instructions}</p>
      )}

      {submission?.text ? (
        <>
          <p className="work-label">What they wrote:</p>
          <pre className="work-answers">{submission.text}</pre>
        </>
      ) : (
        <p className="work-note">
          Nothing typed{photoUrls.length ? ' — their photos are below.' : ' and no photos were turned in.'}
        </p>
      )}

      {photoUrls.length > 0 && (
        <>
          <p className="work-label">Their photos (tap to enlarge):</p>
          <div className="work-photos">
            {photoUrls.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer">
                <img className="work-photo" src={u} alt={`work photo ${i + 1}`} />
              </a>
            ))}
          </div>
        </>
      )}

      {wrong.length > 0 && (
        <>
          <p className="work-label">What the grader marked wrong:</p>
          <ul className="work-wrong">
            {wrong.map((q, i) => (
              <li key={i}><strong>#{q.questionNumber}</strong> {q.note}</li>
            ))}
          </ul>
        </>
      )}

      {grade?.misunderstandingSummary && (
        <p className="work-summary">🔍 {grade.misunderstandingSummary}</p>
      )}

      {pagesUrl && (
        <p>
          <a className="work-pages" href={pagesUrl} target="_blank" rel="noreferrer">
            📖 Open the pages this came from
          </a>
        </p>
      )}
    </div>
  );
}
