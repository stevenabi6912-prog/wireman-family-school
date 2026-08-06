// Seeds Abi's Memory & Recitation Plan (2026-27) into Firestore.
// memoryItems: shared spine items carry tiers (t1=Lazarus, t2=Logan,
// t3=Luke&Layla); per-child items carry studentId. Content transcribed
// from Abi's plan documents.
// Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/seed-memory-plan.js

import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'wireman-homeschool' });
const db = admin.firestore();

const items = [];
const add = (o) => items.push(o);

// ---------- BIBLE: Names of God, 36 weeks (T3 verse refs from the plan;
// T1 key phrase / T2 full verse come from Abi's Memory Verse Master List —
// she can edit content per tier on the dashboard later) ----------
const BIBLE = [
  [1, 'Why a Name Matters', 'Prov. 18:10'], [2, 'Elohim — the Mighty Creator', 'Gen. 1:1'],
  [3, 'El Elyon — God Most High', 'Ps. 91:1'], [4, 'El Roi — the God who sees', 'Gen. 16:13'],
  [5, 'El Shaddai — God Almighty', 'Gen. 17:1'], [6, 'El Olam — the Everlasting God', 'Ps. 90:2'],
  [7, 'Adonai — Lord, Master', 'Isa. 6:8'], [8, 'Jehovah — I AM THAT I AM (hinge week — slow down)', 'Ex. 3:14'],
  [9, 'Jehovah-jireh — the LORD will provide', 'Gen. 22:14'], [10, 'Jehovah-rapha — the LORD that healeth', 'Ex. 15:26'],
  [11, 'Jehovah-nissi — the LORD my banner', 'Ex. 17:15'], [12, 'Jehovah-m\'kaddesh — the LORD that sanctifies', 'Lev. 20:7-8'],
  [13, 'Jehovah-shalom — the LORD is peace', 'Judg. 6:24; Isa. 26:3'], [14, 'Jehovah-sabaoth — the LORD of hosts', '1 Sam. 17:45; Ps. 46:7'],
  [15, 'Jehovah-raah — the LORD my shepherd', 'Psalm 23 (assigned, due Wk 18)'], [16, 'Jehovah-tsidkenu — the LORD our righteousness', 'Jer. 23:6'],
  [17, 'Jehovah-shammah — the LORD is there', 'Ezek. 48:35'], [18, 'SEMESTER 1 CAPSTONE', 'Ex. 3:14 + Psalm 23'],
  [19, 'Logos — the Word', 'John 1:1, 14'], [20, 'Jesus / Iesous — Jehovah saves', 'Matt. 1:21; Acts 4:12'],
  [21, 'Immanuel — God with us', 'Isa. 9:6'], [22, 'Christos — the Anointed One', 'Matt. 16:16'],
  [23, 'Kurios — Lord', 'Phil. 2:9-11'], [24, 'Theos — God', 'John 20:28; Titus 2:13'],
  [25, 'Son of God', 'John 5:23; Heb. 1:3'], [26, 'Son of Man', 'Dan. 7:13-14'],
  [27, 'The Lamb of God', 'John 1:29; Isa. 53:6'], [28, 'High Priest · Mediator · Advocate', 'Heb. 4:15-16; 1 Tim. 2:5'],
  [29, 'I AM the Bread of Life · the Light of the World', 'John 6:35; 8:12'], [30, 'I AM the Door · the Good Shepherd', 'John 10:11'],
  [31, 'I AM the Resurrection · the Way · the True Vine', 'John 11:25; 14:6'], [32, 'Abba, Father', 'Rom. 8:15; Gal. 4:6'],
  [33, 'Parakletos — the Comforter', 'John 14:16-17'], [34, 'Alpha & Omega · the Almighty', 'Rev. 1:8; 22:13'],
  [35, 'King of Kings and Lord of Lords', 'Rev. 19:16'], [36, 'YEAR CAPSTONE', 'Ex. 3:14 · Ps. 23 · John 1:1,14 · Phil. 2:9-11 · the year thesis'],
];
for (const [week, title, ref] of BIBLE) {
  add({ track: 'bible', unit: Math.min(6, Math.ceil(week / 6)), week, title, reference: ref,
    tierNote: 'T1 (Lazarus): key phrase · T2 (Logan): full verse · T3 (Luke & Layla): verse as listed — per the Names of God Master List',
    source: 'names-of-god' });
}

