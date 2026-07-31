// Cosmetic themes a kid can pick for their own checklist. Purely visual —
// stored as students/{id}.theme and writable by the student (rules restrict
// them to this one field, nothing else on their doc).

export const PALETTES = {
  sky: {
    label: 'Sky',
    bg: 'linear-gradient(180deg, #dbeeff 0%, #f2f8ff 100%)',
    card: '#ffffff',
    accent: '#3b82d6',
    accentSoft: '#d7e9fb',
    header: 'linear-gradient(90deg, #3b82d6, #6ab0f3)',
  },
  forest: {
    label: 'Forest',
    bg: 'linear-gradient(180deg, #ddf0e0 0%, #f3faf4 100%)',
    card: '#ffffff',
    accent: '#3d9159',
    accentSoft: '#d8efdf',
    header: 'linear-gradient(90deg, #3d9159, #6fbe88)',
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
  lava: {
    label: 'Lava',
    bg: 'linear-gradient(180deg, #ffd9d2 0%, #fff0ed 100%)',
    card: '#ffffff',
    accent: '#d64533',
    accentSoft: '#fadcd7',
    header: 'linear-gradient(90deg, #d64533, #ef7f6f)',
  },
};

export const AVATARS = [
  '🦖', '🐉', '🦁', '🐺', '🦅', '🦈', '🐙', '🦊',
  '🐸', '🐢', '🦄', '🐼', '🐨', '🦉', '⚡', '🔥',
  '🌟', '🚀', '⚽', '🏀', '🎸', '🎨', '🕹️', '🏰',
];

export const DEFAULT_THEMES = {
  luke: { palette: 'sky', avatar: '🦅' },
  layla: { palette: 'bubblegum', avatar: '🦄' },
  logan: { palette: 'forest', avatar: '🦖' },
  lazarus: { palette: 'sunset', avatar: '🐸' },
};

export function resolveTheme(studentId, themeFromDoc) {
  const fallback = DEFAULT_THEMES[studentId] ?? { palette: 'sky', avatar: '🌟' };
  const palette = PALETTES[themeFromDoc?.palette] ? themeFromDoc.palette : fallback.palette;
  const avatar = themeFromDoc?.avatar && AVATARS.includes(themeFromDoc.avatar)
    ? themeFromDoc.avatar
    : fallback.avatar;
  return { palette, avatar, colors: PALETTES[palette] };
}
