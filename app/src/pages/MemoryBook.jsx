import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { STUDENTS } from '../config/students';
import { resolveTheme } from '../config/themes';
import { loadMemoryBook, loadGallery, saveBookNote, SCHOOL_YEAR_LABEL } from './memoryBookData';
import MemoryBookPages from './MemoryBookView';
import './MemoryBook.css';

// A keepsake "year in review" per child: open it any time for the year so
// far, print it (or save as PDF) when the year is done. Parent-only.

const EMPTY_GALLERY = { status: 'loading', photos: [], heicSkipped: 0 };

export default function MemoryBook() {
  const { kidId } = useParams();
  const navigate = useNavigate();
  const kid = STUDENTS.find((s) => s.id === kidId) ?? null;

  const [book, setBook] = useState(null);
  const [error, setError] = useState(false);
  const [gallery, setGallery] = useState(EMPTY_GALLERY);
  const [note, setNote] = useState('');
  const [noteStatus, setNoteStatus] = useState('idle'); // idle | dirty | saving | saved | error
  const [attempt, setAttempt] = useState(0);
  const savedNote = useRef('');
  const currentKid = useRef(kid?.id);
  currentKid.current = kid?.id;

  useEffect(() => {
    if (!kid) return undefined;
    let cancelled = false;
    setBook(null);
    setError(false);
    setGallery(EMPTY_GALLERY);
    setNoteStatus('idle');
    loadMemoryBook(kid.id)
      .then((loaded) => {
        if (cancelled) return null;
        setBook(loaded);
        setNote(loaded.note);
        savedNote.current = loaded.note;
        return loadGallery(loaded.galleryCandidates, () => cancelled);
      })
      .then((result) => {
        if (!cancelled && result) setGallery({ status: 'ready', ...result });
      })
      .catch((err) => {
        console.error('memory book:', err);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kid, attempt]);

  // Paper setup only while this page is up: the stylesheet is bundled
  // app-wide, and a global @page rule would re-margin the Records printouts.
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '@page { size: letter; margin: 0.55in; }';
    document.head.appendChild(style);
    document.body.classList.add('mb-open');
    return () => {
      style.remove();
      document.body.classList.remove('mb-open');
    };
  }, []);

  // The saved PDF takes its file name from the tab title.
  useEffect(() => {
    if (!kid) return undefined;
    const before = document.title;
    document.title = `${kid.name} — Memory Book ${SCHOOL_YEAR_LABEL}`;
    return () => {
      document.title = before;
    };
  }, [kid]);

  if (!kid) return <Navigate to={`/memory-book/${STUDENTS[0].id}`} replace />;

  async function saveNote() {
    if (!book || note === savedNote.current) return;
    const saving = note;
    const forKid = kid.id;
    setNoteStatus('saving');
    try {
      await saveBookNote(forKid, saving);
      // switched children mid-save: this result belongs to the other book
      if (currentKid.current !== forKid) return;
      savedNote.current = saving;
      setNoteStatus((s) => (s === 'saving' ? 'saved' : s));
    } catch (err) {
      console.error('memory book note:', err);
      if (currentKid.current === forKid) setNoteStatus('error');
    }
  }

  function changeNote(text) {
    setNote(text);
    setNoteStatus(text === savedNote.current ? 'idle' : 'dirty');
  }

  function switchKid(id) {
    if (id === kid.id) return;
    if (noteStatus === 'dirty' || noteStatus === 'error') saveBookNote(kid.id, note).catch(() => {});
    navigate(`/memory-book/${id}`);
  }

  // Theme from the live student doc once it's here; the kid's default until then.
  const theme = resolveTheme(kid.id, book?.student?.theme);
  const photosReady = gallery.status === 'ready';

  return (
    <div className="mb-root">
      <div className="mb-toolbar">
        <Link className="mb-back" to="/dashboard">← Back to dashboard</Link>
        <div className="mb-kids" role="tablist" aria-label="Whose memory book">
          {STUDENTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === kid.id}
              className={s.id === kid.id ? 'mb-kid mb-kid-on' : 'mb-kid'}
              onClick={() => switchKid(s.id)}
            >
              <span aria-hidden="true">{resolveTheme(s.id, s.id === kid.id ? book?.student?.theme : null).avatar}</span> {s.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mb-btn mb-print-btn"
          onClick={() => window.print()}
          disabled={!book || !photosReady}
          title={book && !photosReady ? 'Waiting for the photos to finish loading' : undefined}
        >
          🖨️ {book && !photosReady ? 'Loading photos…' : 'Print / Save as PDF'}
        </button>
      </div>

      {error && (
        <div className="mb-status">
          <p>We couldn&rsquo;t open {kid.name}&rsquo;s memory book just now.</p>
          <button type="button" className="mb-btn" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      )}
      {!error && !book && (
        <div className="mb-status">
          <div className="mb-status-avatar" aria-hidden="true">{theme.avatar}</div>
          <p>Gathering {kid.name}&rsquo;s year…</p>
          <p className="mb-status-sub">Every finished assignment, photo, and cheer. This takes a few seconds.</p>
        </div>
      )}
      {!error && book && (
        <MemoryBookPages
          book={book}
          theme={theme}
          gallery={gallery}
          note={note}
          onNoteChange={changeNote}
          onNoteSave={saveNote}
          noteStatus={noteStatus}
        />
      )}
    </div>
  );
}
