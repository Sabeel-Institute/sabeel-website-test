/**
 * Program schedules. A schedule is a list of parts, each with a first day,
 * and optionally a time, a repeat rule in the iCalendar (RRULE) form that
 * calendar apps use, dates to skip, or a last day for one continuous
 * multi-day event. The content schema checks parts with `checkPart`; cards
 * and pages word them with `describeSchedule`.
 *
 * Days are calendar days held as UTC midnight, as `z.coerce.date()` reads
 * `YYYY-MM-DD`; times are Central wall-clock times, so no time-zone
 * arithmetic is needed to word them.
 */
import ICAL from 'ical.js';

export type SchedulePart = {
  start: Date;
  /** Last day of one continuous multi-day event. */
  end?: Date;
  time?: string;
  repeat?: string;
  skip?: Date[];
  venue?: { id: string };
  label?: string;
};

/* ---------- Times ---------- */

/** Minutes after midnight; `to` is earlier than `from` when the event runs past midnight. */
export type TimeRange = { from: number; to?: number };

const TIME = /^(\d{1,2}):(\d{2})(?: ?([AP]M))?(?: ?[–-] ?(\d{1,2}):(\d{2}) ?([AP]M))?$/;
const TIME_FORM = 'time is written like "12:00–1:30 PM", "10:00 AM–1:00 PM", or "6:00 PM", without "CT": the site adds it';

/**
 * A part's time, or the reason it cannot be read. `acrossDays` is for a
 * multi-day event, whose end time is on its last day.
 */
export function parseTime(text: string, acrossDays = false): TimeRange | string {
  const m = TIME.exec(text.trim());
  if (!m) return TIME_FORM;
  const [, h1, m1, ap1, h2, m2, ap2] = m;
  if (!ap1 && !h2) return TIME_FORM;
  const clock = (h: string, min: string, ap: string) => {
    const hour = Number(h);
    const minute = Number(min);
    if (hour < 1 || hour > 12 || minute > 59) return undefined;
    return ((hour % 12) + (ap === 'PM' ? 12 : 0)) * 60 + minute;
  };
  const to = h2 ? clock(h2, m2!, ap2!) : undefined;
  const from = clock(h1!, m1!, ap1 ?? ap2!);
  if (from === undefined || (h2 && to === undefined)) return TIME_FORM;
  if (to !== undefined && !ap1 && from > to) {
    return `write AM or PM after the start time too, e.g. "${h1}:${m1} AM–${h2}:${m2} ${ap2}"`;
  }
  if (from === to) return 'time starts and ends at the same minute';
  // Only an evening event runs past midnight; any other end before the start is an AM/PM slip.
  if (to !== undefined && to < from && !acrossDays && !(ap1 === 'PM' && ap2 === 'AM')) return 'time ends before it starts';
  return { from, to };
}

function clock(minutes: number): { text: string; ap: 'AM' | 'PM' } {
  const h = Math.floor(minutes / 60) % 24;
  return { text: `${h % 12 || 12}:${String(minutes % 60).padStart(2, '0')}`, ap: h < 12 ? 'AM' : 'PM' };
}

/** "12:00–1:30 PM CT", "10:00 AM–1:00 PM CT", "11:45 PM–1:00 AM CT", "6:00 PM CT". */
export function formatTime(t: TimeRange): string {
  const a = clock(t.from);
  if (t.to === undefined) return `${a.text} ${a.ap} CT`;
  const b = clock(t.to);
  return a.ap === b.ap && t.to > t.from ? `${a.text}–${b.text} ${b.ap} CT` : `${a.text} ${a.ap}–${b.text} ${b.ap} CT`;
}

/* ---------- Repeat rules ---------- */

