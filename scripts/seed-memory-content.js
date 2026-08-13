// Layla: "it just gives us a topic to memorize not a sentence." She was right —
// only the Bible track ever got real memorization text (see
// seed-kjv-verses.js); grammar, history, and science items only ever had a
// bare topic title. This fills the actual content in for those three tracks.
//
// Left alone on purpose: spelling (its title already IS the rule statement),
// Spanish (the real practice is the dedicated daily audio lesson, not text
// here — and the exact vocab is Flip Flop's paid curriculum, not something
// to invent), math (drill banks — the real practice is the in-app Math
// Sprint, not a sentence to recite).
//
// Matched by exact title within a track — several titles are intentionally
// identical between Luke/Layla's (t3) and Logan's grammar lists (e.g. "The 8
// parts of speech"), and the content really is the same for both, so one
// update fills every doc that shares that title. NEVER overwrites text Abi
// already wrote by hand.
// Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/seed-memory-content.js

import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'wireman-homeschool' });
const db = admin.firestore();

const HISTORY = {
  '313 — Edict of Milan': 'Emperor Constantine legalizes Christianity throughout the Roman Empire, ending centuries of persecution.',
  '410 — Alaric sacks Rome': 'The Visigoth king Alaric captures and sacks the city of Rome — the first time in 800 years an enemy had taken it.',
  '451 — Council of Chalcedon': 'Church leaders meet to define that Christ is fully God and fully man in one person.',
  '476 — Fall of the Western Roman Empire': 'The Germanic chieftain Odoacer deposes the last Roman emperor, Romulus Augustulus, ending the Western Empire.',
  '527-565 — Justinian; 529 Rule of St. Benedict': 'Byzantine emperor Justinian codifies Roman law and builds the Hagia Sophia, while Benedict writes the Rule that shapes Western monasticism.',
  '622 — The Hijra': "Muhammad and his followers migrate from Mecca to Medina — the event that starts the Islamic calendar.",
  '637 — Muslim capture of Jerusalem': 'Arab Muslim armies conquer Jerusalem, ending centuries of Byzantine Christian rule there.',
  '711 — Moors invade Spain': 'Muslim Moors cross from North Africa and conquer most of the Iberian Peninsula.',
  '732 — Battle of Tours': 'Charles Martel and the Franks defeat an invading Muslim army, halting their advance into Western Europe.',
  '800 — Charlemagne crowned Emperor': "Pope Leo III crowns Charlemagne 'Emperor of the Romans' on Christmas Day, reviving the idea of a Christian empire in the West.",
  '793 — Vikings raid Lindisfarne': 'Norse raiders attack the monastery of Lindisfarne in England — the traditional start of the Viking Age.',
  '871-899 — Alfred the Great': 'The Anglo-Saxon king of Wessex defends England from the Vikings and promotes learning and law.',
  '962 — Otto I; Holy Roman Empire': 'Pope John XII crowns Otto I emperor, founding what becomes the Holy Roman Empire.',
  '1054 — The Great Schism (East/West)': 'The Christian church splits into the Roman Catholic (West) and Eastern Orthodox (East) churches.',
  '1066 — Battle of Hastings': 'William the Conqueror of Normandy defeats King Harold of England, beginning Norman rule of England.',
  '1095 — Urban II calls the First Crusade': 'Pope Urban II calls Christian knights to march east and reclaim the Holy Land.',
  '1099 — Crusaders take Jerusalem': 'Crusader armies capture Jerusalem, ending the First Crusade.',
  '1170 — Murder of Thomas Becket': 'Knights of King Henry II kill Archbishop Thomas Becket in Canterbury Cathedral over a conflict between church and king.',
  '1187 — Saladin retakes Jerusalem': 'The Muslim sultan Saladin recaptures Jerusalem from the Crusaders.',
  '1215 — Magna Carta': 'English nobles force King John to sign the Magna Carta, limiting royal power and protecting basic rights.',
  '1271-1295 — Marco Polo': 'The Venetian merchant travels the Silk Road to China and later writes about his journeys, sparking European interest in Asia.',
  "1337-1453 — Hundred Years' War": 'England and France fight on and off for over a century over the French throne.',
  '1347-1351 — The Black Death': 'Bubonic plague sweeps through Europe, killing roughly a third of the population.',
  '1378-1417 — Great Schism of the West': 'Rival popes in Rome and Avignon each claim to be the true pope, dividing the Catholic Church.',
  "1382 — Wycliffe's English Bible": 'John Wycliffe and his followers produce the first full English translation of the Bible.',
  '1415 — Jan Hus burned; Agincourt': "Reformer Jan Hus is burned at the stake for heresy, while England's Henry V wins a stunning victory over France at Agincourt.",
  '1429 — Joan of Arc at Orléans': 'The teenage peasant girl Joan of Arc leads French troops to lift the siege of Orléans, turning the tide of the Hundred Years\' War.',
  '1453 — Fall of Constantinople; 1455 Gutenberg Bible': 'The Ottoman Turks capture Constantinople, ending the Byzantine Empire, while Gutenberg prints the first Bible on a movable-type press.',
  '1492 — Granada falls; Columbus sails': 'Spain conquers the last Muslim kingdom of Granada and sends Columbus west across the Atlantic — both in the same year.',
  "1517 — Luther's 95 Theses": 'Martin Luther nails his 95 Theses to the Wittenberg church door, sparking the Protestant Reformation.',
};

