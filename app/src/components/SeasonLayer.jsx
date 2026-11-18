import { useMemo, useState } from 'react';
import { seasonFor } from '../lib/seasons';
import './SeasonLayer.css';

const OFF_KEY = 'season-off';
const COUNT = 16;

// This week's seasonal look: a few emoji drifting through the page
// background (behind the cards, never over the work) and a little name chip.
// The chip toggles the motion off for anyone who finds it distracting.
export function useSeason() {
  const season = useMemo(() => seasonFor(new Date()), []);
  const [off, setOff] = useState(() => {
    try { return localStorage.getItem(OFF_KEY) === '1'; } catch { return false; }
  });
  function toggle() {
    const next = !off;
    setOff(next);
    try { localStorage.setItem(OFF_KEY, next ? '1' : '0'); } catch { /* private window */ }
  }
  return { season, off, toggle };
}

export function SeasonChip({ season, off, onToggle }) {
  return (
    <button
      className={`season-chip ${off ? 'season-chip-off' : ''}`}
      onClick={onToggle}
      title={`${season.line}  (tap to turn the decorations ${off ? 'on' : 'off'})`}
    >
      {season.icon} {season.name} week
    </button>
  );
}

export default function SeasonLayer({ season, off }) {
  // Positions come from the index, not Math.random, so a re-render never
  // makes the whole sky jump.
  const bits = useMemo(() => Array.from({ length: COUNT }, (_, i) => {
    const spread = (i * 61) % 100; // well-shuffled 0..99
    return {
      emoji: season.bits[i % season.bits.length],
      style: {
        '--x': `${spread}%`,
        '--y': `${(i * 37) % 100}%`,
        '--size': `${1.05 + ((i * 7) % 10) / 10}rem`,
        '--dur': `${16 + ((i * 13) % 14)}s`,
        '--delay': `${-((i * 29) % 30)}s`,
        '--sway': `${(i % 2 ? 1 : -1) * (14 + (i * 5) % 22)}px`,
      },
    };
  }), [season]);

  if (off) return null;
  return (
    <div className={`season-layer season-${season.motion}`} aria-hidden="true">
      {bits.map((b, i) => <span key={i} className="season-bit" style={b.style}>{b.emoji}</span>)}
    </div>
  );
}
