import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PALETTES, AVATARS } from '../config/themes';
import './ThemePicker.css';

// Abi's version of "Make it mine" — stored on the family doc she owns.
export default function AbiTheme({ current, onClose }) {
  const [local, setLocal] = useState(current);

  async function save(patch) {
    const next = { ...local, ...patch };
    setLocal(next);
    await updateDoc(doc(db, 'families', 'wireman'), { parentTheme: next });
  }

  return (
    <div className="theme-overlay" onClick={onClose}>
      <div className="theme-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="theme-sheet-header">
          <h2>Your look</h2>
          <button className="theme-close" onClick={onClose}>Done ✓</button>
        </div>

        <h3>Your buddy</h3>
        <div className="avatar-grid">
          {['☀️', '🌻', '📚', '☕', '🌸', '🦋', ...AVATARS.slice(0, 18)].map((a) => (
            <button
              key={a}
              className={`avatar-choice ${local.avatar === a ? 'avatar-choice-active' : ''}`}
              onClick={() => save({ avatar: a })}
            >
              {a}
            </button>
          ))}
        </div>

        <h3>Your colors</h3>
        <div className="palette-grid">
          {Object.entries(PALETTES).map(([key, p]) => (
            <button
              key={key}
              className={`palette-choice ${local.palette === key ? 'palette-choice-active' : ''}`}
              style={{ background: p.header }}
              onClick={() => save({ palette: key })}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