const GRAMMAR_T3 = {
  'The 8 parts of speech': 'Noun, pronoun, verb, adjective, adverb, preposition, conjunction, interjection.',
  'Preposition list (chant it)': 'About, above, across, after, against, along, among, around, at, before, behind, below, beneath, beside, between, beyond, but, by, down, during, except, for, from, in, inside, into, like, near, of, off, on, out, outside, over, past, since, through, throughout, to, toward, under, underneath, until, up, upon, with, within, without.',
  'The 23 helping verbs': 'Am, is, are, was, were, be, being, been, have, has, had, do, does, did, shall, will, should, would, may, might, must, can, could.',
  'Linking verbs; subject vs. predicate': 'A linking verb (is, seems, feels, becomes) connects the subject to a word that renames or describes it, instead of showing action. The subject is who/what the sentence is about; the predicate tells what the subject does or is.',
  'Clause vs. phrase': 'A clause has both a subject and a verb; a phrase is a group of related words with no subject-verb pair.',
  'Noun jobs: subject, DO, IO, predicate nominative, object of preposition, appositive': 'Subject (does the action), direct object (receives the action), indirect object (receives the direct object), predicate nominative (renames the subject after a linking verb), object of the preposition, appositive (renames a nearby noun).',
  'Pronoun cases': 'Subjective (I, you, he, she, it, we, they, who) does the action; objective (me, you, him, her, it, us, them, whom) receives the action; possessive (my/mine, your/yours, his, her/hers, its, our/ours, their/theirs) shows ownership.',
  'The who/whom rule': 'Use who if you could answer with he/she/they (subjective); use whom if you could answer with him/her/them (objective).',
  'IEW dress-ups, all 5': '-ly adverb, who/which clause, strong verb, quality adjective, www.asia.b (a because/since/although clause opener).',
  'The six verb tenses': 'Simple present, simple past, simple future, present perfect, past perfect, future perfect.',
  'Active vs. passive voice': 'Active: the subject does the action (The dog bit the man). Passive: the subject receives the action (The man was bitten by the dog).',
  'Gerund + its noun jobs': 'A gerund is an -ing verb form used as a noun; it can be a subject, direct object, object of a preposition, or predicate nominative.',
  'Participle & participial phrase': 'A participle is a verb form (usually -ing or -ed) used as an adjective; a participial phrase is the participle plus the words that complete its thought, describing a noun.',
  'Infinitive & infinitive phrase': "An infinitive is 'to' plus a verb (to run); an infinitive phrase is the infinitive plus its modifiers/objects, used as a noun, adjective, or adverb.",
  'Verbals: telling all three apart': 'Gerund (-ing used as a NOUN), participle (verb form used as an ADJECTIVE), infinitive (to + verb, used as noun/adjective/adverb).',
  'IEW openers, all 7': '#1 subject, #2 -ly adverb, #3 -ing verb (participle), #4 clausal (www.asia.b), #5 VSS (very short sentence), #6 preposition, #7 adverbial clause (after, before, since, until, while...).',
  'Adjective clauses + relative pronouns': 'An adjective clause modifies a noun and starts with a relative pronoun: who, whom, whose, which, or that.',
  'Adverb clauses + subordinating conjunctions': 'An adverb clause modifies a verb, adjective, or adverb and starts with a subordinating conjunction: although, because, since, while, if, when, unless, until, after, before...',
  'Noun clauses and their six jobs': 'A noun clause acts as a noun and can be a subject, direct object, indirect object, predicate nominative, object of a preposition, or appositive.',
  'FANBOYS + the MC, cc MC comma rule': 'For, and, nor, but, or, yet, so — the coordinating conjunctions. Put a comma before FANBOYS when joining two main clauses (MC, cc MC).',
  'Comma rules: series, opener, MC cc MC, interrupter': 'Use commas: between items in a series, after an introductory opener, before a FANBOYS joining two main clauses, and around an interrupter.',
  'Quotation marks & dialogue punctuation': 'Put commas and periods inside closing quotation marks; start a new paragraph each time the speaker changes.',
  'Semicolon & colon rules': 'A semicolon joins two related main clauses without a conjunction; a colon introduces a list, explanation, or quotation after a complete sentence.',
  'Apostrophe rules': "Use an apostrophe + s for singular possessive (dog's), just an apostrophe for plural possessive ending in s (dogs'), and apostrophe + s for irregular plurals (children's).",
  'Essential vs. nonessential (that vs. which)': "Essential (restrictive) clauses use 'that' and no commas — they're needed to identify the noun. Nonessential (nonrestrictive) clauses use 'which' and are set off by commas — they just add extra info.",
  'Sentence structures: simple, compound, complex, compound-complex': 'Simple: one main clause. Compound: two+ main clauses joined by FANBOYS or a semicolon. Complex: a main clause plus a subordinate clause. Compound-complex: two+ main clauses plus at least one subordinate clause.',
  'Commonly confused words, set A': "Their/there/they're · your/you're · its/it's · to/too/two · then/than.",
  'Commonly confused words, set B': "Affect/effect · accept/except · who's/whose · lose/loose · principal/principle.",
  'Capitalization rules': 'Capitalize the first word of a sentence, proper nouns (names, places, titles), the pronoun I, and the first word of a direct quotation.',
  'Sentence structures': 'Simple, compound, complex, compound-complex.', // safety net if a variant title exists
  'IEW decorations: alliteration, question, conversation, 3sss, dramatic open-close': 'Alliteration (repeated starting sounds), a question, a snippet of conversation, 3sss (three short staccato sentences), and a dramatic opener/closer.',
};

