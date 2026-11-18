// The pool table, painted on a canvas. Drawing only — positions come from the
// physics engine untouched. The canvas is bigger than the playing surface so
// the rails can be drawn around it; everything goes through tx()/ty() and
// poolPointAt() so table coordinates stay exactly what the engine uses.

import { useEffect, useRef } from 'react';
import { TABLE, ballColor, isStripe } from '../../lib/games/pool';
import './GameBoards.css';

const S = 10; // canvas pixels per table unit
const RAIL = 4.6; // wood + cushion around the playing surface, in table units
const CUSHION = 1.3;
export const POOL_CANVAS = { w: (TABLE.w + RAIL * 2) * S, h: (TABLE.h + RAIL * 2) * S };

const tx = (x) => (x + RAIL) * S;
const ty = (y) => (y + RAIL) * S;

// Pointer position -> table coordinates.
export function poolPointAt(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const p = e.touches?.[0] ?? e;
  return {
    x: ((p.clientX - rect.left) / rect.width) * (TABLE.w + RAIL * 2) - RAIL,
    y: ((p.clientY - rect.top) / rect.height) * (TABLE.h + RAIL * 2) - RAIL,
  };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// The table itself never changes, so it is painted once and blitted per frame.
let tableLayer = null;
function tableImage() {
  if (tableLayer) return tableLayer;
  const cv = document.createElement('canvas');
  cv.width = POOL_CANVAS.w;
  cv.height = POOL_CANVAS.h;
  const g = cv.getContext('2d');
  const { w: CW, h: CH } = POOL_CANVAS;

  // wooden frame
  const wood = g.createLinearGradient(0, 0, 0, CH);
  wood.addColorStop(0, '#8a5327');
  wood.addColorStop(0.5, '#6a3b17');
  wood.addColorStop(1, '#4f2a0f');
  roundRect(g, 0, 0, CW, CH, 3.2 * S);
  g.fillStyle = wood;
  g.fill();
  g.save();
  g.clip();
  // grain: long faint streaks, placed by a fixed recurrence so it never shimmers
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 70; i++) {
    const y = rnd() * CH;
    g.strokeStyle = `rgba(${i % 2 ? '255,214,160' : '30,12,0'},${0.05 + rnd() * 0.07})`;
    g.lineWidth = 1 + rnd() * 2;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(CW * 0.3, y + rnd() * 14 - 7, CW * 0.7, y + rnd() * 14 - 7, CW, y + rnd() * 8 - 4);
    g.stroke();
  }
  g.restore();
  roundRect(g, 3, 3, CW - 6, CH - 6, 3 * S);
  g.strokeStyle = 'rgba(255,225,170,.28)';
  g.lineWidth = 2;
  g.stroke();

  // cushions
  const cx0 = tx(-CUSHION);
  const cy0 = ty(-CUSHION);
  const cw = (TABLE.w + CUSHION * 2) * S;
  const ch = (TABLE.h + CUSHION * 2) * S;
  roundRect(g, cx0 - 3, cy0 - 3, cw + 6, ch + 6, 1.4 * S);
  g.fillStyle = 'rgba(20,8,0,.55)';
  g.fill();
  roundRect(g, cx0, cy0, cw, ch, 1.2 * S);
  g.fillStyle = '#0b5a34';
  g.fill();
  g.strokeStyle = 'rgba(160,255,200,.22)';
  g.lineWidth = 2;
  g.stroke();

  // felt, lit from above the middle of the table
  const fx = tx(0);
  const fy = ty(0);
  const fw = TABLE.w * S;
  const fh = TABLE.h * S;
  const felt = g.createRadialGradient(CW / 2, CH / 2, fh * 0.1, CW / 2, CH / 2, fw * 0.62);
  felt.addColorStop(0, '#27a866');
  felt.addColorStop(0.6, '#168a4f');
  felt.addColorStop(1, '#0b5f37');
  g.fillStyle = felt;
  g.fillRect(fx, fy, fw, fh);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)';
    g.fillRect(fx + rnd() * fw, fy + rnd() * fh, 1.5, 1.5);
  }
  // shadow the cushions throw onto the cloth
  const edge = (x0, y0, x1, y1, rx, ry, rw, rh) => {
    const sh = g.createLinearGradient(x0, y0, x1, y1);
    sh.addColorStop(0, 'rgba(0,0,0,.34)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.fillRect(rx, ry, rw, rh);
  };
  const d = 1.6 * S;
  edge(0, fy, 0, fy + d, fx, fy, fw, d);
  edge(0, fy + fh, 0, fy + fh - d, fx, fy + fh - d, fw, d);
  edge(fx, 0, fx + d, 0, fx, fy, d, fh);
  edge(fx + fw, 0, fx + fw - d, 0, fx + fw - d, fy, d, fh);

  // head string and spots
  g.strokeStyle = 'rgba(255,255,255,.13)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(tx(25), fy);
  g.lineTo(tx(25), fy + fh);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,.3)';
  for (const sx of [25, 75]) {
    g.beginPath();
    g.arc(tx(sx), ty(25), 3, 0, Math.PI * 2);
    g.fill();
  }

  // diamond sights
  g.fillStyle = '#f3e3b5';
  g.strokeStyle = 'rgba(60,30,0,.6)';
  g.lineWidth = 1;
  const diamond = (x, y) => {
    g.beginPath();
    g.moveTo(x, y - 6);
    g.lineTo(x + 4.5, y);
    g.lineTo(x, y + 6);
    g.lineTo(x - 4.5, y);
    g.closePath();
    g.fill();
    g.stroke();
  };
  const railMid = ((RAIL - CUSHION) / 2) * S;
  for (let i = 1; i < 8; i++) {
    if (i === 4) continue; // side pocket
    diamond(tx(i * 12.5), railMid);
    diamond(tx(i * 12.5), CH - railMid);
  }
  for (let i = 1; i < 4; i++) {
    diamond(railMid, ty(i * 12.5));
    diamond(CW - railMid, ty(i * 12.5));
  }

  // pockets
  for (const p of TABLE.pockets) {
    const x = tx(p.x);
    const y = ty(p.y);
    const r = TABLE.pocketR * S;
    g.beginPath();
    g.arc(x, y, r * 1.38, 0, Math.PI * 2);
    const rim = g.createRadialGradient(x, y, r, x, y, r * 1.38);
    rim.addColorStop(0, '#1b1009');
    rim.addColorStop(0.7, '#3a2413');
    rim.addColorStop(1, '#5a3a1e');
    g.fillStyle = rim;
    g.fill();
    g.beginPath();
    g.arc(x, y, r * 1.12, 0, Math.PI * 2);
    const hole = g.createRadialGradient(x, y + r * 0.25, r * 0.1, x, y, r * 1.12);
    hole.addColorStop(0, '#000');
    hole.addColorStop(0.75, '#07100a');
    hole.addColorStop(1, '#16271c');
    g.fillStyle = hole;
    g.fill();
  }

  tableLayer = cv;
  return cv;
}

