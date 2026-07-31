import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PALETTES, AVATARS } from '../config/themes';
import './ThemePicker.css';

export default function ThemePicker({ studentId, current, onClose }) {
  async function save(patch) {
    await updateDoc(doc(db, 'students', studentId), {
      theme: { palette: current.palette, avatar: current.avatar, ...patch },
      updatedAt: serverTimestamp(),
    });
  }

  return (
    <div className="theme-overlay" onClick={onClose}>
      <div className="theme-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="theme-sheet-header">
          <h2>Make it yours!</h2>
          <button className="theme-close" onClick={onClose}>Done ✓</button>
        </div>

        <h3>Pick your buddy</h3>
        <div className="avatar-grid">
          {AVATARS.map((a) => (
            <button
              key={a}
              className={`avatar-choice ${current.avatar === a ? 'avatar-choice-active' : ''}`}
              onClick={() => save({ avatar: a })}
            >
              {a}
            </button>
          ))}
        </div>

        <h3>Pick your colors</h3>
        <div className="palette-grid">
          {Object.entries(PALETTES).map(([key, p]) => (
            <button
              key={key}
              className={`palette-choice ${current.palette === key ? 'palette-choice-active' : ''}`}
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
