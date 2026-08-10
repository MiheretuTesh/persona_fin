import { toEC, toGC, monthNames } from 'kenat';
import {
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
} from 'date-fns';

/**
 * Dual-calendar layer — Gregorian and Ethiopian (ግዕዝ / ባህረ ሃሳብ).
 *
 * Everything above this module keeps speaking in native JS `Date` objects.
 * A `Date` is an absolute instant; "which calendar" is purely a *rendering and
 * period-boundary* concern. So this file exposes two things:
 *
 *   1. Conversions — `toEthiopian` / `fromEthiopian`, wrapping `kenat`.
 *   2. A calendar-agnostic period API — `startOfPeriod`, `endOfPeriod`,
 *      `addPeriods`, `periodKey`, `formatPeriod`, … — each taking a
 *      `CalendarSystem` and dispatching to date-fns or to the Ethiopian
 *      arithmetic below.
 *
 * Why a period abstraction rather than sprinkling `if (ethiopian)` at call
 * sites: "this month" drives budget windows, month totals, the insights
 * breakdown, and every dedup key in the notification engine. If a user is on
 * the Ethiopian calendar, their month runs Meskerem 1 → Meskerem 30, which
 * straddles two Gregorian months. Centralising the boundary maths is the only
 * way those five subsystems stay consistent with each other.
 *
 * Ethiopian calendar shape (for anyone unfamiliar):
 *   - 13 months. Months 1–12 are exactly 30 days each.
 *   - Month 13 (ጳጉሜ / Pagume) is 5 days, or 6 in a leap year.
 *   - Leap years are those where `year % 4 === 3` (the year *before* a
 *     Gregorian leap year).
 *   - The new year (መስከረም 1) falls on 11 September, or 12 September in the
 *     Gregorian year preceding a Gregorian leap year.
 *   - It runs 7–8 years behind the Gregorian calendar: 10 Aug 2026 is
 *     4 ነሐሴ 2018.
 *
 * All conversions go through the *local* date parts (`getFullYear` etc.), never
 * `toISOString`. Using UTC would shift the calendar date by a day for any user
 * east of Greenwich — which is every Ethiopian user (UTC+3).
 */

export type CalendarSystem = 'gregorian' | 'ethiopian';

/** How Ethiopian month names render. `amharic` → ነሐሴ, `latin` → Nehase. */
export type CalendarScript = 'amharic' | 'latin';

export type EthiopianDate = { year: number; month: number; day: number };

// ─── Conversions ────────────────────────────────────────────────────────────

