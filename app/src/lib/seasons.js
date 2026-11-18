// A different seasonal look every school week. The skin is picked from the
// date alone (no stored state), so every kid sees the same week together and
// nothing needs scheduling: four different Christmas weeks in December, a
// Thanksgiving week, Easter week, and so on through the year.
//
// A skin is just a name, a few emoji that drift through the page background,
// how they move, and a one-line greeting.

const skin = (name, icon, bits, motion, line) => ({ name, icon, bits, motion, line });

// Five looks per month, indexed by which week of the month it is.
const MONTHS = {
  0: [ // January
    skin('Snow Day', '❄️', ['❄️', '❄️', '🌨️', '❄️'], 'fall', 'Fresh snow, fresh start.'),
    skin('Snowman Builders', '⛄', ['⛄', '❄️', '🥕', '🧣'], 'fall', 'Do you want to build a snowman?'),
    skin('Penguin Parade', '🐧', ['🐧', '🧊', '❄️', '🐟'], 'drift', 'Waddle on through the list!'),
    skin('Cocoa & Mittens', '☕', ['☕', '🧤', '🍪', '🧣'], 'rise', 'Warm drink, warm brain.'),
    skin('Northern Lights', '🌌', ['✨', '🌠', '⭐', '💫'], 'twinkle', 'Bright lights, long nights.'),
  ],
  1: [ // February
    skin('Polar Pals', '🐻‍❄️', ['🐻‍❄️', '❄️', '🦭', '🧊'], 'drift', 'Stay frosty!'),
    skin('Hearts Week', '💌', ['💌', '❤️', '💛', '💙'], 'rise', 'Love one another. (John 13:34)'),
    skin('Winter Games', '⛸️', ['⛸️', '🏒', '🎿', '🥇'], 'drift', 'Go for gold today.'),
    skin("Presidents' Week", '🎩', ['🎩', '⭐', '🇺🇸', '🪙'], 'fall', 'Honest work, like Abe.'),
    skin('Last Flurries', '🌨️', ['🌨️', '❄️', '💨', '❄️'], 'fall', 'Winter is almost done!'),
  ],
  2: [ // March
    skin('Kite Weather', '🪁', ['🪁', '☁️', '💨', '🪁'], 'drift', 'March winds — hold on tight!'),
    skin('Puddle Jumpers', '☔', ['💧', '☔', '🐸', '💧'], 'fall', 'Splash through it!'),
    skin('Lucky Clovers', '☘️', ['☘️', '🍀', '🌈', '☘️'], 'fall', 'Good work beats good luck.'),
    skin('First Sprouts', '🌱', ['🌱', '🐛', '🌿', '🌱'], 'rise', 'Little by little, things grow.'),
    skin('Robin Season', '🐦', ['🐦', '🪺', '🌿', '🪶'], 'drift', 'The birds are back!'),
  ],
  3: [ // April
    skin('Tulip Time', '🌷', ['🌷', '🌷', '🌼', '🍃'], 'rise', 'Everything is blooming.'),
    skin('Butterfly Garden', '🦋', ['🦋', '🌸', '🦋', '🌼'], 'rise', 'Float through your list.'),
    skin('April Showers', '🌈', ['💧', '🌈', '☁️', '💧'], 'fall', 'Showers now, flowers soon.'),
    skin('Opening Day', '⚾', ['⚾', '🧢', '🥜', '⚾'], 'drift', 'Play ball!'),
    skin('Busy Bees', '🐝', ['🐝', '🌻', '🍯', '🐝'], 'drift', 'Be a busy bee today.'),
  ],
  4: [ // May
    skin('Blossoms', '🌸', ['🌸', '🌸', '🍃', '🌸'], 'fall', 'Petals everywhere!'),
    skin('Garden Bugs', '🐞', ['🐞', '🐛', '🌿', '🐌'], 'drift', 'Slow and steady, like the snail.'),
    skin("Gone Fishin'", '🎣', ['🐟', '🎣', '🫧', '🐠'], 'rise', 'Reel in a great day.'),
    skin('Lemonade Stand', '🍋', ['🍋', '🧊', '🥤', '☀️'], 'rise', 'Squeeze the day!'),
    skin('Almost Summer', '☀️', ['☀️', '🍉', '🕶️', '🩴'], 'rise', 'The finish line is in sight!'),
  ],
  5: [ // June
    skin('Last Lap', '🏁', ['🏁', '🎉', '⭐', '🎈'], 'rise', 'Finish strong!'),
    skin("Summer's Here", '🏖️', ['🏖️', '🌊', '🐚', '☀️'], 'drift', 'School is nearly out!'),
    skin('Ice Cream Week', '🍦', ['🍦', '🍧', '🍒', '🍨'], 'fall', 'Sweet work, sweet reward.'),
    skin('Firefly Nights', '✨', ['✨', '🌙', '✨', '💫'], 'twinkle', 'Glow on.'),
    skin('Campfire', '🏕️', ['🏕️', '🔥', '🌲', '⭐'], 'twinkle', 'Adventure season.'),
  ],
  6: [ // July
    skin('Fireworks', '🎆', ['🎆', '🎇', '⭐', '🇺🇸'], 'twinkle', 'Happy Independence Day!'),
    skin('Lake Days', '🛶', ['🛶', '🐟', '🌊', '☀️'], 'drift', 'Paddle on.'),
    skin('Watermelon Week', '🍉', ['🍉', '🍓', '🍋', '🍉'], 'fall', 'Sweet summer.'),
    skin('Stargazing', '🔭', ['⭐', '🌠', '🪐', '✨'], 'twinkle', 'Look up!'),
    skin('Sunflowers', '🌻', ['🌻', '🐝', '☀️', '🌻'], 'rise', 'Face the sun.'),
  ],
  7: [ // August
    skin('Dog Days', '🐕', ['🐕', '🦴', '☀️', '🐾'], 'drift', 'Hot days, cool heads.'),
    skin('Back to School', '✏️', ['✏️', '📚', '🍎', '📐'], 'fall', 'A brand-new year!'),
    skin('Sharp Pencils', '📓', ['📓', '✏️', '🖍️', '📏'], 'fall', 'Fresh notebooks, fresh start.'),
    skin('County Fair', '🎡', ['🎡', '🐄', '🌽', '🎟️'], 'drift', 'Blue-ribbon work today.'),
    skin('Late Summer Sun', '🌞', ['🌞', '🌻', '🦗', '🌾'], 'rise', 'Soak it up.'),
  ],
  8: [ // September
    skin('Apple Picking', '🍎', ['🍎', '🍏', '🧺', '🍎'], 'fall', 'An apple for the teacher!'),
    skin('Football Season', '🏈', ['🏈', '🏟️', '📣', '🏈'], 'drift', "It's game day."),
    skin('Sunflower Fields', '🌻', ['🌻', '🐝', '🌾', '🌻'], 'rise', 'Stand tall.'),
    skin('First Leaves', '🍂', ['🍂', '🍃', '🍂', '🌰'], 'fall', 'Fall is tiptoeing in.'),
    skin('Harvest Moon', '🌕', ['🌕', '🌾', '⭐', '🦉'], 'twinkle', 'Big moon, big week.'),
  ],
  9: [ // October
    skin('Fall Colors', '🍁', ['🍁', '🍂', '🍁', '🍃'], 'fall', 'The trees are showing off.'),
    skin('Pumpkin Patch', '🎃', ['🎃', '🍂', '🌾', '🎃'], 'fall', 'Pick of the patch!'),
    skin('Cider Mill', '🍩', ['🍩', '🍎', '🧃', '🍂'], 'fall', 'Cider and donuts weather.'),
    skin('Night Owls', '🦉', ['🦉', '🌙', '⭐', '🍂'], 'twinkle', 'Wise owls finish their work.'),
    skin('Harvest Home', '🌽', ['🌽', '🌾', '🚜', '🍂'], 'fall', 'Bring in the harvest.'),
  ],
  10: [ // November
    skin('Leaf Piles', '🍂', ['🍂', '🍁', '🍂', '🍃'], 'fall', 'Jump in!'),
    skin('Acorn Season', '🌰', ['🌰', '🐿️', '🍂', '🌰'], 'fall', 'Squirrel away some knowledge.'),
    skin('Sweater Weather', '🧣', ['🧣', '🍵', '🍂', '🧦'], 'fall', 'Cozy up and get to it.'),
    skin('Give Thanks', '🦃', ['🦃', '🌽', '🥧', '🍂'], 'fall', 'O give thanks unto the LORD. (Ps. 107:1)'),
    skin('Pie Week', '🥧', ['🥧', '🍎', '🎃', '🥧'], 'fall', 'Save room for pie.'),
  ],
  11: [ // December — four different Christmas weeks, then the New Year
    skin('First Snow', '❄️', ['❄️', '⛄', '❄️', '🌨️'], 'fall', 'Christmas is coming!'),
    skin('Gingerbread', '🍪', ['🍪', '🍬', '🥛', '🍭'], 'fall', 'Sweet week ahead.'),
    skin('Christmas Lights', '🎄', ['🎄', '🔔', '🎁', '🌟'], 'twinkle', 'Deck the halls!'),
    skin('Joy to the World', '⭐', ['⭐', '🐑', '👑', '🕊️'], 'twinkle', 'Unto you is born this day a Saviour. (Luke 2:11)'),
    skin('New Year', '🎆', ['🎆', '🎉', '🕛', '✨'], 'twinkle', 'Happy New Year!'),
  ],
};