function drawBall(g, b) {
  const x = tx(b.x);
  const y = ty(b.y);
  const r = TABLE.r * S;
  const stripe = isStripe(b.n);
  const ivory = '#f6f1e4';

  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = stripe || b.n === 0 ? ivory : ballColor(b.n);
  g.fillRect(x - r, y - r, r * 2, r * 2);
  if (stripe) {
    g.fillStyle = ballColor(b.n);
    g.fillRect(x - r, y - r * 0.56, r * 2, r * 1.12);
  }
  if (b.n !== 0) {
    g.beginPath();
    g.arc(x, y, r * 0.5, 0, Math.PI * 2);
    g.fillStyle = ivory;
    g.fill();
    g.fillStyle = '#111';
    g.font = `800 ${r * (b.n > 9 ? 0.68 : 0.8)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(b.n), x, y + r * 0.04);
  }
  // roundness: bright toward the lamp, falling off to a dark rim
  const shade = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  shade.addColorStop(0, 'rgba(255,255,255,.5)');
  shade.addColorStop(0.3, 'rgba(255,255,255,.08)');
  shade.addColorStop(0.7, 'rgba(0,0,0,.08)');
  shade.addColorStop(1, 'rgba(0,0,0,.5)');
  g.fillStyle = shade;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();

  g.beginPath();
  g.ellipse(x - r * 0.38, y - r * 0.45, r * 0.24, r * 0.14, -0.6, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.fill();
}

function drawCue(g, cue, angle, power, locked) {
  const x = tx(cue.x);
  const y = ty(cue.y);
  const r = TABLE.r * S;

  // Aim guide: same reach as it has always had, so aiming is no easier.
  const reach = (30 * power + 6) * S;
  const ex = x + Math.cos(angle) * reach;
  const ey = y + Math.sin(angle) * reach;
  g.save();
  g.lineCap = 'round';
  g.shadowColor = locked ? 'rgba(255,200,40,.9)' : 'rgba(0,0,0,.45)';
  g.shadowBlur = locked ? 10 : 3;
  g.strokeStyle = locked ? 'rgba(255,214,64,.98)' : 'rgba(255,255,255,.9)';
  g.lineWidth = locked ? 4 : 3;
  if (!locked) g.setLineDash([2, 11]);
  g.beginPath();
  g.moveTo(x + Math.cos(angle) * (r + 3), y + Math.sin(angle) * (r + 3));
  g.lineTo(ex, ey);
  g.stroke();
  g.setLineDash([]);
  g.beginPath();
  g.arc(ex, ey, locked ? 6 : 5, 0, Math.PI * 2);
  g.fillStyle = g.strokeStyle;
  g.fill();
  g.restore();

  // Cue stick behind the ball, drawn back further the harder the shot.
  const gap = r + (1.2 + power * 7) * S;
  const len = 46 * S;
  g.save();
  g.translate(x, y);
  g.rotate(angle + Math.PI);
  const stick = (dy) => {
    g.beginPath();
    g.moveTo(gap, -2.6 + dy);
    g.lineTo(gap + len, -6.5 + dy);
    g.lineTo(gap + len, 6.5 + dy);
    g.lineTo(gap, 2.6 + dy);
    g.closePath();
  };
  stick(7);
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.fill();
  stick(0);
  const shaft = g.createLinearGradient(gap, 0, gap + len, 0);
  shaft.addColorStop(0, '#3f7fd6');
  shaft.addColorStop(0.014, '#3f7fd6');
  shaft.addColorStop(0.015, '#f4efe2');
  shaft.addColorStop(0.04, '#f4efe2');
  shaft.addColorStop(0.041, '#e8c98f');
  shaft.addColorStop(0.58, '#d9a55e');
  shaft.addColorStop(0.581, '#3a2212');
  shaft.addColorStop(0.9, '#1d1009');
  shaft.addColorStop(0.901, '#c9a15a');
  shaft.addColorStop(1, '#8d6a2c');
  g.fillStyle = shaft;
  g.fill();
  const sheen = g.createLinearGradient(0, -6.5, 0, 6.5);
  sheen.addColorStop(0, 'rgba(255,255,255,.35)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = sheen;
  g.fill();
  g.restore();
}

// aim: { angle, power } while the player is lining up a shot, otherwise null.
export function drawPool(g, balls, aim, locked) {
  g.clearRect(0, 0, POOL_CANVAS.w, POOL_CANVAS.h);
  g.drawImage(tableImage(), 0, 0);

  const r = TABLE.r * S;
  for (const b of balls) {
    if (b.in) continue;
    const sh = g.createRadialGradient(tx(b.x) + r * 0.3, ty(b.y) + r * 0.45, r * 0.3, tx(b.x) + r * 0.3, ty(b.y) + r * 0.45, r * 1.25);
    sh.addColorStop(0, 'rgba(0,0,0,.5)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.beginPath();
    g.arc(tx(b.x) + r * 0.3, ty(b.y) + r * 0.45, r * 1.25, 0, Math.PI * 2);
    g.fill();
  }
  for (const b of balls) if (!b.in) drawBall(g, b);

  const cue = balls.find((b) => b.n === 0);
  if (aim && cue && !cue.in) drawCue(g, cue, aim.angle, aim.power, locked);
}

export function PoolCanvas({ balls, aim = null, locked = false, canvasRef, ...handlers }) {
  const own = useRef(null);
  const ref = canvasRef ?? own;
  const angle = aim?.angle;
  const power = aim?.power;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const paint = () => drawPool(cv.getContext('2d'), balls, angle == null ? null : { angle, power }, locked);
    paint();
    // Some browsers drop a canvas's pixels when the tab is backgrounded or the
    // screen rotates; nothing else would repaint a table that is sitting still.
    window.addEventListener('resize', paint);
    document.addEventListener('visibilitychange', paint);
    return () => {
      window.removeEventListener('resize', paint);
      document.removeEventListener('visibilitychange', paint);
    };
  }, [ref, balls, angle, power, locked]);

  return (
    <canvas
      ref={ref}
      className={`pool-canvas ${locked ? 'pool-canvas-locked' : ''}`}
      width={POOL_CANVAS.w}
      height={POOL_CANVAS.h}
      {...handlers}
    />
  );
}

// Balls already down, as a little rack under the table.
export function PocketedRack({ balls }) {
  const down = balls.filter((b) => b.in && b.n !== 0).sort((a, b) => a.n - b.n);
  if (!down.length) return null;
  return (
    <div className="pool-rack">
      <span className="captured-label">Pocketed:</span>
      {down.map((b) => (
        <span
          key={b.n}
          className={`pool-chip ${isStripe(b.n) ? 'pool-chip-stripe' : ''}`}
          style={{ '--ball': ballColor(b.n) }}
        >
          <b>{b.n}</b>
        </span>
      ))}
    </div>
  );
}