/** Gregorian JS `Date` → Ethiopian calendar date, using local time parts. */
export function toEthiopian(d: Date): EthiopianDate {
  return toEC(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Ethiopian calendar date → JS `Date` at local midnight.
 *
 * Out-of-range days are clamped rather than thrown: `kenat` rejects e.g.
 * ጳጉሜ 6 in a non-leap year, and callers doing month arithmetic ("same day
 * next month") would otherwise have to pre-validate every result.
 */
export function fromEthiopian(e: EthiopianDate): Date {
  const month = Math.min(13, Math.max(1, e.month));
  const day = Math.min(Math.max(1, e.day), ethiopianMonthLength(e.year, month));
  const g = toGC(e.year, month, day);
  return new Date(g.year, g.month - 1, g.day, 0, 0, 0, 0);
}

/** ጳጉሜ gains a 6th day in years where `year % 4 === 3`. */
export function isEthiopianLeapYear(year: number): boolean {
  return ((year % 4) + 4) % 4 === 3;
}

/** Days in an Ethiopian month: 30 for months 1–12, 5 or 6 for ጳጉሜ. */
export function ethiopianMonthLength(year: number, month: number): number {
  if (month === 13) return isEthiopianLeapYear(year) ? 6 : 5;
  return 30;
}

// ─── Ethiopian period arithmetic ────────────────────────────────────────────

/**
 * Shifts an Ethiopian date by whole months, wrapping through the 13-month
 * year. Expressed as an absolute month ordinal so negative `n` works without a
 * separate branch; the day is clamped so "one month after ሰኔ 30" lands on
 * ሐምሌ 30 and "one month after ነሐሴ 30" lands on ጳጉሜ 5, not an invalid date.
 */
function addEthiopianMonths(e: EthiopianDate, n: number): EthiopianDate {
  const ordinal = e.year * 13 + (e.month - 1) + n;
  const year = Math.floor(ordinal / 13);
  const month = ordinal - year * 13 + 1;
  return { year, month, day: Math.min(e.day, ethiopianMonthLength(year, month)) };
}

// ─── Calendar-agnostic period API ───────────────────────────────────────────

/** First instant of the period (Gregorian or Ethiopian month) containing `d`. */
export function startOfPeriod(d: Date, system: CalendarSystem): Date {
  if (system === 'gregorian') return startOfMonth(d);
  const e = toEthiopian(d);
  return fromEthiopian({ year: e.year, month: e.month, day: 1 });
}

/** Last instant (23:59:59.999) of the period containing `d`. */
export function endOfPeriod(d: Date, system: CalendarSystem): Date {
  if (system === 'gregorian') return endOfMonth(d);
  const e = toEthiopian(d);
  const last = ethiopianMonthLength(e.year, e.month);
  return endOfDay(fromEthiopian({ year: e.year, month: e.month, day: last }));
}

/** Shift by `n` whole periods, preserving the day-of-month where possible. */
export function addPeriods(d: Date, n: number, system: CalendarSystem): Date {
  if (system === 'gregorian') return addMonths(d, n);
  return fromEthiopian(addEthiopianMonths(toEthiopian(d), n));
}

/** True when both dates fall in the same period of the given calendar. */
export function isSamePeriod(a: Date, b: Date, system: CalendarSystem): boolean {
  if (system === 'gregorian') return isSameMonth(a, b);
  const ea = toEthiopian(a);
  const eb = toEthiopian(b);
  return ea.year === eb.year && ea.month === eb.month;
}

/**
 * Stable, sortable period identifier — `2026-08` (Gregorian) or `2018-12`
 * (Ethiopian). Used for React Query keys, notification dedup keys, and
 * bucketing transactions into months.
 *
 * The calendar is *not* encoded in the string. Callers that persist these keys
 * across a calendar switch (the notification dedup map) must include the
 * system separately — see `periodScope`.
 */
export function periodKey(d: Date, system: CalendarSystem): string {
  if (system === 'gregorian') return format(d, 'yyyy-MM');
  const e = toEthiopian(d);
  return `${e.year}-${String(e.month).padStart(2, '0')}`;
}

/**
 * Period key prefixed with a one-character calendar tag: `g:2026-08` /
 * `e:2018-12`. Anything persisted across a calendar-preference change uses
 * this so an Ethiopian-month alert and a Gregorian-month alert can't collide
 * on the same key when the two happen to overlap.
 */
export function periodScope(d: Date, system: CalendarSystem): string {
  return `${system === 'gregorian' ? 'g' : 'e'}:${periodKey(d, system)}`;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

const ETHIOPIAN_MONTHS: Record<CalendarScript, string[]> = {
  amharic: monthNames.amharic,
  latin: monthNames.english,
};

/** Abbreviations for the Latin transliterations; Amharic names are short already. */
const LATIN_SHORT = ['Mes', 'Tik', 'Hid', 'Tah', 'Tir', 'Yek', 'Meg', 'Miy', 'Gin', 'Sen', 'Ham', 'Neh', 'Pag'];

/** Ethiopian month name, 1-indexed. */
export function ethiopianMonthName(month: number, script: CalendarScript = 'amharic'): string {
  return ETHIOPIAN_MONTHS[script][Math.min(13, Math.max(1, month)) - 1] ?? '';
}

function ethiopianMonthShort(month: number, script: CalendarScript): string {
  const i = Math.min(13, Math.max(1, month)) - 1;
  return script === 'amharic' ? (monthNames.amharic[i] ?? '') : (LATIN_SHORT[i] ?? '');
}

export type FormatOpts = { script?: CalendarScript };

/** Full period label for headers: "August 2026" / "ነሐሴ 2018" / "Nehase 2018". */
export function formatPeriod(d: Date, system: CalendarSystem, opts: FormatOpts = {}): string {
  if (system === 'gregorian') return format(d, 'MMMM yyyy');
  const e = toEthiopian(d);
  return `${ethiopianMonthName(e.month, opts.script ?? 'amharic')} ${e.year}`;
}

/** Compact period label for chart axes: "Aug" / "ነሐሴ" / "Neh". */
export function formatPeriodShort(d: Date, system: CalendarSystem, opts: FormatOpts = {}): string {
  if (system === 'gregorian') return format(d, 'MMM');
  return ethiopianMonthShort(toEthiopian(d).month, opts.script ?? 'amharic');
}

/** Month name alone, no year: "August" / "ነሐሴ". */
export function formatMonthName(d: Date, system: CalendarSystem, opts: FormatOpts = {}): string {
  if (system === 'gregorian') return format(d, 'MMMM');
  return ethiopianMonthName(toEthiopian(d).month, opts.script ?? 'amharic');
}

/** Day + month: "24 Oct" / "24 ጥቅምት". */
export function formatDayMonth(d: Date, system: CalendarSystem, opts: FormatOpts = {}): string {
  if (system === 'gregorian') return format(d, 'd MMM');
  const e = toEthiopian(d);
  return `${e.day} ${ethiopianMonthShort(e.month, opts.script ?? 'amharic')}`;
}

/** Day + month + year: "24 Oct 2024" / "24 ጥቅምት 2017". */
export function formatDayMonthYear(d: Date, system: CalendarSystem, opts: FormatOpts = {}): string {
  if (system === 'gregorian') return format(d, 'd MMM yyyy');
  const e = toEthiopian(d);
  return `${e.day} ${ethiopianMonthShort(e.month, opts.script ?? 'amharic')} ${e.year}`;
}

/** Weekday + day + month: "Thu · 24 Oct" / "ሐሙስ · 24 ጥቅምት". */
export function formatWeekdayDayMonth(d: Date, system: CalendarSystem, opts: FormatOpts = {}): string {
  if (system === 'gregorian') return format(d, 'EEE · d MMM');
  const script = opts.script ?? 'amharic';
  const weekday = script === 'amharic' ? AMHARIC_WEEKDAYS[d.getDay()] : format(d, 'EEE');
  return `${weekday} · ${formatDayMonth(d, system, opts)}`;
}

/** Sunday-first, matching `Date.prototype.getDay()`. */
const AMHARIC_WEEKDAYS = ['እሁድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'አርብ', 'ቅዳሜ'];

/** Single-letter-ish weekday for sparkline axes: "Mon" / "ሰኞ". */
export function formatWeekday(d: Date, system: CalendarSystem, opts: FormatOpts = {}): string {
  if (system === 'gregorian' || (opts.script ?? 'amharic') === 'latin') return format(d, 'EEE');
  return AMHARIC_WEEKDAYS[d.getDay()] ?? format(d, 'EEE');
}

/**
 * Human short date used by transaction rows: "Today", "Yesterday", then
 * "24 ጥቅምት", falling back to a year-qualified form beyond ~11 months.
 */
export function formatRelativeDate(d: Date, system: CalendarSystem, opts: FormatOpts = {}): string {
  const now = new Date();
  if (isSameDay(d, now)) return 'Today';
  if (isSameDay(d, startOfDay(new Date(now.getTime() - 86_400_000)))) return 'Yesterday';
  if (Math.abs(differenceInCalendarDays(now, d)) < 330) return formatDayMonth(d, system, opts);
  return formatDayMonthYear(d, system, opts);
}

/**
 * Renders a *saved* period key back into a label without needing the original
 * `Date`. Used by the notifications inbox, which stores only the key.
 * Accepts both bare (`2018-12`) and scoped (`e:2018-12`) forms.
 */
export function formatPeriodKey(key: string, opts: FormatOpts = {}): string {
  const bare = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key;
  const [yearStr, monthStr] = bare.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return key;
  // Ethiopian years are ~7–8 behind, and only the Ethiopian calendar has a
  // 13th month — both are reliable discriminators for a key we didn't tag.
  const ethiopian = key.startsWith('e:') || month === 13 || year < new Date().getFullYear() - 2;
  if (ethiopian) return `${ethiopianMonthName(month, opts.script ?? 'amharic')} ${year}`;
  return format(new Date(year, month - 1, 1), 'MMMM yyyy');
}
