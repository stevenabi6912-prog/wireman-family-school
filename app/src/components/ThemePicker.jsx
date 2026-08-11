import { useState } from 'react';
import { doc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { PALETTES, AVATARS } from '../config/themes';
import { playDing, DING_STYLES } from '../lib/sounds';
import { CONFETTI_STYLES } from './Confetti';
import './ThemePicker.css';

export default function ThemePicker({ studentId, current, onClose }) {
  const [uploading, setUploading] = useState(false);

  async function save(patch) {
    await updateDoc(doc(db, 'students', studentId), {
      theme: {
        palette: current.palette,
        avatar: current.avatar,
        headerImagePath: current.headerImagePath ?? null,
        ding: current.ding ?? 'classic',
        confetti: current.confetti ?? 'classic',
        ...patch,
      },
      updatedAt: serverTimestamp(),
    });
  }

  // Kid-supplied header image (their own picture — team logo, wallpaper,
  // fishing photo, whatever they saved). Lives in the family's PRIVATE
  // Storage under /themes/{studentId}/ — auth-gated, never in the repo.
  async function onPicturePicked(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `themes/${studentId}/header-${Date.now()}-${file.name}`;
      await uploadBytes(ref(storage, path), file);
      await save({ headerImagePath: path });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function removePicture() {
    await save({ headerImagePath: null });
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

        <h3>Pick your victory sound</h3>
        <div className="celebration-grid">
          {Object.entries(DING_STYLES).map(([key, label]) => (
            <button
              key={key}
              className={`celebration-choice ${(current.ding ?? 'classic') === key ? 'celebration-choice-active' : ''}`}
              onClick={() => { playDing(key); save({ ding: key }); }}
            >
              🔊 {label}
            </button>
          ))}
        </div>

        <h3>Pick your celebration</h3>
        <div className="celebration-grid">
          {Object.entries(CONFETTI_STYLES).map(([key, label]) => (
            <button
              key={key}
              className={`celebration-choice ${(current.confetti ?? 'classic') === key ? 'celebration-choice-active' : ''}`}
              onClick={() => save({ confetti: key })}
            >
              {key === 'stars' ? '⭐' : key === 'hearts' ? '💖' : key === 'fireworks' ? '🎆' : '🎊'} {label}
            </button>
          ))}
        </div>

        <h3>Your own picture up top</h3>
        <div className="header-image-row">
          <label className="header-upload-btn">
            {uploading ? 'Uploading…' : '🖼️ Choose a picture'}
            <input type="file" accept="image/*" onChange={onPicturePicked} hidden disabled={uploading} />
          </label>
          {current.headerImagePath && (
            <button className="header-remove-btn" onClick={removePicture}>Remove picture</button>
          )}
        </div>
        <p className="header-image-note">
          Save any picture you like to this device, then choose it here — it becomes the banner
          at the top of your page. Only our family can see it.
        </p>
      </div>
    </div>
  );
}