const GRAMMAR_LOGAN = {
  'Noun and verb defined': 'A noun names a person, place, thing, or idea. A verb shows action or a state of being.',
  'What a sentence must have': 'A complete sentence needs a subject (who/what it\'s about) and a predicate (what the subject does or is).',
  'Common vs. proper nouns': 'A common noun names a general person, place, or thing (city); a proper noun names a specific one and is capitalized (Chicago).',
  'Articles': "A, an, and the — the words that point to a noun. Use 'a' before a consonant sound, 'an' before a vowel sound.",
  'Linking verbs': 'A linking verb connects the subject to a word that renames or describes it, instead of showing action — like is, are, was, seems, feels, becomes.',
  'Adjective and adverb defined': 'An adjective describes a noun (the red ball). An adverb describes a verb, adjective, or another adverb, often ending in -ly (ran quickly).',
  'Subject and predicate': 'The subject is who or what the sentence is about; the predicate tells what the subject does or is.',
  'IEW dress-ups: -ly adverb, strong verb, quality adjective': 'Add an -ly adverb, swap in a strong (vivid) verb, and add a quality adjective to make sentences more interesting.',
  'The preposition list (chant it)': 'About, above, across, after, against, along, among, around, at, before, behind, below, beneath, beside, between, beyond, but, by, down, during, except, for, from, in, inside, into, like, near, of, off, on, out, outside, over, past, since, through, throughout, to, toward, under, underneath, until, up, upon, with, within, without.',
  'Prepositional phrase': "A preposition plus its object (and any describing words) — like 'under the old bridge.'",
  'Pronouns and what they replace': 'A pronoun takes the place of a noun — like he, she, it, they, we, this, that.',
  'Conjunctions': 'Words that join words, phrases, or clauses together — like and, but, or, so, because.',
  'Interjections': 'A word or short phrase that shows strong feeling, usually followed by an exclamation point — like Wow! or Ouch!',
  'Comma in a series': 'Use commas to separate three or more items in a list — like apples, bananas, and grapes.',
  'Comma with a name being addressed': "Use a comma to set off a name when speaking directly to someone — like 'Logan, please come here.'",
  'Comma after an opener': "Use a comma after an introductory word or phrase that starts a sentence — like 'After lunch, we went outside.'",
  'Quotation marks in dialogue': "Put quotation marks around a speaker's exact words, and commas/periods inside the closing quotation mark.",
  'Simple vs. compound sentence': 'A simple sentence has one main clause. A compound sentence joins two main clauses with a comma and FANBOYS (and, but, or...) or a semicolon.',
  'FANBOYS': 'For, and, nor, but, or, yet, so — the coordinating conjunctions that join two main clauses.',
  'Complex sentence': "A complex sentence joins a main clause with a subordinate (dependent) clause — like 'Because it rained, we stayed inside.'",
  'IEW dress-ups: who/which clause, www.asia.b clause': 'A who/which clause adds extra info about a noun; a www.asia.b clause starts with while, when, as, since, if, although, or because.',
  'IEW openers #1-#6': '#1 subject, #2 -ly adverb, #3 -ing verb, #4 clausal (www.asia.b), #5 VSS (very short sentence), #6 preposition.',
  'End-mark punctuation': 'A period ends a statement, a question mark ends a question, and an exclamation point ends a sentence showing strong feeling.',
  "Apostrophes: possessive and contraction": "Use an apostrophe to show ownership (Logan's book) or to join two words into one, replacing missing letters (don't = do not).",
  "their/there/they're · your/you're · its/it's": "Their = ownership, there = place, they're = they are. Your = ownership, you're = you are. Its = ownership, it's = it is.",
  'Grand review': 'Review your favorite grammar rule from this year and be ready to explain it in your own words.',
};

