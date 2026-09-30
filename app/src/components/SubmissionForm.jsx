import { useEffect, useRef, useState } from 'react';
import {
  loadSubmission,
  saveDraft,
  submitWork,
  uploadSubmissionFile,
  todayISO,
} from '../lib/assignments';

const AUTOSAVE_MS = 1500;

// Typed answers + optional photo upload of paper work. Autosaves continuously
// so a closed tab never loses anything (a third grader will close the tab).
//
// Every save reads the CURRENT text and photo list out of refs and goes through
// one write queue. It used to capture them when the save was scheduled, so a
// typing autosave that fired a moment after a photo landed wrote the older,
// photo-less list straight over it: the chip stayed on screen, the draft lost
// the photo, and the kid came back to fewer photos than he added.
export default function SubmissionForm({ assignment, studentId, onSubmitted, large }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]); // storage paths already uploaded
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState(null); // progress, or what failed
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef(null);
  const loaded = useRef(false);
  const textRef = useRef('');
  const filesRef = useRef([]);
  const writeQueue = useRef(Promise.resolve());

  useEffect(() => {
    loaded.current = false;
    setText('');
    setFiles([]);
    textRef.current = '';
    filesRef.current = [];
    loadSubmission(assignment.id)
      .then((sub) => {
        if (sub?.isDraft) {
          setText(sub.text ?? '');
          setFiles(sub.fileUrls ?? []);
          textRef.current = sub.text ?? '';
          filesRef.current = sub.fileUrls ?? [];
        }
      })
      .catch(() => {}) // no draft yet (or transient error) — start blank
      .finally(() => {
        loaded.current = true;
      });
    return () => clearTimeout(timer.current);
  }, [assignment.id]);

  // One writer, in order, always writing what's on screen right now.
  function queueSave() {
    setSaveState('saving');
    writeQueue.current = writeQueue.current
      .then(() => saveDraft(assignment, studentId, { text: textRef.current, fileUrls: filesRef.current }))
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('idle')); // keep the queue alive for the next save
    return writeQueue.current;
  }

  function scheduleAutosave() {
    if (!loaded.current) return;
    setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(queueSave, AUTOSAVE_MS);
  }

  function onTextChange(e) {
    textRef.current = e.target.value;
    setText(e.target.value);
    scheduleAutosave();
  }

  // Several photos can come in one pick (the input is `multiple`), and the
  // button can be tapped again for more — worksheets often span pages. One
  // photo failing keeps the rest and says which one to retry.
  async function onFilePicked(e) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ''; // so the same file can be picked again after a failure
    if (picked.length === 0) return;
    setUploading(true);
    setUploadNote(null);
    const failed = [];
    for (let i = 0; i < picked.length; i++) {
      setUploadNote(picked.length > 1 ? `Uploading ${i + 1} of ${picked.length}…` : 'Uploading…');
      try {
        const path = await uploadSubmissionFile(studentId, todayISO(), picked[i]);
        // Attach and save each photo as it lands, so one bad photo later in the
        // batch can't take the good ones down with it.
        filesRef.current = [...filesRef.current, path];
        setFiles(filesRef.current);
        clearTimeout(timer.current); // the queued save covers whatever was pending
        queueSave();
      } catch (err) {
        console.error('photo upload failed', picked[i].name, err);
        failed.push(picked[i].name);
      }
    }
    await writeQueue.current.catch(() => {});
    setUploading(false);
    setUploadNote(
      failed.length
        ? `Couldn't add ${failed.join(', ')} — tap the button and try that one again.`
        : null
    );
  }

  async function removeFile(path) {
    filesRef.current = filesRef.current.filter((f) => f !== path);
    setFiles(filesRef.current);
    clearTimeout(timer.current);
    await queueSave();
  }

  async function onSubmit() {
    setSubmitting(true);
    try {
      clearTimeout(timer.current);
      await writeQueue.current.catch(() => {}); // let any in-flight draft write land first
      await submitWork(assignment, studentId, {
        responseType: filesRef.current.length ? 'file' : 'text',
        text: textRef.current,
        fileUrls: filesRef.current,
      });
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && !uploading && (text.trim().length > 0 || files.length > 0);

  return (
    <div className={`submission-form ${large ? 'submission-form-large' : ''}`}>
      <label className="submission-label" htmlFor={`answer-${assignment.id}`}>
        {large ? 'Type your answer here:' : 'Your answers'}
      </label>
      <textarea
        id={`answer-${assignment.id}`}
        className="submission-text"
        value={text}
        onChange={onTextChange}
        rows={large ? 4 : 8}
        placeholder={large ? 'Type here…' : 'Type your answers. Number them to match the questions.'}
      />
      <div className="submission-actions">
        <label className="upload-btn">
          {uploading
            ? (uploadNote ?? 'Uploading…')
            : files.length > 0
              ? '📷 Add another photo'
              : (large ? '📷 Add a photo' : '📷 Add photos of paper work')}
          <input type="file" accept="image/*,.pdf" multiple onChange={onFilePicked} hidden disabled={uploading} />
        </label>
        <span className={`autosave-note autosave-${saveState}`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : ''}
        </span>
      </div>
      {!uploading && uploadNote && <p className="upload-problem">⚠️ {uploadNote}</p>}
      {files.length > 0 && (
        <div className="file-list">
          {files.map((f, i) => (
            <span key={f} className="file-chip">
              📄 Photo {i + 1}
              <button className="file-remove" title="Remove this photo" onClick={() => removeFile(f)}>✕</button>
            </span>
          ))}
        </div>
      )}
      <button className="submit-btn" onClick={onSubmit} disabled={!canSubmit}>
        {submitting ? 'Turning in…' : 'Turn it in!'}
      </button>
    </div>
  );
}