// ---------- HISTORY date pegs (t3 weekly from the 8th plan; t1/t2 flags) ----------
const HIST = [
  [1, '313 — Edict of Milan', 't2'], [2, '410 — Alaric sacks Rome', 't1'], [3, '451 — Council of Chalcedon', 't3'],
  [4, '476 — Fall of the Western Roman Empire', 't1'], [5, '527-565 — Justinian; 529 Rule of St. Benedict', 't2'],
  [7, '622 — The Hijra', 't2'], [8, '637 — Muslim capture of Jerusalem', 't3'], [9, '711 — Moors invade Spain', 't2'],
  [10, '732 — Battle of Tours', 't1'], [11, '800 — Charlemagne crowned Emperor', 't1'],
  [13, '793 — Vikings raid Lindisfarne', 't1'], [14, '871-899 — Alfred the Great', 't2'], [15, '962 — Otto I; Holy Roman Empire', 't3'],
  [16, '1054 — The Great Schism (East/West)', 't2'], [17, '1066 — Battle of Hastings', 't1'],
  [19, '1095 — Urban II calls the First Crusade', 't1'], [20, '1099 — Crusaders take Jerusalem', 't2'],
  [21, '1170 — Murder of Thomas Becket', 't3'], [22, '1187 — Saladin retakes Jerusalem', 't2'], [23, '1215 — Magna Carta', 't1'],
  [25, '1271-1295 — Marco Polo', 't3'], [26, '1337-1453 — Hundred Years\' War', 't2'], [27, '1347-1351 — The Black Death', 't1'],
  [28, '1378-1417 — Great Schism of the West', 't2'], [29, '1382 — Wycliffe\'s English Bible', 't1'],
  [31, '1415 — Jan Hus burned; Agincourt', 't3'], [32, '1429 — Joan of Arc at Orléans', 't2'],
  [33, '1453 — Fall of Constantinople; 1455 Gutenberg Bible', 't1'], [34, '1492 — Granada falls; Columbus sails', 't1'],
  [35, '1517 — Luther\'s 95 Theses', 't2'],
];
// minTier: t1 = everyone recites it, t2 = Logan + 8th, t3 = 8th only
for (const [week, title, minTier] of HIST) {
  add({ track: 'history', unit: Math.min(6, Math.ceil(week / 6)), week, title, minTier, source: 'hillsdale' });
}

