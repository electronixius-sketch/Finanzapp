import { addMonths } from './dates';
import { newId } from './id';
import type { AppData, Interval, Recurring, Transaction } from './types';

export const INTERVAL_MONTHS: Record<Interval, number> = {
  monthly: 1,
  quarterly: 3,
  halfyearly: 6,
  yearly: 12,
};

export const INTERVAL_LABEL: Record<Interval, string> = {
  monthly: 'monatlich',
  quarterly: 'vierteljährlich',
  halfyearly: 'halbjährlich',
  yearly: 'jährlich',
};

export function advance(r: Recurring): string {
  return addMonths(r.nextDate, INTERVAL_MONTHS[r.interval], r.day);
}

/** Cost spread over one month, e.g. a yearly 120 € insurance counts as 10 € / month. */
export function monthlyEquivalent(r: Recurring): number {
  return Math.round(r.amount / INTERVAL_MONTHS[r.interval]);
}

/** Next due dates (inclusive) up to `until`, without mutating anything. */
export function upcoming(recurring: Recurring[], until: string): { recurring: Recurring; date: string }[] {
  const result: { recurring: Recurring; date: string }[] = [];
  for (const r of recurring) {
    if (!r.active) continue;
    let cursor = r;
    while (cursor.nextDate <= until && result.length < 500) {
      result.push({ recurring: r, date: cursor.nextDate });
      cursor = { ...cursor, nextDate: advance(cursor) };
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Books every recurring item that has become due on or before `today` and moves
 * its `nextDate` forward. Returns the same object when nothing was due.
 */
export function materializeRecurring(data: AppData, today: string): { data: AppData; created: number } {
  const created: Transaction[] = [];
  const recurring = data.recurring.map((r) => {
    if (!r.active || r.nextDate > today) return r;
    let next = r;
    // Cap protects against a far-past start date producing thousands of rows.
    for (let i = 0; next.nextDate <= today && i < 240; i++) {
      created.push({
        id: newId(),
        date: next.nextDate,
        amount: r.amount,
        type: r.type,
        categoryId: r.categoryId,
        note: r.note,
        recurringId: r.id,
      });
      next = { ...next, nextDate: advance(next) };
    }
    return next;
  });
  if (created.length === 0) return { data, created: 0 };
  return {
    data: { ...data, recurring, transactions: [...data.transactions, ...created] },
    created: created.length,
  };
}
