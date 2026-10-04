// Dates are kept as local "YYYY-MM-DD" strings and months as "YYYY-MM" so that
// comparisons are plain string comparisons and no time zone can shift a booking.

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

export function isValidISO(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

/** Accepts 31.12.2026, 31.12.26, 2026-12-31 and 31/12/2026. */
export function parseDate(input: string): string | null {
  const s = input.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/.exec(s);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  }
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return isValidISO(iso) ? iso : null;
}

/** Moves a month key by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Date in the month `delta` months away, on `day` clamped to that month's length. */
export function addMonths(iso: string, delta: number, day?: number): string {
  const target = shiftMonth(monthOf(iso), delta);
  const [y, m] = target.split('-').map(Number);
  const wanted = day ?? Number(iso.slice(8, 10));
  return `${target}-${pad(Math.min(wanted, daysInMonth(y, m)))}`;
}

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toISO(new Date(y, m - 1, d + delta));
}

const monthLong = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const monthShort = new Intl.DateTimeFormat('de-DE', { month: 'short' });
const dayLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const dayShort = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

const asDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d ?? 1);
};

export const formatMonth = (month: string) => monthLong.format(asDate(month));
export const formatMonthShort = (month: string) => monthShort.format(asDate(month)).replace('.', '');
export const formatDate = (iso: string) => dayShort.format(asDate(iso));

export function formatDay(iso: string, today = todayISO()): string {
  if (iso === today) return 'Heute';
  if (iso === addDays(today, -1)) return 'Gestern';
  return dayLong.format(asDate(iso));
}