/** The rule parts Sabeel schedules use; ical.js silently drops parts it does not know. */
const RULE_PARTS = ['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY'];
const RULE_FREQS = ['DAILY', 'WEEKLY', 'MONTHLY'];
/** Enough for any finite schedule, so expanding a mistyped COUNT cannot run away. */
const MAX_SESSIONS = 500;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fromIcal = (t: ICAL.Time) => new Date(`${t.toString().slice(0, 10)}T00:00:00Z`);

/** The reason a repeat rule is not usable, if it is not. */
function ruleProblem(rule: string): string | undefined {
  if (/\s/.test(rule)) return 'repeat is written without spaces, e.g. FREQ=WEEKLY;BYDAY=MO;COUNT=7';
  const pairs = rule.split(';').map((p) => p.split('='));
  if (pairs.some((p) => p.length !== 2 || !p[0] || !p[1])) return 'repeat is parts like FREQ=WEEKLY joined by ";", with no ";" at the end';
  const keys = pairs.map((p) => p[0]!);
  const value = (key: string) => pairs.find((p) => p[0] === key)?.[1];
  const unknown = keys.filter((k) => !RULE_PARTS.includes(k));
  if (unknown.length) return `repeat uses ${unknown.join(', ')}; a Sabeel schedule's rule uses only ${RULE_PARTS.join(', ')}`;
  if (new Set(keys).size !== keys.length) return 'repeat names a rule part twice';
  if (!keys.includes('FREQ')) return 'repeat needs FREQ, e.g. FREQ=WEEKLY;BYDAY=MO;COUNT=7';
  if (keys.includes('COUNT') && keys.includes('UNTIL')) return 'repeat has COUNT or UNTIL, not both';
  for (const key of ['COUNT', 'INTERVAL']) {
    const n = value(key);
    if (n !== undefined && !/^[1-9]\d*$/.test(n)) return `${key} is a whole number from 1 up`;
  }
  const until = value('UNTIL');
  if (until !== undefined) {
    const d = new Date(`${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6)}T00:00:00Z`);
    if (!/^\d{8}$/.test(until) || Number.isNaN(+d) || iso(d).replaceAll('-', '') !== until) {
      return 'UNTIL is the last date as YYYYMMDD, e.g. UNTIL=20261124';
    }
  }
  let recur: ICAL.Recur;
  try {
    recur = ICAL.Recur.fromString(rule);
  } catch (e) {
    return `repeat is not a valid rule: ${(e as Error).message}`;
  }
  if (!RULE_FREQS.includes(recur.freq)) return `repeat's FREQ is ${RULE_FREQS.join(', ')}`;
  const byday: string[] = recur.parts.BYDAY ?? [];
  if (recur.freq !== 'MONTHLY' && (keys.includes('BYMONTHDAY') || byday.some((d) => /\d/.test(d)))) {
    return 'only a MONTHLY rule names days of the month (BYMONTHDAY=15) or weeks of it (BYDAY=-1WE)';
  }
  if (recur.freq === 'DAILY' && byday.length) return 'a rule for some weekdays is WEEKLY, e.g. FREQ=WEEKLY;BYDAY=MO,WE';
  return undefined;
}

/* ---------- Expanding parts ---------- */

type Expanded = {
  part: SchedulePart;
  kind: 'single' | 'span' | 'repeat';
  /** Session days; only the first when the rule has no end. */
  dates: Date[];
  /** Last day; undefined when the rule has no end. */
  last?: Date;
  /** Days or sessions it counts for. */
  count: number;
  recur?: ICAL.Recur;
  time?: TimeRange;
};

const DAY_MS = 86_400_000;