// ---------- SCIENCE (t3 weekly; grammar-stage kids get the unit items) ----------
const SCI3 = [
  [1, 'The scientific method, in steps'], [2, 'Astronomers\' tools: refracting vs. reflecting telescope, radio telescope, spectroscope'],
  [3, 'Ptolemy, Copernicus, Brahe, Kepler, Galileo, Newton — who did what'], [4, 'Units of space: AU, light-year, parsec'],
  [5, 'Galaxy types: spiral, barred spiral, elliptical, irregular'],
  [7, 'The sun: core, radiative zone, convective zone, photosphere, chromosphere, corona'],
  [8, 'Planets in order + terrestrial / gas giant / ice giant / dwarf'], [9, 'Inner planets — one distinguishing fact each'],
  [10, 'Outer planets — one distinguishing fact each'], [11, 'Asteroids, comets, meteoroid → meteor → meteorite'],
  [13, 'Rotation vs. revolution; solstice, equinox; why we have seasons'], [14, 'The 8 moon phases'],
  [15, 'Eclipse geometry; umbra and penumbra'], [16, 'Star classification O B A F G K M'],
  [17, 'Star life cycle: nebula → main sequence → giant → white dwarf / neutron star / black hole'],
  [19, 'Latitude & longitude; prime meridian, equator, tropics, polar circles'], [20, 'Map types; contour lines, scale, legend'],
  [21, 'Layers of the Earth + the Moho'], [22, 'Plate boundaries + the evidence for each'],
  [23, 'Earthquakes: focus, epicenter, P/S/surface waves; moment magnitude'],
  [25, 'Three rock types + the rock cycle'], [26, 'Mohs hardness scale 1-10'],
  [27, 'Mineral ID: luster, streak, cleavage, hardness, specific gravity'], [28, 'Volcano types + lava viscosity'],
  [29, 'Weathering vs. erosion; soil horizons O A E B C R'],
  [31, 'Layers of the atmosphere + composition (78% N, 21% O, 1% other)'], [32, 'Cloud types + combinations'],
  [33, 'The water cycle, all six steps'], [34, 'Air masses + fronts'],
  [35, 'Ocean floor: shelf, slope, abyssal plain, trench, ridge; currents & tides'],
];
for (const [week, title] of SCI3) {
  add({ track: 'science', unit: Math.min(6, Math.ceil(week / 6)), week, title, minTier: 't3', source: 'elemental-science' });
}
const SCI_GRAMMAR = [
  [1, 3, 'The 8 planets in order', 't1'], [1, 4, 'Sun, moon, star, planet — define each · the phases of the moon', 't2'],
  [2, 9, 'Day, month, year — what causes each', 't1'], [2, 10, 'Inner vs. outer planets · what a comet is made of', 't2'],
  [3, 14, 'The four seasons and why we have them', 't1'], [3, 15, 'The 8 moon phases in order · solar vs. lunar eclipse', 't2'],
  [4, 20, 'The four layers of the Earth', 't1'], [4, 21, 'Equator, prime meridian, the 7 continents and 5 oceans · map legend and scale', 't2'],
  [5, 26, 'The three rock types', 't1'], [5, 27, 'The rock cycle in order · Mohs scale, hardest and softest', 't2'],
  [6, 32, 'The water cycle, four steps', 't1'], [6, 33, 'Cloud types: cirrus, cumulus, stratus, nimbus · what makes wind', 't2'],
];
for (const [unit, week, title, minTier] of SCI_GRAMMAR) {
  add({ track: 'science', unit, week, title, minTier, maxTier: 't2', source: 'elemental-science' });
}

