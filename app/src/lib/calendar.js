// School-calendar math shared by the year-plan generator and the app.
// Every scheduled assignment carries a dayIndex (1-based school day of the
// year). Dates are DERIVED: dayIndex -> date via the calendar (school weekdays
// minus holidays minus blockouts). Adding a blockout never deletes anything —
// later dayIndexes simply map to later dates ("reflow").

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function inAnyRange(iso, ranges) {
  return ranges.some((r) => iso >= r.start && iso <= r.end);
}

// Returns the ordered list of school-day ISO dates for the whole year,
// honoring schoolDays (ISO weekday ints, Mon=1), holidays, and blockouts.
// Extends past schoolYearEnd if blockouts push the required day count later.
export function buildCalendar(family, minDays = 0) {
  const { schoolYearStart, schoolYearEnd, schoolDays, holidays = [], blockouts = [], extraDays = [] } = family;
  const out = [];
  const start = parseISO(schoolYearStart);
  const hardStop = parseISO(schoolYearEnd);
  hardStop.setDate(hardStop.getDate() + 120); // safety margin for reflow overruns
  const d = new Date(start);
  while (d <= hardStop) {
    const iso = toISO(d);
    const isoWeekday = ((d.getDay() + 6) % 7) + 1; // Mon=1..Sun=7
    if (
      (schoolDays.includes(isoWeekday) || extraDays.includes(iso)) &&
      !inAnyRange(iso, holidays) &&
      !inAnyRange(iso, blockouts)
    ) {
      out.push(iso);
    }
    if (out.length >= minDays && iso >= family.schoolYearEnd) break;
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// dayIndex (1-based) -> ISO date under the current calendar.
export function dateForDayIndex(calendar, dayIndex) {
  return calendar[dayIndex - 1] ?? null;
}

// Given the highest dayIndex in the plan, the projected finish date.
export function projectedEndDate(calendar, maxDayIndex) {
  return dateForDayIndex(calendar, maxDayIndex);
}
