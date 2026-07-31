// Game data + tiny generators for the brain-break arcade. No external assets.

// ---------- Sudoku (4x4 for little kids, 6x6 otherwise) ----------
export function makeSudoku(size, seed) {
  // build a solved latin-square-style grid with box constraints, then blank cells
  const boxW = size === 4 ? 2 : 3;
  const boxH = 2;
  const base = [];
  for (let r = 0; r < size; r++) {
    base.push([]);
    for (let c = 0; c < size; c++) {
      base[r][c] = ((Math.floor(r / boxH) + r * boxW + c) % size) + 1;
    }
  }
  // seeded shuffles of rows/cols within bands keep it valid
  let s = seed;
  const rand = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let band = 0; band < size / boxH; band++) {
    if (rand() > 0.5) {
      const r1 = band * boxH;
      [base[r1], base[r1 + 1]] = [base[r1 + 1], base[r1]];
    }
  }
  const digitMap = Array.from({ length: size }, (_, i) => i + 1).sort(() => rand() - 0.5);
  const solution = base.map((row) => row.map((v) => digitMap[v - 1]));
  const given = solution.map((row) => row.map((v) => (rand() < (size === 4 ? 0.55 : 0.42) ? v : 0)));
  return { size, boxW, boxH, solution, given };
}

// ---------- Word search ----------
export const WORD_THEMES = [
  { name: 'Castle Days', words: ['KNIGHT', 'CASTLE', 'QUEEN', 'SWORD', 'MOAT', 'CROWN', 'JOUST', 'SHIELD'] },
  { name: 'Earth Science', words: ['VOLCANO', 'RIVER', 'CRUST', 'MAGMA', 'GLACIER', 'CANYON', 'MINERAL', 'FOSSIL'] },
  { name: 'Math Zone', words: ['FRACTION', 'DIVIDE', 'ANGLE', 'GRAPH', 'EQUAL', 'DIGIT', 'PRIME', 'SUM'] },
];

export function makeWordSearch(theme, seed, size = 10) {
  let s = seed;
  const rand = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const dirs = [[0, 1], [1, 0], [1, 1], [-1, 1]];
  const placed = [];
  for (const word of theme.words) {
    let done = false;
    for (let tries = 0; tries < 80 && !done; tries++) {
      const [dr, dc] = dirs[Math.floor(rand() * dirs.length)];
      const r0 = Math.floor(rand() * size);
      const c0 = Math.floor(rand() * size);
      const rEnd = r0 + dr * (word.length - 1);
      const cEnd = c0 + dc * (word.length - 1);
      if (rEnd < 0 || rEnd >= size || cEnd < 0 || cEnd >= size) continue;
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const ch = grid[r0 + dr * i][c0 + dc * i];
        if (ch && ch !== word[i]) { ok = false; break; }
      }
      if (!ok) continue;
      for (let i = 0; i < word.length; i++) grid[r0 + dr * i][c0 + dc * i] = word[i];
      placed.push({ word, r0, c0, r1: rEnd, c1: cEnd });
      done = true;
    }
  }
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (!grid[r][c]) grid[r][c] = letters[Math.floor(rand() * 26)];
  return { grid, placed: placed.map((p) => ({ ...p })), theme: theme.name };
}

