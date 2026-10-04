import { describe, expect, it } from 'vitest';
import { addMonths, parseDate, shiftMonth } from './dates';

describe('parseDate', () => {
  it('reads German, ISO and short-year formats', () => {
    expect(parseDate('04.10.2026')).toBe('2026-10-04');
    expect(parseDate('4.1.26')).toBe('2026-01-04');
    expect(parseDate('2026-10-04')).toBe('2026-10-04');
    expect(parseDate('2026-10-04T12:00:00')).toBe('2026-10-04');
    expect(parseDate('31/12/2025')).toBe('2025-12-31');
  });

  it('rejects impossible dates', () => {
    expect(parseDate('31.02.2026')).toBeNull();
    expect(parseDate('Kontostand')).toBeNull();
  });
});

describe('month arithmetic', () => {
  it('crosses year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-10', -13)).toBe('2025-09');
  });

  it('clamps the day to the month length and restores it later', () => {
    expect(addMonths('2026-01-31', 1, 31)).toBe('2026-02-28');
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });
});
