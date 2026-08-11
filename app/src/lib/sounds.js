// Tiny Web Audio synth — all sounds generated in code, no audio files to
// host or license. Muting persists per device.

let ctx = null;
const MUTE_KEY = 'wfs-muted';

export function isMuted() {
  return localStorage.getItem(MUTE_KEY) === '1';
}

export function setMuted(muted) {
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
}

function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq, start = 0, duration = 0.15, type = 'sine', gain = 0.12, slideTo = null }) {
  const ac = audio();
  const osc = ac.createOscillator();
  const g = ac.createGain();
  const t0 = ac.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

// Soft tap for keypad presses
export function playClick() {
  if (isMuted()) return;
  try {
    tone({ freq: 660, duration: 0.06, type: 'triangle', gain: 0.06 });
  } catch { /* audio unavailable — stay silent */ }
}

// Happy pop when an item is completed. Each kid can pick their own style
// in the theme picker (stored as theme.ding).
export const DING_STYLES = {
  classic: 'Classic ding',
  arcade: 'Arcade zap',
  chime: 'Magic chime',
  pop: 'Bubble pop',
};

export function playDing(style = 'classic') {
  if (isMuted()) return;
  try {
    if (style === 'arcade') {
      tone({ freq: 330, duration: 0.07, type: 'square', gain: 0.09 });
      tone({ freq: 440, start: 0.07, duration: 0.07, type: 'square', gain: 0.09 });
      tone({ freq: 660, start: 0.14, duration: 0.14, type: 'square', gain: 0.1 });
    } else if (style === 'chime') {
      tone({ freq: 880, duration: 0.5, type: 'sine', gain: 0.1 });
      tone({ freq: 1318.5, start: 0.05, duration: 0.6, type: 'sine', gain: 0.07 });
      tone({ freq: 1760, start: 0.1, duration: 0.7, type: 'sine', gain: 0.045 });
    } else if (style === 'pop') {
      tone({ freq: 300, duration: 0.09, type: 'sine', gain: 0.16, slideTo: 900 });
    } else {
      tone({ freq: 523.25, duration: 0.12, type: 'sine', gain: 0.14 });          // C5
      tone({ freq: 783.99, start: 0.09, duration: 0.22, type: 'sine', gain: 0.14 }); // G5
    }
  } catch { /* ignore */ }
}

// Rising whoosh on submit
export function playWhoosh() {
  if (isMuted()) return;
  try {
    tone({ freq: 220, duration: 0.25, type: 'sawtooth', gain: 0.05, slideTo: 880 });
  } catch { /* ignore */ }
}

// Full fanfare for finishing the day
export function playFanfare() {
  if (isMuted()) return;
  try {
    const notes = [
      [523.25, 0.0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.36], // C E G C
    ];
    for (const [freq, start] of notes) {
      tone({ freq, start, duration: 0.28, type: 'triangle', gain: 0.14 });
      tone({ freq: freq / 2, start, duration: 0.28, type: 'sine', gain: 0.07 });
    }
    tone({ freq: 1046.5, start: 0.52, duration: 0.7, type: 'triangle', gain: 0.16 });
    tone({ freq: 1318.5, start: 0.52, duration: 0.7, type: 'sine', gain: 0.08 });
  } catch { /* ignore */ }
}
