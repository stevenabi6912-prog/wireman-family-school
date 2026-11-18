import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router-dom';
import { arrayUnion, collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { buildCalendar, toISO } from '../lib/calendar';
import { resolveTheme } from '../config/themes';
import {
  SCHOOL_NAME, SCHOOL_YEAR, REPORT_KIDS, LETTER_SCALE,
  buildTermSystems, buildCard, termRangeLabel,
} from '../lib/reportCards';
import './ReportCards.css';

const CHOICE_KEY = 'wfs-reportcards-term';

function readChoice() {
  try {
    return JSON.parse(localStorage.getItem(CHOICE_KEY)) ?? {};
  } catch {
    return {};
  }
}

const SCALE_TEXT = LETTER_SCALE.map((s, i) => {
  if (i === 0) return `${s.letter} ${s.min}–100`;
  const top = LETTER_SCALE[i - 1].min;
  return i === LETTER_SCALE.length - 1 ? `${s.letter} below ${top}` : `${s.letter} ${s.min}–${top - 1}`;
}).join('  ·  ');

// Phone photos sometimes arrive with no MIME type at all; go by the name then.
function fileType(file) {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return '';
}

const isImage = (att) => String(att.contentType ?? '').startsWith('image/');

export default function ReportCards() {
  const [data, setData] = useState(null); // { students, assignments, grades, calendar }
  const [loadError, setLoadError] = useState(false);
  const [choice, setChoice] = useState(readChoice);

  // Abi's side of each card for the term on screen, keyed by kid.
  const [loadedTermId, setLoadedTermId] = useState(null);
  const [comments, setComments] = useState({});
  const [savedComments, setSavedComments] = useState({});
  const [attachments, setAttachments] = useState({});
  const [unreadable, setUnreadable] = useState({}); // kid -> their doc failed to load
  const [saveState, setSaveState] = useState({}); // kid -> 'saving' | 'saved' | 'error'
  const [uploadState, setUploadState] = useState({}); // kid -> { busy, error }
  const [urls, setUrls] = useState({}); // storage path -> download url (null = unavailable)
  const [brokenImages, setBrokenImages] = useState({}); // path -> browser couldn't show it

  const [printing, setPrinting] = useState(null); // null | 'all' | kid id

  // The whole year in one read: this page is opened on demand, a few times a
  // term, so live listeners would be overkill.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [studentSnap, assignmentSnap, gradeSnap, familySnap] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'assignments')),
          getDocs(collection(db, 'grades')),
          getDoc(doc(db, 'families', 'wireman')),
        ]);
        const students = {};
        studentSnap.forEach((d) => { students[d.id] = d.data(); });
        let calendar = null;
        try {
          calendar = buildCalendar(familySnap.data(), 150);
        } catch { /* no calendar on file: trimesters just aren't offered */ }
        if (!alive) return;
        setData({
          students,
          assignments: assignmentSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          grades: gradeSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          calendar,
        });
      } catch {
        if (alive) setLoadError(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    document.body.classList.add('rc-page');
    return () => document.body.classList.remove('rc-page');
  }, []);

  const systems = useMemo(() => buildTermSystems(data?.calendar), [data]);
  const system = systems.find((s) => s.id === choice.system) ?? systems[0];
  const term = useMemo(() => {
    const today = toISO(new Date());
    return system.terms.find((t) => t.id === choice.termId)
      ?? system.terms.find((t) => today >= t.start && today <= t.end)
      ?? system.terms[0];
  }, [system, choice.termId]);

  // Saves and uploads finish after an await; this is how they tell whether
  // Abi has moved on to another term in the meantime.
  const termIdRef = useRef(term.id);
  termIdRef.current = term.id;

  function choose(next) {
    setChoice(next);
    try {
      localStorage.setItem(CHOICE_KEY, JSON.stringify(next));
    } catch { /* private window: the choice just isn't remembered */ }
  }

  useEffect(() => {
    if (!data) return undefined;
    let alive = true;
    setLoadedTermId(null);
    setSaveState({});
    setUploadState({});
    (async () => {
      const nextComments = {};
      const nextAttachments = {};
      const failed = {};
      await Promise.all(REPORT_KIDS.map(async (kid) => {
        try {
          const saved = (await getDoc(doc(db, 'reportCards', `${kid}-${term.id}`))).data();
          nextComments[kid] = saved?.comments ?? '';
          nextAttachments[kid] = Array.isArray(saved?.attachments) ? saved.attachments : [];
        } catch {
          nextComments[kid] = '';
          nextAttachments[kid] = [];
          failed[kid] = true;
        }
      }));
      if (!alive) return;
      setComments(nextComments);
      setSavedComments(nextComments);
      setAttachments(nextAttachments);
      setUnreadable(failed);
      setLoadedTermId(term.id);
    })();
    return () => { alive = false; };
  }, [data, term.id]);

  const requestedUrls = useRef(new Set());
  useEffect(() => {
    for (const list of Object.values(attachments)) {
      for (const att of list) {
        if (requestedUrls.current.has(att.path)) continue;
        requestedUrls.current.add(att.path);
        getDownloadURL(ref(storage, att.path))
          .then((url) => setUrls((m) => ({ ...m, [att.path]: url })))
          .catch(() => setUrls((m) => ({ ...m, [att.path]: null })));
      }
    }
  }, [attachments]);

  const cards = useMemo(() => {
    if (!data) return {};
    const out = {};
    for (const kid of REPORT_KIDS) out[kid] = buildCard(kid, term, data.assignments, data.grades);
    return out;
  }, [data, term]);

  const nameOf = (kid) => data?.students?.[kid]?.name ?? kid;
  const ready = loadedTermId === term.id;

  // Same doc and fields the Records page always wrote, so comments typed
  // there are the ones that show up here.
  async function saveComment(kid) {
    if (!ready || unreadable[kid]) return;
    const text = comments[kid] ?? '';
    if (text === (savedComments[kid] ?? '')) return;
    const termId = term.id;
    setSaveState((s) => ({ ...s, [kid]: 'saving' }));
    try {
      await setDoc(doc(db, 'reportCards', `${kid}-${termId}`), {
        studentId: kid,
        term: termId,
        comments: text,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (termIdRef.current !== termId) return;
      setSavedComments((s) => ({ ...s, [kid]: text }));
      setSaveState((s) => ({ ...s, [kid]: 'saved' }));
    } catch {
      if (termIdRef.current === termId) setSaveState((s) => ({ ...s, [kid]: 'error' }));
    }
  }

  async function attach(kid, fileList) {
    const files = [...fileList];
    if (!files.length || !ready || unreadable[kid]) return;
    const termId = term.id;
    const skipped = files.filter((f) => !/^(image\/|application\/pdf$)/.test(fileType(f)));
    setUploadState((s) => ({ ...s, [kid]: { busy: true } }));
    let error = skipped.length ? `Only photos and PDFs can be attached — skipped ${skipped.map((f) => f.name).join(', ')}.` : null;
    for (const file of files) {
      if (skipped.includes(file)) continue;
      const contentType = fileType(file);
      const path = `reportcards/${kid}/${termId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
      const att = { path, name: file.name, contentType };
      try {
        await uploadBytes(ref(storage, path), file, { contentType });
        await setDoc(doc(db, 'reportCards', `${kid}-${termId}`), {
          studentId: kid,
          term: termId,
          attachments: arrayUnion(att),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        if (termIdRef.current === termId) {
          setAttachments((m) => ({ ...m, [kid]: [...(m[kid] ?? []), att] }));
        }
      } catch {
        error = `“${file.name}” didn't upload. Check the connection and try again.`;
        break;
      }
    }
    if (termIdRef.current === termId) setUploadState((s) => ({ ...s, [kid]: { busy: false, error } }));
  }

  async function removeAttachment(kid, att) {
    if (!window.confirm(`Remove “${att.name}” from ${nameOf(kid)}'s ${term.label} report card? The uploaded file is deleted.`)) return;
    const termId = term.id;
    const remaining = (attachments[kid] ?? []).filter((x) => x.path !== att.path);
    try {
      // Record first: if the file delete then fails we're left with a stray
      // file nobody sees, never a card pointing at a file that's gone.
      await setDoc(doc(db, 'reportCards', `${kid}-${termId}`), {
        attachments: remaining,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (termIdRef.current === termId) setAttachments((m) => ({ ...m, [kid]: remaining }));
      await deleteObject(ref(storage, att.path)).catch(() => {});
    } catch {
      if (termIdRef.current === termId) {
        setUploadState((s) => ({ ...s, [kid]: { busy: false, error: `Couldn't remove “${att.name}”. Try again.` } }));
      }
    }
  }

  // Printing one card = hiding the others for the length of the print dialog.
  // The switch has to be on the page before window.print() runs (hence
  // flushSync), and print() has to be called straight from the click or
  // Safari asks "this page is trying to print" first. Chrome blocks inside
  // print(); Safari returns at once — in both, afterprint is what puts things
  // back, and the next click anywhere is the safety net if it never fires.
  function print(which) {
    const title = document.title;
    const finish = () => {
      window.removeEventListener('afterprint', finish);
      document.removeEventListener('pointerdown', finish);
      document.title = title;
      setPrinting(null);
    };
    document.activeElement?.blur?.(); // a comment still being typed saves first
    flushSync(() => setPrinting(which));
    // the browser offers the page title as the PDF's file name
    document.title = `${which === 'all' ? 'Report Cards' : `Report Card — ${nameOf(which)}`} — ${term.label} ${SCHOOL_YEAR}`;
    window.addEventListener('afterprint', finish);
    document.addEventListener('pointerdown', finish);
    window.print();
  }

  const printed = REPORT_KIDS.filter((kid) => !printing || printing === 'all' || printing === kid);

  return (
    <div className="rc-screen">
      <header className="rc-toolbar rc-noprint">
        <Link to="/records" className="rc-back">&larr; Gradebook</Link>
        <h1>Report Cards</h1>
        <div className="rc-controls">
          <div className="rc-systems" role="group" aria-label="Term system">
            {systems.map((s) => (
              <button
                key={s.id}
                className={s.id === system.id ? 'rc-on' : ''}
                onClick={() => choose({ system: s.id })}
              >
                {s.label}
              </button>
            ))}
          </div>
          {system.terms.length > 1 && (
            <select
              aria-label="Term"
              value={term.id}
              onChange={(e) => choose({ system: system.id, termId: e.target.value })}
            >
              {system.terms.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          )}
          <button className="rc-print-all" disabled={!data || !ready} onClick={() => print('all')}>
            🖨️ Print all
          </button>
        </div>
      </header>

      {loadError && <p className="rc-note rc-noprint">Couldn't load the records. Check the connection and reload the page.</p>}
      {!data && !loadError && <p className="rc-note rc-noprint">Gathering the year's work…</p>}

      {data && (
        <p className="rc-note rc-noprint">
          {term.label} · {termRangeLabel(term)}. Each card prints on its own page — comments save when you click out of the box.
        </p>
      )}

      {data && REPORT_KIDS.map((kid) => {
        const student = data.students[kid] ?? {};
        const card = cards[kid];
        const theme = resolveTheme(kid, student.theme);
        const list = attachments[kid] ?? [];
        const images = list.filter((att) => isImage(att) && !brokenImages[att.path] && urls[att.path] !== null);
        const separate = list.filter((att) => !images.includes(att));
        const upload = uploadState[kid] ?? {};
        const text = comments[kid] ?? '';
        const dirty = ready && text !== (savedComments[kid] ?? '');
        const hidden = !printed.includes(kid);
        return (
          <section
            key={kid}
            className={`rc-student${hidden ? ' rc-noprint' : ''}${printed[0] === kid ? ' rc-first' : ''}`}
          >
            <div className="rc-student-bar rc-noprint">
              <span className="rc-avatar">{theme.avatar}</span>
              <strong>{nameOf(kid)}</strong>
              <button disabled={!ready} onClick={() => print(kid)}>🖨️ Print this card</button>
            </div>

            <article className="rc-card">
              <header className="rc-head">
                <div className="rc-school">{SCHOOL_NAME}</div>
                <div className="rc-doc-title">Report Card</div>
                <div className="rc-year">School Year {SCHOOL_YEAR}</div>
              </header>

              <dl className="rc-info">
                <div><dt>Student</dt><dd>{nameOf(kid)}</dd></div>
                <div><dt>Grade</dt><dd>{student.grade ?? '—'}</dd></div>
                <div><dt>Term</dt><dd>{term.label}</dd></div>
                <div><dt>Dates</dt><dd>{termRangeLabel(term)}</dd></div>
              </dl>

              <h2>Attendance</h2>
              <dl className="rc-attendance">
                <div><dt>Days attended</dt><dd>{card.days}</dd></div>
                <div><dt>Instructional hours</dt><dd>{card.hours}</dd></div>
                <div><dt>Assignments completed</dt><dd>{card.items}</dd></div>
              </dl>

              <h2>Academic Record</h2>
              <table className="rc-table">
                <thead>
                  <tr><th>Subject</th><th>Average</th><th>Grade</th><th>Graded items</th></tr>
                </thead>
                <tbody>
                  {card.subjects.map((row) => (
                    <tr key={row.subjectId}>
                      <td>{row.name}</td>
                      <td>{row.avg == null ? '—' : `${row.avg}%`}</td>
                      <td className="rc-letter">{row.letter ?? '—'}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                  {card.tfm && (
                    <tr>
                      <td>TFM — Throughly Furnished Ministries</td>
                      <td colSpan={3} className="rc-tfm">
                        {card.tfm.days} {card.tfm.days === 1 ? 'day' : 'days'} completed · graded by TFM — see attached report card
                      </td>
                    </tr>
                  )}
                  {card.subjects.length === 0 && !card.tfm && (
                    <tr><td colSpan={4} className="rc-empty">No work recorded for this term yet.</td></tr>
                  )}
                </tbody>
              </table>
              <p className="rc-scale">Grading scale:&nbsp; {SCALE_TEXT}</p>

              <h2>Teacher Comments</h2>
              <textarea
                className="rc-comments rc-noprint"
                rows={4}
                placeholder={unreadable[kid] ? 'Couldn\'t load these comments — reload the page before typing.' : 'Teacher comments…'}
                value={text}
                disabled={!ready || unreadable[kid]}
                onChange={(e) => setComments((c) => ({ ...c, [kid]: e.target.value }))}
                onBlur={() => saveComment(kid)}
              />
              <p className={`rc-save rc-noprint${saveState[kid] === 'error' ? ' rc-save-error' : ''}`} aria-live="polite">
                {saveState[kid] === 'saving' ? 'Saving…'
                  : saveState[kid] === 'error' ? 'Not saved — click in the box and out again to retry.'
                    : dirty ? 'Unsaved — click outside the box to save.'
                      : saveState[kid] === 'saved' ? '✓ Saved' : ' '}
              </p>
              {/* Paper gets the words, not a form field; an empty box becomes
                  lines to write on by hand. */}
              {text.trim()
                ? <p className="rc-comments-print rc-printonly">{text}</p>
                : <div className="rc-comments-blank rc-printonly"><span /><span /><span /><span /></div>}

              {list.length > 0 && (
                <p className="rc-outside-note rc-printonly">
                  <strong>Outside report cards on file:</strong>{' '}
                  {list.map((att) => `${att.name} (${images.includes(att) ? 'on the following page' : 'attached separately'})`).join('; ')}
                </p>
              )}

              <div className="rc-sign">
                <div><span />Teacher signature</div>
                <div className="rc-sign-date"><span />Date</div>
              </div>
            </article>

            <div className="rc-outside rc-noprint">
              <h3>Outside report cards</h3>
              <p>
                A report card from another program{card.tfm ? ' (TFM’s goes here)' : ''} — a photo prints as an
                extra page behind this card; a PDF is kept on file to open and print separately.
              </p>
              {list.length > 0 && (
                <ul>
                  {list.map((att) => (
                    <li key={att.path}>
                      <span>{isImage(att) ? '🖼️' : '📄'}</span>
                      {urls[att.path]
                        ? <a href={urls[att.path]} target="_blank" rel="noreferrer">{att.name}</a>
                        : <span>{att.name}{urls[att.path] === null ? ' (file unavailable)' : ''}</span>}
                      <button onClick={() => removeAttachment(kid, att)}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
              <label className={`rc-upload${upload.busy || !ready || unreadable[kid] ? ' rc-upload-off' : ''}`}>
                {upload.busy ? 'Uploading…' : '＋ Attach a photo or PDF'}
                <input
                  type="file"
                  accept="image/*,application/pdf,.heic,.heif"
                  multiple
                  disabled={upload.busy || !ready || unreadable[kid]}
                  onChange={(e) => {
                    attach(kid, e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              {upload.error && <p className="rc-upload-error">{upload.error}</p>}
            </div>

            {images.map((att) => (
              <figure key={att.path} className="rc-attachment">
                <figcaption>
                  {nameOf(kid)} — {term.label}, {SCHOOL_YEAR} · Outside report card: {att.name}
                </figcaption>
                {urls[att.path]
                  ? (
                    <img
                      src={urls[att.path]}
                      alt={`Outside report card: ${att.name}`}
                      onError={() => setBrokenImages((m) => ({ ...m, [att.path]: true }))}
                    />
                  )
                  : <p className="rc-noprint">{urls[att.path] === null ? 'This file could not be loaded.' : 'Loading…'}</p>}
              </figure>
            ))}
          </section>
        );
      })}
    </div>
  );
}