// ---------- GRAMMAR & COMPOSITION ----------
const GRAM3 = [
  [1, 'The 8 parts of speech'], [2, 'Preposition list (chant it)'], [3, 'The 23 helping verbs'],
  [4, 'Linking verbs; subject vs. predicate'], [5, 'Clause vs. phrase'],
  [7, 'Noun jobs: subject, DO, IO, predicate nominative, object of preposition, appositive'], [8, 'Pronoun cases'],
  [9, 'The who/whom rule'], [10, 'IEW dress-ups, all 5'], [11, 'The six verb tenses'],
  [13, 'Active vs. passive voice'], [14, 'Gerund + its noun jobs'], [15, 'Participle & participial phrase'],
  [16, 'Infinitive & infinitive phrase'], [17, 'Verbals: telling all three apart'],
  [19, 'IEW openers, all 7'], [20, 'Adjective clauses + relative pronouns'], [21, 'Adverb clauses + subordinating conjunctions'],
  [22, 'Noun clauses and their six jobs'], [23, 'FANBOYS + the MC, cc MC comma rule'],
  [25, 'Comma rules: series, opener, MC cc MC, interrupter'], [26, 'Quotation marks & dialogue punctuation'],
  [27, 'Semicolon & colon rules'], [28, 'Apostrophe rules'], [29, 'Essential vs. nonessential (that vs. which)'],
  [31, 'Sentence structures: simple, compound, complex, compound-complex'], [32, 'Commonly confused words, set A'],
  [33, 'Commonly confused words, set B'], [34, 'Capitalization rules'],
  [35, 'IEW decorations: alliteration, question, conversation, 3sss, dramatic open-close'],
];
for (const [week, title] of GRAM3) {
  add({ track: 'grammar', unit: Math.min(6, Math.ceil(week / 6)), week, title, minTier: 't3', maxTier: 't3', source: 'iew' });
}
const GRAM_LOGAN = [
  [1, 'The 8 parts of speech'], [2, 'Noun and verb defined'], [3, 'What a sentence must have'], [4, 'Common vs. proper nouns'], [5, 'Articles'],
  [7, 'The 23 helping verbs'], [8, 'Linking verbs'], [9, 'Adjective and adverb defined'], [10, 'Subject and predicate'], [11, 'IEW dress-ups: -ly adverb, strong verb, quality adjective'],
  [13, 'The preposition list (chant it)'], [14, 'Prepositional phrase'], [15, 'Pronouns and what they replace'], [16, 'Conjunctions'], [17, 'Interjections'],
  [19, 'Capitalization rules'], [20, 'Comma in a series'], [21, 'Comma with a name being addressed'], [22, 'Comma after an opener'], [23, 'Quotation marks in dialogue'],
  [25, 'Simple vs. compound sentence'], [26, 'FANBOYS'], [27, 'Complex sentence'], [28, 'Clause vs. phrase'], [29, 'IEW dress-ups: who/which clause, www.asia.b clause'],
  [31, 'IEW openers #1-#6'], [32, 'End-mark punctuation'], [33, 'Apostrophes: possessive and contraction'], [34, 'their/there/they\'re · your/you\'re · its/it\'s'], [35, 'Grand review'],
];
for (const [week, title] of GRAM_LOGAN) {
  add({ track: 'grammar', unit: Math.min(6, Math.ceil(week / 6)), week, title, studentId: 'logan', source: 'iew' });
}
add({ track: 'grammar', unit: 0, week: 0, title: 'English Grammar Practice — 2-3 questions/week straight from the book; Day 4 asks current week + 3 random earlier', studentId: 'lazarus', source: 'custom', standing: true });
const SPELL_LAZ = [
  [1, 'Every syllable has a vowel · c says /s/ before e,i,y · g says /j/ before e,i,y · two jobs of silent e · q is always followed by u'],
  [2, 'The doubling rule (1-1-1) · silent-e drop rule · y-to-i rule · plurals -s/-es · plurals of words ending in y'],
  [3, 'ck, tch, dge only after a short vowel · i before e except after c · -ck vs. -k'],
  [4, 'The five kinds of syllables · dividing between two consonants · open vs. closed syllables · schwa · accents'],
  [5, 'Contractions and the apostrophe · possessives singular & plural · its vs. it\'s · common homophones'],
  [6, 'Prefixes · suffixes · -ed says /d/, /t/, /ed/ · silent letters (kn, wr, gn, mb) · grand review'],
];
for (const [unit, title] of SPELL_LAZ) {
  add({ track: 'spelling', unit, week: unit * 6 - 3, title: `Spelling rules, Unit ${unit}: ${title}`, studentId: 'lazarus', source: 'custom' });
}

// ---------- SPANISH (Flip Flop) — t3 weekly; t1/t2 same topic (Laz: vocab only) ----------
const SPAN = [
  [1, 'Greetings & courtesy'], [2, 'Numbers 0-20'], [3, 'Numbers 21-100'], [4, 'Days & months'], [5, 'Colors'],
  [7, 'Family'], [8, 'Ser'], [9, 'Estar'], [10, 'Ser vs. estar — four uses each'], [11, 'Tener + tener expressions'],
  [13, 'Ir + ir a + infinitive'], [14, 'Articles + noun gender'], [15, 'Noun/adjective agreement'], [16, 'Subject pronouns'], [17, 'Regular -ar endings'],
  [19, 'Regular -er endings'], [20, 'Regular -ir endings'], [21, 'Question words'], [22, 'Classroom commands'], [23, 'Body parts'],
  [25, 'Clothing'], [26, 'Food & meals'], [27, 'House & rooms'], [28, 'Places in town'], [29, 'Weather expressions'],
  [31, 'Telling time'], [32, 'Gustar constructions'], [33, 'Irregulars: hacer, poder, querer'], [34, 'Prepositions of place'], [35, 'Dialogue practice'],
];
for (const [week, title] of SPAN) {
  add({ track: 'spanish', unit: Math.min(6, Math.ceil(week / 6)), week, title,
    tierNote: 'Luke/Layla & Logan: full chunk sets · Lazarus: vocabulary only', source: 'custom' });
}

