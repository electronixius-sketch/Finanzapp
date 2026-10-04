const currency = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const wholeCurrency = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const plain = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 });

export function formatCents(cents: number): string {
  return currency.format(cents / 100);
}

/** Rounded to whole euros – for tiles and chart labels. */
export function formatEuro(cents: number): string {
  return wholeCurrency.format(Math.round(cents / 100));
}

/** Axis ticks: "1.500" without currency symbol. */
export function formatTick(cents: number): string {
  return plain.format(cents / 100);
}

/** Explicit sign with a real minus (U+2212), e.g. for balances and sums. */
export function formatSigned(cents: number, whole = false): string {
  const text = whole ? formatEuro(Math.abs(cents)) : formatCents(Math.abs(cents));
  return cents > 0 ? `+${text}` : cents < 0 ? `−${text}` : text;
}

export function formatPercent(ratio: number): string {
  return percent.format(ratio);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Parses amounts as they appear in forms and bank exports and returns signed cents.
 * Handles "1.234,56", "1,234.56", "-12,50 €", "12,50-", "−3,20", "1.234" (German thousands).
 */
export function parseAmount(input: string): number | null {
  let s = input
    .trim()
    .replace(/[−–]/g, '-')
    .replace(/eur|€/gi, '')
    .replace(/[\s ']/g, '');
  if (!s) return null;

  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (s.endsWith('-')) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Whichever separator comes last is the decimal separator.
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    s = s.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma >= 0) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    s = s.replace(',', '.');
  } else if (lastDot >= 0) {
    const groups = s.split('.');
    // "1.234" or "1.234.567" → German thousands separators; "12.5" → decimal point.
    if (groups.length > 2 || groups[groups.length - 1].length === 3) {
      if (!groups.slice(1).every((g) => g.length === 3)) return null;
      s = groups.join('');
    }
  }

  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}
