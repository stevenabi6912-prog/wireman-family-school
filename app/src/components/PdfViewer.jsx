import { useEffect, useMemo, useState } from 'react';
import { resolveContentUrl } from '../lib/assignments';

// Inline PDF viewer — browsers render PDFs natively inside an iframe, so the
// kids read the material in place instead of downloading files.
//
// Bookmarks: the viewer is a cross-origin iframe, so we cannot read which page
// they scrolled to. Instead they tell us once ("I stopped on 214") and we
// remember it per book per kid, then reopen the book right there next time.
export default function PdfViewer({ contentPath, studentId }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  const [bookPath, assignedPage] = useMemo(() => {
    const [path, anchor] = (contentPath ?? '').split('#');
    return [path, Number(anchor?.match(/page=(\d+)/)?.[1]) || null];
  }, [contentPath]);

  const key = `pdfpage:${studentId ?? 'x'}:${bookPath}`;
  const [saved, setSaved] = useState(() => Number(localStorage.getItem(key)) || null);
  const [page, setPage] = useState(() => Number(localStorage.getItem(key)) || assignedPage);
  const [entry, setEntry] = useState('');

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(false);
    resolveContentUrl(bookPath)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [bookPath]);

  function goTo(p) {
    if (!p || p < 1) return;
    setPage(p);
    setSaved(p);
    localStorage.setItem(key, String(p));
    setEntry('');
  }

  if (!contentPath) return null;
  if (error) return <p className="pdf-error">Couldn't load this document. Tell Mom!</p>;
  if (!url) return <p className="pdf-loading">Loading your pages…</p>;

  const src = page ? `${url}#page=${page}` : url;

  return (
    <div className="pdf-wrap">
      <div className="pdf-bookmark">
        <span className="pdf-bookmark-label">
          🔖 {saved ? `Saved at page ${saved}` : 'Save your page so you never scroll for it again:'}
        </span>
        <span className="pdf-bookmark-controls">
          <input
            type="number"
            min="1"
            placeholder="page #"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goTo(Number(entry))}
          />
          <button onClick={() => goTo(Number(entry))} disabled={!entry}>Go & save</button>
          {saved && saved !== page && <button onClick={() => goTo(saved)}>↩ My page ({saved})</button>}
          {assignedPage && page !== assignedPage && (
            <button onClick={() => setPage(assignedPage)}>Today's page ({assignedPage})</button>
          )}
        </span>
      </div>
      <iframe
        key={src}
        className="pdf-frame"
        src={src}
        title="Assignment material"
        allow="fullscreen"
      />
    </div>
  );
}
