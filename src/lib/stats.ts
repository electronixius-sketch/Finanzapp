import { monthOf, shiftMonth } from './dates';
import type { Category, Transaction, TxType } from './types';

export interface Totals {
  income: number;
  expense: number;
  balance: number;
}

/** Totals of a month, optionally only up to a day of month (for fair mid-month comparisons). */
export function totalsFor(transactions: Transaction[], month: string, untilDay = 31): Totals {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (monthOf(t.date) !== month || Number(t.date.slice(8, 10)) > untilDay) continue;
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

/** Share of income that was not spent; null when there was no income. */
export function savingsRate(t: Totals): number | null {
  return t.income > 0 ? t.balance / t.income : null;
}

export function byCategory(
  transactions: Transaction[],
  month: string,
  type: TxType = 'expense',
): { categoryId: string; total: number }[] {
  const sums = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== type || monthOf(t.date) !== month) continue;
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.amount);
  }
  return [...sums.entries()]
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total);
}

export interface MonthPoint {
  month: string;
  income: number;
  expense: number;
}

/** The `count` months ending with `lastMonth`, oldest first. */
export function trend(transactions: Transaction[], lastMonth: string, count = 12): MonthPoint[] {
  const first = shiftMonth(lastMonth, -(count - 1));
  const points = new Map<string, MonthPoint>();
  for (let i = 0; i < count; i++) {
    const month = shiftMonth(first, i);
    points.set(month, { month, income: 0, expense: 0 });
  }
  for (const t of transactions) {
    const p = points.get(monthOf(t.date));
    if (p) p[t.type] += t.amount;
  }
  return [...points.values()];
}

export interface BudgetStatus {
  category: Category;
  spent: number;
  budget: number;
  ratio: number;
}

export function budgetStatus(categories: Category[], transactions: Transaction[], month: string): BudgetStatus[] {
  const spent = new Map(byCategory(transactions, month).map((c) => [c.categoryId, c.total]));
  return categories
    .filter((c) => c.type === 'expense' && c.budget && c.budget > 0)
    .map((category) => {
      const s = spent.get(category.id) ?? 0;
      return { category, spent: s, budget: category.budget!, ratio: s / category.budget! };
    })
    .sort((a, b) => b.ratio - a.ratio);
}
