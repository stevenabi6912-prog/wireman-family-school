import { useEffect, useRef } from 'react';

// Lightweight canvas confetti — no library, ~1.5s burst then self-cleans.
// size: 'small' (item done) | 'big' (day done)
export default function Confetti({ size = 'small', onDone }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);

    const colors = ['#f94144', '#f3722c', '#f9c74f', '#90be6d', '#43aa8b', '#577590', '#c77dff'];
    const count = size === 'big' ? 160 : 45;
    const cx = window.innerWidth / 2;
    const cy = size === 'big' ? window.innerHeight / 3 : window.innerHeight / 2;

    const parts = Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = (size === 'big' ? 9 : 6) * (0.5 + Math.random());
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (size === 'big' ? 4 : 2),
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        color: colors[i % colors.length],
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
        g.fillStyle = p.color;
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
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
