// Cosmetic themes a kid can pick for their own checklist. Purely visual —
// stored as students/{id}.theme and writable by the student (rules restrict
// them to this one field, nothing else on their doc).

export const PALETTES = {
  // ---- signature palettes (each kid's default identity) ----
  outdoors: {
    label: 'Outdoors',
    bg: 'linear-gradient(180deg, #dce8d4 0%, #f2f6ec 100%)',
    card: '#ffffff',
    accent: '#4a6b3a',
    accentSoft: '#dde9d4',
    header: 'linear-gradient(90deg, #3e5c2f, #6d8a4e)',
  },
  trickshot: {
    label: 'Trick Shot',
    bg: 'linear-gradient(180deg, #d9f2dc 0%, #f0fbf1 100%)',
    card: '#ffffff',
    accent: '#1f9e46',
    accentSoft: '#d4f0da',
    header: 'linear-gradient(90deg, #17301d, #1f9e46)',
  },
  teal: {
    label: 'Teal Glow',
    bg: 'linear-gradient(180deg, #cdeff0 0%, #effafa 100%)',
    card: '#ffffff',
    accent: '#12939b',
    accentSoft: '#d0eef0',
    header: 'linear-gradient(90deg, #12939b, #4fc6cc)',
  },
  gridiron: {
    label: 'Gridiron',
    bg: 'linear-gradient(180deg, #d6e4f5 0%, #eef4fb 100%)',
    card: '#ffffff',
    accent: '#0076B6',
    accentSoft: '#d3e7f4',
    header: 'linear-gradient(90deg, #0076B6, #5ba8d6)',
  },
  // ---- extra choices ----
  sky: {
    label: 'Sky',
    bg: 'linear-gradient(180deg, #dbeeff 0%, #f2f8ff 100%)',
    card: '#ffffff',
    accent: '#3b82d6',
    accentSoft: '#d7e9fb',
    header: 'linear-gradient(90deg, #3b82d6, #6ab0f3)',
  },
  sunset: {
    label: 'Sunset',
    bg: 'linear-gradient(180deg, #ffe4d1 0%, #fff4ec 100%)',
    card: '#ffffff',
    accent: '#e0763a',
    accentSoft: '#fbe3d2',
    header: 'linear-gradient(90deg, #e0763a, #f0a06b)',
  },
  bubblegum: {
    label: 'Bubblegum',
    bg: 'linear-gradient(180deg, #ffdff0 0%, #fff2f9 100%)',
    card: '#ffffff',
    accent: '#d6539c',
    accentSoft: '#f9d9eb',
    header: 'linear-gradient(90deg, #d6539c, #ec86bf)',
  },
  space: {
    label: 'Space',
    bg: 'linear-gradient(180deg, #23244d 0%, #3b3d78 100%)',
    card: '#ffffff',
    accent: '#5b5fc7',
    accentSoft: '#dcddf5',
    header: 'linear-gradient(90deg, #5b5fc7, #8a8ee0)',
    darkBg: true,
  },
};

export const AVATARS = [
  // outdoors
  '🎣', '🦌', '🏹', '🐟', '🦆', '🏕️', '🔥', '🥾',
  // trick shot / sports
  '🎯', '🏀', '🏈', '⛳', '🎳', '🥏', '🏆', '💥',
  // tween glow
  '🐬', '🌊', '🦋', '🎧', '🌺', '🧋', '✨', '🐢',
  // classics
  '🦁', '🦅', '🦖', '🐸', '🦄', '🚀', '⚡', '🐙',
];

export const DEFAULT_THEMES = {
  luke: { palette: 'gridiron', avatar: '🦁' },
  layla: { palette: 'teal', avatar: '🐬' },
  logan: { palette: 'outdoors', avatar: '🎣' },
  lazarus: { palette: 'trickshot', avatar: '🎯' },
};

export function resolveTheme(studentId, themeFromDoc) {
  const fallback = DEFAULT_THEMES[studentId] ?? { palette: 'sky', avatar: '✨' };
  const palette = PALETTES[themeFromDoc?.palette] ? themeFromDoc.palette : fallback.palette;
  const avatar = themeFromDoc?.avatar && AVATARS.includes(themeFromDoc.avatar)
    ? themeFromDoc.avatar
    : fallback.avatar;
  return { palette, avatar, colors: PALETTES[palette] };
}