// ---------- UNIT RECITATION PIECES (tiered lengths) ----------
const PIECES = [
  [1, 6, 'Psalm 100 (KJV)', 'vv. 1-2', 'vv. 1-3', 'all 5 verses'],
  [2, 12, 'Isaiah 40 (KJV)', '40:31', '40:30-31', '40:28-31'],
  [3, 16, 'Beowulf — opening, in Old English ("Hwæt! Wē Gār-Dena…") + paraphrase', 'first 3 lines', 'first 6 lines', 'opening lines + paraphrase'],
  [3, 18, 'Psalm 23 (from the Bible curriculum)', 'vv. 1-4', 'entire psalm', 'entire psalm'],
  [4, 22, 'Unit 4 piece', '"Sir Galahad" (Tennyson), stanza 1', '"Sir Galahad", stanzas 1-2', 'Magna Carta, Clause 39 (then trace it to the Fifth Amendment)'],
  [5, 26, 'Chaucer, Canterbury Tales — General Prologue, Middle English + paraphrase', 'lines 1-4', 'lines 1-8', 'lines 1-18'],
  [6, 34, 'Unit 6 piece', 'St. Crispin\'s Day — the "band of brothers" lines', 'St. Crispin\'s Day — the fuller excerpt', 'Macbeth V.v — "Tomorrow, and tomorrow" soliloquy (~10 lines)'],
];
for (const [unit, week, title, t1, t2, t3] of PIECES) {
  add({ track: 'passage', unit, week, title, isUnitPiece: true, pieceT1: t1, pieceT2: t2, pieceT3: t3, source: 'custom' });
}
add({ track: 'passage', unit: 3, week: 13, title: '"A Visit from St. Nicholas" — due last school day before Christmas break, recited at family Christmas', studentId: 'lazarus', isUnitPiece: true, source: 'custom' });

// ---------- MATH drill banks (displayed at math time, not the memory block) ----------
const MATH_DRILL = [
  ['lazarus', 1, '×0, ×1, ×2, ×10 — THE priority of the year: 2 min at the top of every math hour'],
  ['lazarus', 2, '×5, ×3'], ['lazarus', 3, '×9 (nines trick) · ×4'], ['lazarus', 4, '×6 · ×11'],
  ['lazarus', 5, '×7 · ×8'], ['lazarus', 6, '×12 · full table 0-12 random order under 3 minutes'],
  ['logan', 1, 'Numerator/denominator · equivalent fractions · improper vs. mixed'],
  ['logan', 2, 'Divisibility rules 2,3,5,9,10 · prime vs. composite · primes to 50'],
  ['logan', 3, 'Factors, multiples, GCF, LCM — defined + how to find each'],
  ['logan', 4, 'Fraction ↔ decimal equivalents: halves, thirds, fourths, fifths, eighths, tenths'],
  ['logan', 5, 'Fraction ↔ decimal ↔ percent · why adding needs a common denominator'],
  ['logan', 6, 'Multiplying vs. dividing fractions — the rule for each, said aloud · grand review'],
];
for (const [studentId, unit, title] of MATH_DRILL) {
  add({ track: 'math', unit, week: unit * 6 - 5, title, studentId, source: 'custom' });
}
for (let u = 1; u <= 6; u++) {
  add({ track: 'math', unit: u, week: u * 6 - 5, title: `Algebra 1 memory bank — see Appendix A list (order of ops, integer rules, properties, exponent rules, slope, quadratic formula, special products, squares/cubes, geometry formulas, Pythagorean, percent/D=RT)`, minTier: 't3', maxTier: 't3', source: 'custom' });
}

async function main() {
  // wipe + reseed idempotently
  const old = await db.collection('memoryItems').get();
  let batch = db.batch(); let n = 0;
  for (const d of old.docs) { batch.delete(d.ref); if (++n === 450) { await batch.commit(); batch = db.batch(); n = 0; } }
  if (n) await batch.commit();

  batch = db.batch(); n = 0;
  for (let i = 0; i < items.length; i++) {
    batch.set(db.collection('memoryItems').doc(`mi-${String(i).padStart(3, '0')}`), {
      studentId: null, minTier: 't1', maxTier: 't3', isUnitPiece: false, standing: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...items[i],
    });
    if (++n === 450) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();
  console.log(`Seeded ${items.length} memory items.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
