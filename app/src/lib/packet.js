// Which PDF pages a day's item needs, by how each book is laid out. These
// are starting guesses the packet screen shows and lets Abi adjust — a wrong
// page is a wasted sheet, so nothing prints without being on screen first.

const PRINTABLE_TYPES = new Set(['worksheet', 'test', 'video']);

// PDF page each writing lesson starts on (lesson 1..30, then the page after).
const WRITING_STARTS = {
  'us-history-writing-student': [13, 19, 29, 35, 43, 53, 63, 73, 83, 91, 103, 111, 123, 133, 143, 151, 161, 177, 187, 199, 207, 217, 225, 233, 243, 253, 265, 271, 281, 287, 299],
  'frontiers-writing-student': [15, 23, 33, 39, 47, 53, 59, 67, 77, 85, 93, 103, 115, 121, 127, 135, 143, 149, 163, 169, 177, 185, 193, 201, 211, 221, 227, 237, 245, 253, 261],
};

export function isPrintable(a) {
  return PRINTABLE_TYPES.has(a.itemType) && /\.pdf#page=\d+/.test(a.contentPath ?? '');
}

// → { path, from, count, note } for a printable item
export function defaultPages(a) {
  const [path, anchor] = a.contentPath.split('#');
  const page = Number(anchor.match(/page=(\d+)/)[1]);
  const title = a.title ?? '';

  // Fix It! Grammar: a week is 2 "Learn It" pages, then one page per day.
  if (/fixit\d+-student/.test(path)) {
    const day = Number(title.match(/Day (\d)/)?.[1] ?? 1);
    return day === 1
      ? { path, from: page, count: 3, note: 'Learn It + Day 1' }
      : { path, from: page + 1 + day, count: 1, note: `Day ${day}` };
  }
  // Math-U-See workbooks: each lesson is seven 2-page sheets, A through G.
  if (/-workbook\.pdf$/.test(path)) {
    const sheet = /Practice A/.test(title) ? 0 : /Practice B/.test(title) ? 1 : /Practice C/.test(title) ? 2 : /Systematic Review/.test(title) ? 3 : 0;
    return { path, from: page + sheet * 2, count: 2, note: `sheet ${'ABCD'[sheet]}` };
  }
  if (/sotw\d-tests/.test(path)) return { path, from: page, count: 4, note: 'chapter test' };
  if (/-tests\.pdf$/.test(path)) return { path, from: page, count: 2, note: 'lesson test' };
  // IEW writing: print the whole lesson on its first day, nothing after.
  for (const [book, starts] of Object.entries(WRITING_STARTS)) {
    if (!path.includes(book)) continue;
    const i = starts.indexOf(page);
    const length = i >= 0 && i < starts.length - 1 ? starts[i + 1] - page : 8;
    const firstDay = /day 1 of 4/i.test(title) || !/day \d of 4/i.test(title);
    return { path, from: page, count: firstDay ? length : 0, note: firstDay ? 'whole lesson' : 'printed on day 1' };
  }
  return { path, from: page, count: 2, note: '' };
}
