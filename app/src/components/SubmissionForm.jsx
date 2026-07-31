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
export default function SubmissionForm({ assignment, studentId, onSubmitted, large }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]); // storage paths already uploaded
  const [uploading, setUploading] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false;
    setText('');
    setFiles([]);
    loadSubmission(assignment.id)
      .then((sub) => {
        if (sub?.isDraft) {
          setText(sub.text ?? '');
          setFiles(sub.fileUrls ?? []);
        }
      })
      .catch(() => {}) // no draft yet (or transient error) — start blank
      .finally(() => {
        loaded.current = true;
      });
    return () => clearTimeout(timer.current);
  }, [assignment.id]);

  function scheduleAutosave(nextText, nextFiles) {
    if (!loaded.current) return;
    setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await saveDraft(assignment, studentId, { text: nextText, fileUrls: nextFiles });
      setSaveState('saved');
    }, AUTOSAVE_MS);
  }

  function onTextChange(e) {
    setText(e.target.value);
    scheduleAutosave(e.target.value, files);
  }

  async function onFilePicked(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadSubmissionFile(studentId, todayISO(), file);
      const next = [...files, path];
      setFiles(next);
      await saveDraft(assignment, studentId, { text, fileUrls: next });
      setSaveState('saved');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function onSubmit() {
    setSubmitting(true);
    try {
      clearTimeout(timer.current);
      await submitWork(assignment, studentId, {
        responseType: files.length ? 'file' : 'text',
        text,
        fileUrls: files,
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
          {uploading ? 'Uploading…' : large ? '📷 Add a photo' : '📷 Add a photo of paper work'}
          <input type="file" accept="image/*,.pdf" onChange={onFilePicked} hidden disabled={uploading} />
        </label>
        {files.length > 0 && (
          <span className="file-count">{files.length} photo{files.length > 1 ? 's' : ''} attached</span>
        )}
        <span className={`autosave-note autosave-${saveState}`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : ''}
        </span>
      </div>
      <button className="submit-btn" onClick={onSubmit} disabled={!canSubmit}>
        {submitting ? 'Turning in…' : 'Turn it in!'}
      </button>
    </div>
  );
}