// ---------- Word builder (make words from these letters) ----------
export const SCRAMBLES = [
  { letters: 'PLANET', words: ['PLANET', 'PLANE', 'PLANT', 'PANEL', 'LEAP', 'LANE', 'PLAN', 'PANE', 'NEAT', 'TAPE', 'LATE', 'PEAT', 'ANT', 'PAL', 'NAP', 'TEN', 'PEN', 'EAT'] },
  { letters: 'CASTLE', words: ['CASTLE', 'CLEATS', 'SCALE', 'SLATE', 'STEAL', 'LEAST', 'TALES', 'CASE', 'LACE', 'SALT', 'LAST', 'SEAT', 'EAST', 'ACE', 'CAT', 'SEA', 'LET'] },
  { letters: 'STREAM', words: ['STREAM', 'MASTER', 'TAMERS', 'SMART', 'STEAM', 'TEAMS', 'MATES', 'RATES', 'STARE', 'TEARS', 'MAST', 'STAR', 'TERM', 'RATS', 'ARM', 'SAT', 'TEA'] },
  { letters: 'ORANGE', words: ['ORANGE', 'ONAGER', 'GROAN', 'ORGAN', 'ANGER', 'RANGE', 'GONE', 'NEAR', 'EARN', 'GEAR', 'RAGE', 'ORE', 'AGE', 'RAN', 'EGO', 'NOR'] },
  { letters: 'WINTER', words: ['WINTER', 'TWINER', 'WRITE', 'INTER', 'TWINE', 'INERT', 'WENT', 'WIRE', 'TIRE', 'RENT', 'TWIN', 'WIN', 'TIN', 'NET', 'WIT', 'IRE'] },
  { letters: 'GARDEN', words: ['GARDEN', 'DANGER', 'GANDER', 'RANGED', 'GRAND', 'GRADE', 'ANGER', 'RANGE', 'DARE', 'READ', 'DEAR', 'RAGE', 'DEN', 'RAG', 'EAR', 'AND'] },
];

// ---------- Castle trivia (SOTW Vol 2 era) ----------
export const TRIVIA = [
  { q: 'What was the name of the wall knights defended around a castle?', a: ['Battlement', 'Bookshelf', 'Backyard', 'Baseline'], c: 0 },
  { q: 'What did people call the ditch of water around a castle?', a: ['A pond', 'A moat', 'A pool', 'A lake'], c: 1 },
  { q: 'Rome fell partly because of attacks by whom?', a: ['Barbarian tribes', 'Pirates', 'Robots', 'Vikings only'], c: 0 },
  { q: 'Who were the fierce sailors from the north with longships?', a: ['Romans', 'Egyptians', 'Vikings', 'Greeks'], c: 2 },
  { q: 'What is a young knight-in-training called?', a: ['A page', 'A prince', 'A wizard', 'A monk'], c: 0 },
  { q: 'Monks copied books by hand in rooms called what?', a: ['Kitchens', 'Scriptoriums', 'Stables', 'Dungeons'], c: 1 },
  { q: 'What giant empire did Genghis Khan build?', a: ['The Roman Empire', 'The Mongol Empire', 'The Aztec Empire', 'The British Empire'], c: 1 },
  { q: 'Knights followed a code of honor called what?', a: ['Chivalry', 'Chemistry', 'Charity', 'Cheddar'], c: 0 },
  { q: 'What weapon launched huge stones at castle walls?', a: ['A catapult', 'A cannonball gun', 'A slingshot', 'A crossbow'], c: 0 },
  { q: 'Who was crowned emperor on Christmas Day in the year 800?', a: ['Charlemagne', 'Julius Caesar', 'King Arthur', 'Napoleon'], c: 0 },
  { q: 'The Silk Road was famous for what?', a: ['Racing camels', 'Trading goods between east and west', 'Building silk castles', 'Growing rice'], c: 1 },
  { q: 'What sickness swept through Europe in the Middle Ages?', a: ['The Black Death', 'The Blue Flu', 'Dragon pox', 'The Red Cold'], c: 0 },
  { q: 'Samurai warriors served in which country?', a: ['Japan', 'France', 'Egypt', 'Brazil'], c: 0 },
  { q: 'What did a blacksmith make?', a: ['Bread', 'Metal tools and armor', 'Books', 'Candles'], c: 1 },
  { q: 'Cathedrals often had colorful windows made of what?', a: ['Stained glass', 'Painted wood', 'Colored paper', 'Seashells'], c: 0 },
  { q: 'Who pulled the sword from the stone in legend?', a: ['Robin Hood', 'King Arthur', 'Sir Lancelot', 'Beowulf'], c: 1 },
];
