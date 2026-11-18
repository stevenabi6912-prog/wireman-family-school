// The family chess set, drawn in code on a 45x45 grid. One silhouette per
// piece type; colour comes from the gradient + outline, so white and black are
// always the same shapes and both read on light and dark squares.

const BASE = 'M10.5 39.5 v-2.6 a3 3 0 0 1 3-3 h18 a3 3 0 0 1 3 3 v2.6 z';
const SKIRT = 'M13.5 27 h18 c-0.5 2.6 0.6 5 2.2 7 h-22.4 c1.6-2 2.7-4.4 2.2-7 z';

// body: filled silhouettes. marks: thin detail strokes. dots: small solid details.
const SHAPES = {
  P: {
    body: [
      'M22.5 7.5 a5.5 5.5 0 0 1 3.6 9.66 c2.4 1.2 3.9 3 3.9 4.84 h-3.2 c0.6 4.5 3 8.5 5.7 12 h-20 c2.7-3.5 5.1-7.5 5.7-12 h-3.2 c0-1.84 1.5-3.64 3.9-4.84 A5.5 5.5 0 0 1 22.5 7.5 z',
    ],
    marks: [],
  },
  R: {
    body: [
      'M12 8.5 h4.6 v3 h3.6 v-3 h4.6 v3 h3.6 v-3 h4.6 v8 l-3 3 v10.5 l3 4 h-21 l3-4 v-10.5 l-3-3 z',
    ],
    marks: ['M12.6 16.5 h19.8', 'M15.4 19.5 h14.2', 'M15.4 30 h14.2'],
  },
  N: {
    body: [
      'M33 34 c1-7 0.5-13 -2-18 c-1.8-3.6 -4.2-6.2 -7-7.6 l-0.8-3.6 l-2.7 2.8 c-3 0.8 -5.2 2.6 -6.8 5 l-4.4 6.4 c-0.9 1.4 -0.6 3 0.6 4 c1.2 1 2.8 1 4 0.2 l3.6-2.6 c1.4 0.2 2.8-0.2 4-1 c-0.2 3.2 -2 5.6 -4.2 8 c-1.8 2 -3 4 -3.3 6.4 z',
    ],
    marks: ['M26.6 11.6 c2.6 3.4 4 8 3.9 13.4', 'M12.4 22.6 l1.6-1.2'],
    dots: [[17.6, 13.4, 1.15], [11.3, 20.3, 0.55]],
  },
  B: {
    body: [
      'M17 28.5 h11 c0 2.5 2.5 4 5 5.5 h-21 c2.5-1.5 5-3 5-5.5 z',
      'M22.5 9.3 c-4.5 3.5 -7 7.2 -7 11.2 c0 2.6 1.6 4.6 3.6 5.6 l-1.1 2.4 h9 l-1.1-2.4 c2-1 3.6-3 3.6-5.6 c0-4 -2.5-7.7 -7-11.2 z',
      'M22.5 4.6 a2.4 2.4 0 1 0 0.01 0 z',
    ],
    marks: ['M22.5 15.4 v6.2', 'M19.7 18.3 h5.6', 'M18.4 26.1 h8.2'],
  },
  Q: {
    body: [
      SKIRT,
      'M9.5 14.5 l4 12.5 h18 l4-12.5 l-6.2 7.5 l-0.6-10 l-4.8 9.5 l-1.4-11 l-1.4 11 l-4.8-9.5 l-0.6 10 z',
      'M9.5 10.8 a2.1 2.1 0 1 0 0.01 0 z',
      'M16.3 8.2 a2.1 2.1 0 1 0 0.01 0 z',
      'M22.5 6.5 a2.1 2.1 0 1 0 0.01 0 z',
      'M28.7 8.2 a2.1 2.1 0 1 0 0.01 0 z',
      'M35.5 10.8 a2.1 2.1 0 1 0 0.01 0 z',
    ],
    marks: ['M13.2 30.4 h18.6'],
  },
  K: {
    body: [
      SKIRT,
      'M22.5 12 c2 0 3.5 1.5 3.5 3.5 c2-2.3 5.5-3.5 8-1.5 c3.2 2.6 2 7.5 -2.5 13 h-18 c-4.5-5.5 -5.7-10.4 -2.5-13 c2.5-2 6-0.8 8 1.5 c0-2 1.5-3.5 3.5-3.5 z',
      'M21.2 3.6 h2.6 v2.5 h2.5 v2.6 h-2.5 v3.6 h-2.6 v-3.6 h-2.5 v-2.6 h2.5 z',
    ],
    marks: ['M13.2 30.4 h18.6', 'M22.5 16 v10.6'],
  },
};

const INK = {
  w: { line: '#3b2a1a', mark: '#3b2a1a', top: '#fffdf6', mid: '#f1e6cc', low: '#cdb88c' },
  b: { line: '#07070a', mark: '#c3c6d6', top: '#6a6d7d', mid: '#35363f', low: '#15161b' },
};

export function ChessPiece({ piece, className = '' }) {
  const color = piece[0] === 'w' ? 'w' : 'b';
  const shape = SHAPES[piece[1]] ?? SHAPES.P;
  const ink = INK[color];
  const grad = `cp-grad-${color}`;
  return (
    <svg className={`cp cp-${color} ${className}`} viewBox="3.5 1.8 38 39.5" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={grad} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor={ink.top} />
          <stop offset="0.5" stopColor={ink.mid} />
          <stop offset="1" stopColor={ink.low} />
        </linearGradient>
      </defs>
      <g fill={`url(#${grad})`} stroke={ink.line} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
        {shape.body.map((d, i) => <path key={i} d={d} />)}
        <path d={BASE} />
      </g>
      <g fill="none" stroke={ink.mark} strokeWidth="1.2" strokeLinecap="round">
        {shape.marks.map((d, i) => <path key={i} d={d} />)}
      </g>
      {shape.dots?.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill={ink.mark} />)}
    </svg>
  );
}

// King's crown for checkers, in the same hand as the chess set.
export function CrownMark({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M3.5 8.2 l3.6 8.3 h9.8 l3.6-8.3 l-4.7 3.9 l-3.8-6.2 l-3.8 6.2 z M6.6 17.9 h10.8 v2 h-10.8 z"
        fill="#ffd95a"
        stroke="#8a5a00"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="5.2" r="1.3" fill="#fff3b8" stroke="#8a5a00" strokeWidth="0.8" />
      <circle cx="3.5" cy="7.6" r="1.2" fill="#fff3b8" stroke="#8a5a00" strokeWidth="0.8" />
      <circle cx="20.5" cy="7.6" r="1.2" fill="#fff3b8" stroke="#8a5a00" strokeWidth="0.8" />
    </svg>
  );
}
