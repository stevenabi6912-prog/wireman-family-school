import { useEffect, useRef } from 'react';

// Lightweight canvas confetti — no library, ~1.5s burst then self-cleans.
// size: 'small' (item done) | 'big' (day done)
// style: kid-chosen look (theme.confetti) — classic rects, stars, hearts,
// or a multi-origin fireworks burst.
export const CONFETTI_STYLES = {
  classic: 'Classic confetti',
  stars: 'Star shower',
  hearts: 'Heart burst',
  fireworks: 'Fireworks',
};

const STYLE_LOOKS = {
  classic: { emoji: null, colors: ['#f94144', '#f3722c', '#f9c74f', '#90be6d', '#43aa8b', '#577590', '#c77dff'] },
  stars: { emoji: ['⭐', '✨', '🌟'], colors: ['#f9c74f'] },
  hearts: { emoji: ['💖', '💕', '💜', '💙'], colors: ['#ff6b9d'] },
  fireworks: { emoji: null, colors: ['#ff5d8f', '#ffd166', '#06d6a0', '#4cc9f0', '#f72585', '#ffffff'] },
};

export default function Confetti({ size = 'small', style = 'classic', onDone }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);

    const look = STYLE_LOOKS[style] ?? STYLE_LOOKS.classic;
    const colors = look.colors;
    const count = size === 'big' ? 160 : 45;

    // Fireworks explode from several points; everything else from center.
    const origins = style === 'fireworks'
      ? Array.from({ length: size === 'big' ? 4 : 2 }, () => ({
          x: window.innerWidth * (0.2 + Math.random() * 0.6),
          y: window.innerHeight * (0.2 + Math.random() * 0.35),
        }))
      : [{ x: window.innerWidth / 2, y: size === 'big' ? window.innerHeight / 3 : window.innerHeight / 2 }];

    const parts = Array.from({ length: count }, (_, i) => {
      const o = origins[i % origins.length];
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = (size === 'big' ? 9 : 6) * (0.5 + Math.random());
      return {
        x: o.x, y: o.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (size === 'big' ? 4 : 2),
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        color: colors[i % colors.length],
        emoji: look.emoji ? look.emoji[i % look.emoji.length] : null,
        fontSize: 12 + Math.random() * 10,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
      };
    });

    let frame = 0;
    let raf;
    const maxFrames = size === 'big' ? 110 : 70;

    function tick() {
      g.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravity
        p.vx *= 0.99;
        p.rot += p.vr;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.globalAlpha = Math.max(0, 1 - frame / maxFrames);
        if (p.emoji) {
          g.font = `${p.fontSize}px serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(p.emoji, 0, 0);
        } else {
          g.fillStyle = p.color;
          g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        g.restore();
      }
      frame++;
      if (frame < maxFrames) raf = requestAnimationFrame(tick);
      else onDone?.();
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size, onDone]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    />
  );
}