const SCIENCE_T3 = {
  'The scientific method, in steps': 'Ask a question, do background research, form a hypothesis, test it with an experiment, analyze the data, draw a conclusion, and report the results.',
  "Astronomers' tools: refracting vs. reflecting telescope, radio telescope, spectroscope": 'A refracting telescope uses lenses to bend light; a reflecting telescope uses mirrors. A radio telescope detects radio waves from space. A spectroscope splits light into its spectrum to reveal what an object is made of.',
  'Ptolemy, Copernicus, Brahe, Kepler, Galileo, Newton — who did what': 'Ptolemy taught an Earth-centered universe. Copernicus proposed a sun-centered one. Brahe made precise observations. Kepler discovered planets move in ellipses. Galileo used the telescope to support the sun-centered model. Newton explained gravity holds it all together.',
  'Units of space: AU, light-year, parsec': 'An AU (astronomical unit) is the Earth-Sun distance. A light-year is the distance light travels in one year. A parsec is about 3.26 light-years.',
  'Galaxy types: spiral, barred spiral, elliptical, irregular': 'Spiral galaxies have curved arms; barred spirals have a straight bar through the center; elliptical galaxies are oval-shaped with no arms; irregular galaxies have no defined shape.',
  'The sun: core, radiative zone, convective zone, photosphere, chromosphere, corona': 'From the center out: the core (fusion happens here), radiative zone, convective zone, photosphere (visible surface), chromosphere, and corona (outer atmosphere).',
  'Planets in order + terrestrial / gas giant / ice giant / dwarf': 'Mercury, Venus, Earth, Mars (terrestrial/rocky); Jupiter, Saturn (gas giants); Uranus, Neptune (ice giants); Pluto and others (dwarf planets).',
  'Inner planets — one distinguishing fact each': 'Mercury: closest to the sun, no atmosphere. Venus: hottest planet, thick toxic atmosphere. Earth: only known planet with life. Mars: the "Red Planet," has the largest volcano in the solar system.',
  'Outer planets — one distinguishing fact each': 'Jupiter: largest planet, Great Red Spot storm. Saturn: famous ring system. Uranus: rotates on its side. Neptune: strongest winds in the solar system.',
  'Asteroids, comets, meteoroid → meteor → meteorite': "Asteroids are rocky bodies mostly between Mars and Jupiter. Comets are icy bodies that grow a tail near the sun. A meteoroid is a space rock; it becomes a meteor ('shooting star') burning up in our atmosphere, and a meteorite if it lands on Earth.",
  'Rotation vs. revolution; solstice, equinox; why we have seasons': "Rotation is Earth spinning on its axis (day/night); revolution is Earth orbiting the sun (a year). Solstices are the longest/shortest days; equinoxes have equal day and night. Seasons happen because Earth's axis is tilted.",
  'The 8 moon phases': 'New moon, waxing crescent, first quarter, waxing gibbous, full moon, waning gibbous, last quarter, waning crescent.',
  'Eclipse geometry; umbra and penumbra': 'A solar eclipse happens when the moon passes between the sun and Earth; a lunar eclipse when Earth is between the sun and moon. The umbra is the dark inner shadow; the penumbra is the lighter outer shadow.',
  'Star classification O B A F G K M': 'From hottest/bluest to coolest/reddest: O, B, A, F, G, K, M (our sun is a G star).',
  'Star life cycle: nebula → main sequence → giant → white dwarf / neutron star / black hole': 'A star forms from a nebula, spends most of its life on the main sequence, expands into a giant, then ends as a white dwarf (small stars), neutron star, or black hole (massive stars).',
  'Latitude & longitude; prime meridian, equator, tropics, polar circles': "Latitude lines run east-west and measure distance from the equator; longitude lines run north-south and measure distance from the prime meridian. The tropics and polar circles mark where the sun's rays hit most/least directly.",
  'Map types; contour lines, scale, legend': 'A political map shows borders; a physical map shows landforms; a topographic map uses contour lines to show elevation. Scale shows real-world distance; a legend explains the symbols.',
  'Layers of the Earth + the Moho': 'Crust, mantle, outer core, inner core. The Moho (Mohorovičić discontinuity) is the boundary between the crust and mantle.',
  'Plate boundaries + the evidence for each': 'Divergent (plates pull apart, e.g. mid-ocean ridges), convergent (plates collide, e.g. mountains/subduction), and transform (plates slide past each other, e.g. the San Andreas Fault).',
  'Earthquakes: focus, epicenter, P/S/surface waves; moment magnitude': 'The focus is where the quake starts underground; the epicenter is the point on the surface directly above it. P waves arrive first (fastest), then S waves, then surface waves (most damage). Moment magnitude measures the energy released.',
  'Three rock types + the rock cycle': 'Igneous (cooled magma/lava), sedimentary (compressed layers of sediment), and metamorphic (changed by heat and pressure) — each can transform into the others over time in the rock cycle.',
  'Mohs hardness scale 1-10': 'Talc (1) is softest, diamond (10) is hardest; each mineral can scratch anything softer than itself.',
  'Mineral ID: luster, streak, cleavage, hardness, specific gravity': 'Luster (how it reflects light), streak (color of its powder), cleavage (how it breaks along flat planes), hardness (Mohs scale), and specific gravity (density compared to water) all help identify a mineral.',
  'Volcano types + lava viscosity': 'Shield volcanoes (wide, gentle slopes, runny lava), composite/stratovolcanoes (steep, explosive, thick lava), and cinder cones (small, steep, built from ash and cinders).',
  'Weathering vs. erosion; soil horizons O A E B C R': 'Weathering breaks rock down in place; erosion moves the broken pieces away. Soil horizons top to bottom: O (organic), A (topsoil), E (leached), B (subsoil), C (weathered rock), R (bedrock).',
  'Layers of the atmosphere + composition (78% N, 21% O, 1% other)': 'Troposphere, stratosphere, mesosphere, thermosphere, exosphere (bottom to top). Air is about 78% nitrogen, 21% oxygen, and 1% other gases.',
  'Cloud types + combinations': 'Cirrus (high, wispy), cumulus (puffy), stratus (flat layers), nimbus (rain-bearing) — combined for types like cumulonimbus (storm clouds) or stratocumulus.',
  'The water cycle, all six steps': 'Evaporation, condensation, precipitation, collection, infiltration, and transpiration.',
  'Air masses + fronts': 'An air mass is a large body of air with similar temperature/humidity. A front is where two different air masses meet — cold, warm, occluded, or stationary.',
  'Ocean floor: shelf, slope, abyssal plain, trench, ridge; currents & tides': "From shore outward: continental shelf, continental slope, abyssal plain (deep flat floor), trenches (deepest points), and mid-ocean ridges. Currents are driven by wind and temperature; tides by the moon's (and sun's) gravity.",
};

