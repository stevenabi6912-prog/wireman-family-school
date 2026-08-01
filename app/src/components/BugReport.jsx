import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import './BugReport.css';

// "Something's broken?" — kids (and Abi) describe the problem in their own
// words; the technical context rides along automatically and Dad gets an email.
export default function BugReport({ studentId, large }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent

  async function send() {
    if (!text.trim()) return;
    setState('sending');
    try {
      await addDoc(collection(db, 'bugReports'), {
        reportedBy: auth.currentUser.uid,
        studentId: studentId ?? 'abi',
        text: text.trim().slice(0, 1000),
        page: window.location.pathname,
        userAgent: navigator.userAgent.slice(0, 200),
        screen: `${window.innerWidth}x${window.innerHeight}`,
        createdAt: serverTimestamp(),
      });
      setState('sent');
      setText('');
      setTimeout(() => {
        setOpen(false);
        setState('idle');
      }, 2500);
    } catch {
      setState('idle');
    }
  }

  return (
    <>
      <button className="bug-btn" onClick={() => setOpen(true)} title="Something's broken?">🐞</button>
      {open && (
        <div className="bug-overlay" onClick={() => setOpen(false)}>
          <div className="bug-sheet" onClick={(e) => e.stopPropagation()}>
            {state === 'sent' ? (
              <p className="bug-thanks">🛠️ Got it — Dad's on the case. Thanks for the help!</p>
            ) : (
              <>
                <h3>🐞 {large ? 'What broke?' : "Something's broken?"}</h3>
                <p className="bug-hint">
                  {large ? 'Tell us what happened:' : 'Tell us what you were doing and what went wrong — Dad gets it right away.'}
                </p>
                <textarea
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={large ? 'The button did nothing…' : 'I tapped Turn It In and nothing happened…'}
                  autoFocus
                />
                <div className="bug-actions">
                  <button className="bug-cancel" onClick={() => setOpen(false)}>Never mind</button>
                  <button className="bug-send" onClick={send} disabled={!text.trim() || state === 'sending'}>
                    {state === 'sending' ? 'Sending…' : 'Send it 🚀'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
