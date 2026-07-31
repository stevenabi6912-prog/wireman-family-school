import { useEffect, useState } from 'react';
import { resolveContentUrl } from '../lib/assignments';

// Inline PDF viewer — browsers render PDFs natively inside an iframe, so the
// kids read the material in place instead of downloading files.
export default function PdfViewer({ contentPath }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(false);
    resolveContentUrl(contentPath)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [contentPath]);

  if (!contentPath) return null;
  if (error) return <p className="pdf-error">Couldn't load this document. Tell Mom!</p>;
  if (!url) return <p className="pdf-loading">Loading your pages…</p>;

  return (
    <iframe
      className="pdf-frame"
      src={url}
      title="Assignment material"
      allow="fullscreen"
    />
  );
}