const SCIENCE_GRAMMAR_STAGE = {
  'The 8 planets in order': 'Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.',
  'Sun, moon, star, planet — define each · the phases of the moon': 'The sun is a star (makes its own light); the moon is a rocky body orbiting Earth (reflects sunlight); a planet orbits a star and reflects light. Moon phases: new, waxing crescent, first quarter, waxing gibbous, full, waning gibbous, last quarter, waning crescent.',
  'Day, month, year — what causes each': 'A day is Earth spinning once on its axis. A month is roughly how long the moon takes to orbit Earth. A year is Earth orbiting the sun once.',
  'Inner vs. outer planets · what a comet is made of': "Inner planets (Mercury, Venus, Earth, Mars) are small and rocky; outer planets (Jupiter, Saturn, Uranus, Neptune) are large and gassy. A comet is a 'dirty snowball' of ice, dust, and rock.",
  'The four seasons and why we have them': "Spring, summer, fall, winter — caused by Earth's tilted axis as it orbits the sun.",
  'The 8 moon phases in order · solar vs. lunar eclipse': 'New, waxing crescent, first quarter, waxing gibbous, full, waning gibbous, last quarter, waning crescent. A solar eclipse is the moon blocking the sun; a lunar eclipse is Earth\'s shadow on the moon.',
  'The four layers of the Earth': 'Crust, mantle, outer core, inner core.',
  'Equator, prime meridian, the 7 continents and 5 oceans · map legend and scale': 'The equator circles the Earth\'s middle; the prime meridian runs pole to pole through Greenwich. 7 continents: Africa, Antarctica, Asia, Australia, Europe, North America, South America. 5 oceans: Pacific, Atlantic, Indian, Southern, Arctic.',
  'The three rock types': 'Igneous, sedimentary, metamorphic.',
  'The rock cycle in order · Mohs scale, hardest and softest': 'Rocks change from one type to another through heat, pressure, weathering, and erosion — the rock cycle. On the Mohs scale, talc is softest (1) and diamond is hardest (10).',
  'The water cycle, four steps': 'Evaporation, condensation, precipitation, collection.',
  'Cloud types: cirrus, cumulus, stratus, nimbus · what makes wind': 'Cirrus (high, wispy), cumulus (puffy), stratus (flat layers), nimbus (rain clouds). Wind is caused by air moving from high pressure to low pressure.',
};

async function fillTrack(track, contentByTitle) {
  const snap = await db.collection('memoryItems').where('track', '==', track).get();
  let set = 0;
  let kept = 0;
  let unmatched = 0;
  const seenTitles = new Set(Object.keys(contentByTitle));
  for (const doc of snap.docs) {
    const it = doc.data();
    const text = contentByTitle[it.title];
    if (text === undefined) continue; // title not in this batch (e.g. spelling/standing items) — leave alone
    seenTitles.delete(it.title);
    if (it.text && it.text.trim()) { kept++; continue; } // Abi's own wording wins, always
    await doc.ref.update({ text, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    set++;
  }
  if (seenTitles.size) console.warn(`  ! ${track}: no matching doc for: ${[...seenTitles].join(' | ')}`);
  console.log(`${track}: filled ${set}, left alone (Abi already wrote them) ${kept}, unmatched titles ${unmatched || seenTitles.size}`);
}

async function main() {
  await fillTrack('history', HISTORY);
  await fillTrack('grammar', { ...GRAMMAR_T3, ...GRAMMAR_LOGAN });
  await fillTrack('science', { ...SCIENCE_T3, ...SCIENCE_GRAMMAR_STAGE });
}

main().catch((e) => { console.error(e); process.exit(1); });