function expand(part: SchedulePart): Expanded {
  const parsed = part.time ? parseTime(part.time, Boolean(part.end)) : undefined;
  const time = typeof parsed === 'object' ? parsed : undefined;
  if (part.end) {
    return { part, kind: 'span', dates: [part.start], last: part.end, count: (+part.end - +part.start) / DAY_MS + 1, time };
  }
  if (!part.repeat) return { part, kind: 'single', dates: [part.start], last: part.start, count: 1, time };
  const recur = ICAL.Recur.fromString(part.repeat);
  const finite = recur.isFinite();
  const skip = new Set((part.skip ?? []).map(iso));
  const it = recur.iterator(ICAL.Time.fromDateString(iso(part.start)));
  const dates: Date[] = [];
  // Every session of a finite rule; of an endless one, the first that takes place.
  for (let t = it.next(), n = 0; t && n < MAX_SESSIONS && (finite || !dates.length); t = it.next(), n++) {
    const d = fromIcal(t);
    if (!skip.has(iso(d))) dates.push(d);
  }
  // A finite rule that gives one session reads as that session.
  const kind = finite && dates.length === 1 ? 'single' : 'repeat';
  return { part, kind, dates, last: finite ? dates.at(-1) : undefined, count: dates.length, recur, time };
}

/** The days a rule gives, without skips: all of a finite rule, or an endless one's up to `until`. */
function ruleDays(part: SchedulePart, until: Date): Date[] {
  const recur = ICAL.Recur.fromString(part.repeat!);
  const it = recur.iterator(ICAL.Time.fromDateString(iso(part.start)));
  const days: Date[] = [];
  for (let t = it.next(); t && days.length <= MAX_SESSIONS; t = it.next()) {
    const d = fromIcal(t);
    if (!recur.isFinite() && d > until) break;
    days.push(d);
  }
  return days;
}

/** Problems with one part, for the content schema: [field, message]. */
export function checkPart(part: SchedulePart): [keyof SchedulePart, string][] {
  const problems: [keyof SchedulePart, string][] = [];
  if (part.time) {
    const t = parseTime(part.time, Boolean(part.end));
    if (typeof t === 'string') problems.push(['time', t]);
  }
  if (part.end && part.repeat) problems.push(['end', 'a part has end (one continuous event) or repeat, not both']);
  if (part.end && part.end <= part.start) problems.push(['end', 'end is the last day, after start']);
  if (part.skip && !part.repeat) problems.push(['skip', 'skip leaves out dates of a repeat; this part does not repeat']);
  if (!part.repeat || problems.length) return problems;
  const problem = ruleProblem(part.repeat);
  if (problem) return [...problems, ['repeat', problem]];
  const skip = part.skip ?? [];
  let all: Date[];
  try {
    all = ruleDays(part, new Date(Math.max(+part.start, ...skip.map(Number))));
  } catch (e) {
    return [...problems, ['repeat', `repeat is not a valid rule: ${(e as Error).message}`]];
  }
  if (!all.length) return [...problems, ['repeat', 'repeat gives no dates after start']];
  if (+all[0]! !== +part.start) {
    problems.push(['start', `start (${longDate(part.start)}) is not a day the rule repeats on; its first day would be ${longDate(all[0]!)}`]);
  }
  if (all.length > MAX_SESSIONS) problems.push(['repeat', `repeat gives more than ${MAX_SESSIONS} sessions`]);
  const given = new Set(all.map(iso));
  for (const s of skip) {
    if (!given.has(iso(s))) problems.push(['skip', `${iso(s)} is not one of the dates the rule gives`]);
  }
  if (!problems.length && !expand(part).dates.length) problems.push(['skip', 'skip leaves no sessions']);
  return problems;
}

/** True when a part repeats with no end; false too when its rule does not parse, which `checkPart` reports. */
export function repeatsForever(part: SchedulePart): boolean {
  try {
    return Boolean(part.repeat) && !ICAL.Recur.fromString(part.repeat!).isFinite();
  } catch {
    return false;
  }
}

/* ---------- Wording ---------- */

const MONTHS = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ICAL_DAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const NTH: Record<string, string> = { '1': 'first', '2': 'second', '3': 'third', '4': 'fourth', '-1': 'last' };

const longFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const longDate = (d: Date) => longFormat.format(d);
const md = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} & ${xs.at(-1)}`);
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** "Oct 5–8", "Sept 14 – Oct 26", "Dec 28, 2026 – Jan 4, 2027"; `year` adds the year to a range within one year. */
function range(a: Date, b: Date, year = false): string {
  const y = a.getUTCFullYear();
  if (y !== b.getUTCFullYear()) return `${md(a)}, ${y} – ${md(b)}, ${b.getUTCFullYear()}`;
  const tail = year ? `, ${y}` : '';
  if (+a === +b) return `${md(a)}${tail}`;
  if (a.getUTCMonth() === b.getUTCMonth()) return `${md(a)}–${b.getUTCDate()}${tail}`;
  return `${md(a)} – ${md(b)}${tail}`;
}

/** The days a part meets on: "Mondays", "Every other Sunday", "Last Wednesday of each month", "Mon–Thu". */
function days(x: Expanded): string {
  const first = x.dates[0]!;
  if (x.kind === 'single') return '';
  if (x.kind === 'span') {
    if (x.count >= 7) return '';
    return `${DAYS_SHORT[first.getUTCDay()]}${x.count === 2 ? ' & ' : '–'}${DAYS_SHORT[x.last!.getUTCDay()]}`;
  }
  const { freq, interval } = x.recur!;
  const byday: string[] = x.recur!.parts.BYDAY ?? [];
  const bymonthday: number[] = x.recur!.parts.BYMONTHDAY ?? [];
  if (freq === 'DAILY') {
    if (interval !== 1) return '';
    if (!x.last || x.count >= 7) return 'Daily';
    const end = DAYS_SHORT[x.last.getUTCDay()];
    return x.count === 2 ? `${DAYS_SHORT[first.getUTCDay()]} & ${end}` : `${DAYS_SHORT[first.getUTCDay()]}–${end}`;
  }
  if (freq === 'WEEKLY') {
    // In week order from the first session's day, so a Saturday start reads "Saturdays & Sundays".
    const from = (d: number) => (d - first.getUTCDay() + 7) % 7;
    const weekdays = (byday.length ? byday.map((c) => ICAL_DAY[c]!) : [first.getUTCDay()]).sort((a, b) => from(a) - from(b));
    if (interval === 1) {
      if (weekdays.length < 3) return and(weekdays.map((d) => `${DAYS[d]}s`));
      const run = weekdays.every((d, i) => !i || d === (weekdays[i - 1]! + 1) % 7);
      return run ? `${DAYS_SHORT[weekdays[0]!]}–${DAYS_SHORT[weekdays.at(-1)!]}` : and(weekdays.map((d) => DAYS_SHORT[d]!));
    }
    if (interval === 2 && weekdays.length === 1) return `Every other ${DAYS[weekdays[0]!]}`;
    return '';
  }
  if (freq === 'MONTHLY' && interval === 1 && !(byday.length && bymonthday.length)) {
    const nth = byday.map((c) => /^(-?\d)([A-Z]{2})$/.exec(c));
    if (nth.length && nth.every((m) => m && NTH[m[1]!] && m[2] === nth[0]![2])) {
      const day = DAYS[ICAL_DAY[nth[0]![2]!]!];
      return `${capital(and(nth.map((m) => NTH[m![1]!]!)))} ${day}${nth.length > 1 ? 's' : ''} of each month`;
    }
    if (!byday.length) {
      const dates = bymonthday.length ? bymonthday : [first.getUTCDate()];
      if (dates.every((n) => n > 0)) return `The ${and(dates.map(ordinal))} of each month`;
    }
  }
  return '';
}

/** A part's time: "12:00–1:30 PM CT"; across a multi-day event, "Fri 4:00 PM – Sun 2:00 PM CT". */
function partTime(x: Expanded): string {
  if (!x.time) return '';
  if (x.kind !== 'span' || x.time.to === undefined) return formatTime(x.time);
  const a = clock(x.time.from);
  const b = clock(x.time.to);
  return `${DAYS_SHORT[x.dates[0]!.getUTCDay()]} ${a.text} ${a.ap} – ${DAYS_SHORT[x.last!.getUTCDay()]} ${b.text} ${b.ap} CT`;
}

export type ScheduleText = {
  /** First day; orders listings. */
  first: Date;
  /** Card line: "Sept 14 – Oct 26 · 7 sessions", "Saturday, Oct 24", "From March 25, 2026". */
  cardDates: string;
  /** Card lines, one per part: "Mondays · 12:00–1:30 PM CT". */
  cardLines: string[];
  /** Page: "Sept 14 – Oct 26, 2026", "Saturday, October 24, 2026". */
  pageDates: string;
  /** Page lines, one per part, naming each part's place when it has its own. */
  pageLines: string[];
  /**
   * "7 sessions", "3 days"; only for more than one, for one part or plain
   * blocks of dates, and not when parts share a day (activities on the same
   * nights), where a count would mislead.
   */
  length?: string;
};

/**
 * How a schedule reads on cards and pages. `venueName` names a part's own
 * venue on the page.
 */
export function describeSchedule(parts: readonly SchedulePart[], venueName: (id: string) => string): ScheduleText {
  const xs = [...parts].sort((a, b) => +a.start - +b.start).map(expand);
  // A part's first session can be skipped, so its start is not always its first day.
  const first = new Date(Math.min(...xs.map((x) => +x.dates[0]!)));
  const openEnded = xs.some((x) => !x.last);
  const last = openEnded ? undefined : new Date(Math.max(...xs.map((x) => +x.last!)));
  const count = xs.reduce((n, x) => n + x.count, 0);
  const noun = xs.every((x) => x.kind === 'span' || x.recur?.freq === 'DAILY') ? 'days' : 'sessions';
  const sessionDays = xs.flatMap((x) => x.dates.map(iso));
  const shareDays = new Set(sessionDays).size < sessionDays.length;
  // Parts with their own label or place are tracks or activities people may
  // not all attend, so only one part, or plain blocks of dates, are counted.
  const blocks = xs.length === 1 || xs.every((x) => !x.part.label && !x.part.venue);
  const length = last && count > 1 && blocks && !shareDays ? `${count} ${noun}` : undefined;
  const oneSession = xs.length === 1 && xs[0]!.kind === 'single';

  const cardDates = openEnded
    ? `From ${md(first)}, ${first.getUTCFullYear()}`
    : oneSession
      ? `${DAYS[first.getUTCDay()]}, ${md(first)}`
      : [range(first, last!), length].filter(Boolean).join(' · ');
  const pageDates = openEnded ? `From ${md(first)}, ${first.getUTCFullYear()}` : oneSession ? longDate(first) : range(first, last!, true);

  // A timed multi-day event names its days in its time.
  const detail = (x: Expanded) => (x.kind === 'span' && x.time?.to !== undefined ? partTime(x) : [days(x), partTime(x)].filter(Boolean).join(' · '));
  let cardLines: string[];
  let pageLines: string[];
  if (xs.length === 1) {
    const line = [xs[0]!.part.label, detail(xs[0]!)].filter(Boolean).join(' · ');
    cardLines = pageLines = line ? [line] : [];
  } else {
    const dates = (x: Expanded) => (x.last ? range(x.dates[0]!, x.last) : `from ${md(x.dates[0]!)}`);
    const join = (lead: string, x: Expanded) => capital(detail(x) ? `${lead}: ${detail(x)}` : lead);
    cardLines = xs.map((x) => join(x.part.label ?? dates(x), x));
    pageLines = xs.map((x) => {
      const place = x.part.venue && venueName(x.part.venue.id);
      const who = x.part.label ? (place ? `${x.part.label} at ${place}` : x.part.label) : place;
      return join(who ? `${who}, ${dates(x)}` : dates(x), x);
    });
  }
  return { first, cardDates, cardLines, pageDates, pageLines, length };
}