const EASTER_WEEK = skin('Easter Week', '✝️', ['🌷', '🕊️', '✝️', '🌿'], 'rise', 'He is not here: for he is risen. (Matt. 28:6)');
const RISEN_WEEK = skin('He Is Risen', '🌅', ['🌅', '🐑', '🌷', '🦋'], 'rise', 'Rejoice — He is risen indeed!');
const VALENTINE = MONTHS[1][1];
const MEMORIAL = skin('Stars & Stripes', '🇺🇸', ['🇺🇸', '⭐', '🎗️', '⭐'], 'fall', 'Remember and give thanks.');

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Western Easter Sunday (anonymous Gregorian algorithm).
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function seasonFor(date = new Date()) {
  // Weeks run Monday–Sunday; a week belongs to the month its Thursday is in.
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const inWeek = (d) => iso(d) >= iso(monday) && iso(d) <= iso(sunday);

  const easter = easterSunday(thursday.getFullYear());
  const weekAfterEaster = new Date(easter);
  weekAfterEaster.setDate(easter.getDate() + 7);

  let chosen;
  if (inWeek(easter)) chosen = EASTER_WEEK;
  else if (inWeek(weekAfterEaster)) chosen = RISEN_WEEK;
  else if (inWeek(new Date(thursday.getFullYear(), 1, 14))) chosen = VALENTINE;
  else if (monday.getMonth() === 4 && monday.getDate() >= 25) chosen = MEMORIAL; // last Monday of May
  else chosen = MONTHS[thursday.getMonth()][Math.min(4, Math.floor((thursday.getDate() - 1) / 7))];

  return { ...chosen, weekOf: iso(monday) };
}
