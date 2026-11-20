import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSubmission, saveDraft, submitWork, resolveContentUrl } from '../lib/assignments';
import './FillableTest.css';

const AUTOSAVE_MS = 1500;

// A test the kid answers right on the page: each test page is shown as a
// picture, and answer boxes sit on top of it exactly where the blanks, the
// multiple-choice letters and the essay lines are (`assignment.fillable`,
// written by scripts/add-sotw2-fillable-tests.js).
//
// Why pictures instead of the PDF itself: the browser's own PDF viewer lives
// in a cross-origin frame, so whatever a kid types into a fillable PDF there
// is invisible to us — it could never autosave, be turned in, or be graded.
//
// What gets saved: `fields` (box id → answer, so a closed tab reopens exactly
// as it was left) and `text` — the same answers as a numbered list. Everything
// downstream (Mom's review screen, the gradebook, the grader) already reads
// `text`, so a fillable test needs nothing new on that side.
//
// Same save discipline as SubmissionForm: one write queue, always writing
// what is on screen right now.
export default function FillableTest({ assignment, studentId, large }) {
  const { pages = [], fields = [] } = assignment.fillable ?? {};
  const [pageUrls, setPageUrls] = useState(null);
  const [printUrl, setPrintUrl] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [values, setValues] = useState({});
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
  const [submitting, setSubmitting] = useState(false);
  const [confirmBlank, setConfirmBlank] = useState(false);
  const valuesRef = useRef({});
  const loaded = useRef(false);
  const timer = useRef(null);
  const writeQueue = useRef(Promise.resolve());

  const pagesKey = pages.join('|');
  useEffect(() => {
    let cancelled = false;
    setPageUrls(null);
    setLoadError(false);
    Promise.all(pages.map((p) => resolveContentUrl(p)))
      .then((urls) => !cancelled && setPageUrls(urls))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey]);

  useEffect(() => {
    let cancelled = false;
    setPrintUrl(null);
    if (assignment.contentPath) {
      resolveContentUrl(assignment.contentPath)
        .then((u) => !cancelled && setPrintUrl(u))
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [assignment.contentPath]);

  useEffect(() => {
    loaded.current = false;
    valuesRef.current = {};
    setValues({});
    setConfirmBlank(false);
    loadSubmission(assignment.id)
      .then((sub) => {
        if (sub?.isDraft && sub.fields) {
          valuesRef.current = { ...sub.fields };
          setValues(valuesRef.current);
        }
      })
      .catch(() => {}) // no draft yet — start blank
      .finally(() => {
        loaded.current = true;
      });
    return () => clearTimeout(timer.current);
  }, [assignment.id]);

  // One entry per question, in order: the boxes that belong to it.
  const questions = useMemo(() => {
    const byNumber = new Map();
    for (const f of fields) {
      if (!byNumber.has(f.n)) byNumber.set(f.n, []);
      byNumber.get(f.n).push(f);
    }
    return [...byNumber.entries()].sort((a, b) => a[0] - b[0]);
  }, [fields]);

  const fieldId = (f) => (f.k === 'choice' ? `q${f.n}` : f.id);

  function answerText(current) {
    return questions
      .map(([n, group]) => {
        const parts = group.map((f) => String(current[fieldId(f)] ?? '').trim());
        const answer = parts.some(Boolean) ? parts.map((p) => p || '(blank)').join(' | ') : '(blank)';
        return `${n}. ${answer}`;
      })
      .join('\n');
  }

  const unanswered = questions.filter(([, group]) =>
    group.some((f) => !String(values[fieldId(f)] ?? '').trim())
  ).length;
  const answeredAny = unanswered < questions.length;

  function queueSave() {
    setSaveState('saving');
    writeQueue.current = writeQueue.current
      .then(() => saveDraft(assignment, studentId, {
        responseType: 'text',
        fields: valuesRef.current,
        text: answerText(valuesRef.current),
      }))
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('idle')); // keep the queue alive for the next save
    return writeQueue.current;
  }

  function setValue(id, value) {
    valuesRef.current = { ...valuesRef.current, [id]: value };
    setValues(valuesRef.current);
    setConfirmBlank(false);
    if (!loaded.current) return;
    setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(queueSave, AUTOSAVE_MS);
  }

  async function onSubmit() {
    if (unanswered > 0 && !confirmBlank) {
      setConfirmBlank(true); // first tap warns; second tap turns it in anyway
      return;
    }
    setSubmitting(true);
    try {
      clearTimeout(timer.current);
      await writeQueue.current.catch(() => {});
      await submitWork(assignment, studentId, {
        responseType: 'text',
        fields: valuesRef.current,
        text: answerText(valuesRef.current),
        fileUrls: [],
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <p className="pdf-error">Couldn't load this test. Tell Mom!</p>;
  if (!pageUrls) return <p className="pdf-loading">Loading your test…</p>;

  const pos = (b) => ({
    left: `${b.x * 100}%`,
    top: `${b.y * 100}%`,
    width: `${b.w * 100}%`,
    height: `${b.h * 100}%`,
  });

  return (
    <div className={`ftest ${large ? 'ftest-large' : ''}`}>
      <p className="ftest-how">
        Type in the blue boxes and tap the letter of your choice. Your answers save by themselves.
      </p>
      {pageUrls.map((url, i) => {
        const pageNo = i + 1;
        return (
          <div className="ftest-page" key={url}>
            <img src={url} alt={`Test page ${pageNo}`} draggable={false} />
            {fields.map((f) => {
              if (f.k === 'choice') {
                const id = fieldId(f);
                return f.opts
                  .filter((o) => o.p === pageNo)
                  .map((o) => (
                    <button
                      type="button"
                      key={`${id}-${o.v}`}
                      className={`ftest-choice ${values[id] === o.v ? 'ftest-choice-on' : ''}`}
                      style={pos(o)}
                      aria-pressed={values[id] === o.v}
                      aria-label={`Question ${f.n}, choice ${o.v}`}
                      onClick={() => setValue(id, values[id] === o.v ? '' : o.v)}
                    />
                  ));
              }
              if (f.p !== pageNo) return null;
              if (f.k === 'essay') {
                return (
                  <textarea
                    key={f.id}
                    className="ftest-essay"
                    style={pos(f)}
                    value={values[f.id] ?? ''}
                    aria-label={`Question ${f.n}`}
                    onChange={(e) => setValue(f.id, e.target.value)}
                  />
                );
              }
              return (
                <input
                  key={f.id}
                  type="text"
                  className="ftest-blank"
                  style={pos(f)}
                  value={values[f.id] ?? ''}
                  aria-label={`Question ${f.n}`}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  onChange={(e) => setValue(f.id, e.target.value)}
                />
              );
            })}
          </div>
        );
      })}

      <div className="ftest-footer">
        <span className={`autosave-note autosave-${saveState}`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : ''}
        </span>
        <span className="ftest-count">
          {unanswered === 0
            ? 'Every question answered ✓'
            : `${unanswered} of ${questions.length} still blank`}
        </span>
        {printUrl && (
          <a className="ftest-print" href={printUrl} target="_blank" rel="noreferrer">
            🖨️ Paper copy
          </a>
        )}
      </div>
      {confirmBlank && (
        <p className="ftest-warn">
          ⚠️ {unanswered === 1 ? '1 question is' : `${unanswered} questions are`} still blank.
          Tap again to turn it in anyway.
        </p>
      )}
      <button className="submit-btn" onClick={onSubmit} disabled={submitting || !answeredAny}>
        {submitting ? 'Turning in…' : confirmBlank ? 'Turn it in anyway' : 'Turn in my test!'}
      </button>
    </div>
  );
}
