import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { STUDENTS, PARENTS } from '../config/students';
import './Login.css';

const STUDENT_PIN_LENGTH = 6;
const PARENT_MIN_PIN_LENGTH = 6; // family decision: same length as the kids' PINs

export default function Login() {
  const [selected, setSelected] = useState(null); // { id, name, color, isParent }
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { user, role, loading, loginWithPin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where a link was pointing before the PIN screen got in the way (see
  // RequireRole). Only Abi is sent onward — a kid always lands on their day.
  const from = typeof location.state?.from === 'string' ? location.state.from : null;
  const landing = (isParent) => (isParent ? from ?? '/dashboard' : '/today');

  // Type the PIN instead of tapping it — on a laptop the keypad is slower than
  // the keyboard already under your hands. Re-bound whenever the PIN changes so
  // the handler never closes over a stale one.
  useEffect(() => {
    if (!selected) return undefined;

    function onKeyDown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // leave browser shortcuts alone
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        pressDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault(); // some browsers treat this as "go back"
        if (!submitting) backspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const need = selected.isParent ? PARENT_MIN_PIN_LENGTH : STUDENT_PIN_LENGTH;
        if (!submitting && pin.length >= need) attemptLogin(pin);
      } else if (e.key === 'Escape') {
        backToCards();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Already signed in (session persisted) — skip the login screen entirely.
  if (!loading && user && role) {
    return <Navigate to={landing(role === 'parent')} replace />;
  }

  function selectCard(person, isParent) {
    setSelected({ ...person, isParent });
    setPin('');
    setError(false);
  }

  function backToCards() {
    setSelected(null);
    setPin('');
    setError(false);
  }

  async function attemptLogin(nextPin) {
    setSubmitting(true);
    try {
      await loginWithPin(selected.id, nextPin);
      navigate(landing(selected.isParent), { replace: true });
    } catch {
      setError(true); // stays until the next keypad press so kids can read it
      setPin('');
    } finally {
      setSubmitting(false);
    }
  }

  function pressDigit(d) {
    if (submitting) return;
    setError(false);
    const nextPin = pin + d;
    setPin(nextPin);
    if (!selected.isParent && nextPin.length === STUDENT_PIN_LENGTH) {
      attemptLogin(nextPin);
    }
  }

  function backspace() {
    setPin((p) => p.slice(0, -1));
  }


  if (!selected) {
    return (
      <div className="login-screen">
        <h1 className="login-title">Who's doing school today?</h1>
        <div className="card-grid">
          {STUDENTS.map((s) => (
            <button
              key={s.id}
              className="name-card"
              style={{ '--card-color': s.color }}
              onClick={() => selectCard(s, false)}
            >
              <span className="name-card-avatar">{s.emoji}</span>
              <span className="name-card-name">{s.name}</span>
            </button>
          ))}
        </div>
        <div className="parent-divider" />
        <div className="card-grid">
          {PARENTS.map((p) => (
            <button
              key={p.id}
              className="name-card parent-card"
              style={{ '--card-color': p.color }}
              onClick={() => selectCard(p, true)}
            >
              <span className="name-card-avatar">{p.emoji}</span>
              <span className="name-card-name">{p.name} ({p.shortName})</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const requiredLength = selected.isParent ? PARENT_MIN_PIN_LENGTH : STUDENT_PIN_LENGTH;

  return (
    <div className="login-screen">
      <button className="back-link" onClick={backToCards}>&larr; Back</button>
      <h1 className="login-title">
        Hi {selected.name}, enter your PIN
      </h1>
      <div className={`pin-dots ${error ? 'pin-dots-error' : ''}`}>
        {Array.from({ length: Math.max(requiredLength, pin.length) }).map((_, i) => (
          <span key={i} className={`pin-dot ${i < pin.length ? 'pin-dot-filled' : ''}`} />
        ))}
      </div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="keypad-btn" onClick={() => pressDigit(d)} disabled={submitting}>
            {d}
          </button>
        ))}
        <button className="keypad-btn keypad-btn-secondary" onClick={backspace} disabled={submitting}>
          &#9003;
        </button>
        <button className="keypad-btn" onClick={() => pressDigit('0')} disabled={submitting}>
          0
        </button>
        {selected.isParent ? (
          <button
            className="keypad-btn keypad-btn-confirm"
            onClick={() => pin.length >= PARENT_MIN_PIN_LENGTH && attemptLogin(pin)}
            disabled={submitting || pin.length < PARENT_MIN_PIN_LENGTH}
          >
            &#10003;
          </button>
        ) : (
          <span />
        )}
      </div>
      {error && <p className="login-error">That PIN didn't work — try again.</p>}
      <p className="login-hint">
        Tap the buttons or just type it
        {selected.isParent ? ' — Enter to sign in.' : '.'}
      </p>
    </div>
  );
}
