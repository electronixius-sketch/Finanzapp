import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from './backup';
import { createInitialData, FALLBACK } from './defaults';
import { createDemoData } from './demo';
import { materializeRecurring, monthlyEquivalent, upcoming } from './recurring';
import { categorize, matchesKeyword } from './rules';
import { budgetStatus, byCategory, savingsRate, totalsFor, trend } from './stats';
import type { AppData, Recurring } from './types';

const rent: Recurring = {
  id: 'r1',
  type: 'expense',
  amount: 90000,
  categoryId: 'housing',
  note: 'Miete',
  interval: 'monthly',
  day: 31,
  nextDate: '2026-01-31',
  active: true,
};

describe('recurring bookings', () => {
  it('books every due date up to today and keeps the day of month', () => {
    const data: AppData = { ...createInitialData(), recurring: [rent] };
    const { data: next, created } = materializeRecurring(data, '2026-04-15');
    expect(created).toBe(3);
    expect(next.transactions.map((t) => t.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(next.recurring[0].nextDate).toBe('2026-04-30');
    expect(next.transactions.every((t) => t.recurringId === 'r1')).toBe(true);
  });

  it('is idempotent and ignores paused items', () => {
    const data: AppData = { ...createInitialData(), recurring: [rent, { ...rent, id: 'r2', active: false }] };
    const once = materializeRecurring(data, '2026-02-01').data;
    const twice = materializeRecurring(once, '2026-02-01');
    expect(twice.created).toBe(0);
    expect(twice.data).toBe(once);
    expect(once.transactions).toHaveLength(1);
  });

  it('spreads non-monthly costs and lists upcoming dates', () => {
    expect(monthlyEquivalent({ ...rent, amount: 12000, interval: 'yearly' })).toBe(1000);
    expect(upcoming([rent], '2026-03-31').map((u) => u.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
});

describe('rules', () => {
  const { rules, categories } = createInitialData();

  it('matches at word starts only', () => {
    expect(matchesKeyword('ESSO Station 123', 'esso')).toBe(true);
    expect(matchesKeyword('Espresso Bar', 'esso')).toBe(false);
    expect(matchesKeyword('TotalEnergies', 'total')).toBe(true);
  });

  it('prefers specific rules and respects the booking direction', () => {
    expect(categorize('AMAZON PRIME*1234', 'expense', rules, categories)).toBe('subscriptions');
    expect(categorize('AMAZON EU S.A R.L.', 'expense', rules, categories)).toBe('shopping');
    expect(categorize('REWE Markt', 'expense', rules, categories)).toBe('groceries');
    expect(categorize('Gehalt Oktober', 'income', rules, categories)).toBe('salary');
    expect(categorize('Gehalt Oktober', 'expense', rules, categories)).toBe(FALLBACK.expense);
    expect(categorize('Irgendwas', 'income', rules, categories)).toBe(FALLBACK.income);
  });
});

describe('stats', () => {
  const tx = [
    { id: '1', date: '2026-10-01', amount: 200000, type: 'income' as const, categoryId: 'salary', note: '' },
    { id: '2', date: '2026-10-02', amount: 50000, type: 'expense' as const, categoryId: 'housing', note: '' },
    { id: '3', date: '2026-10-03', amount: 30000, type: 'expense' as const, categoryId: 'groceries', note: '' },
    { id: '4', date: '2026-10-09', amount: 25000, type: 'expense' as const, categoryId: 'groceries', note: '' },
    { id: '5', date: '2026-09-09', amount: 10000, type: 'expense' as const, categoryId: 'groceries', note: '' },
  ];

  it('sums a month', () => {
    const totals = totalsFor(tx, '2026-10');
    expect(totals).toEqual({ income: 200000, expense: 105000, balance: 95000 });
    expect(savingsRate(totals)).toBe(0.475);
    expect(savingsRate(totalsFor(tx, '2026-09'))).toBeNull();
    expect(totalsFor(tx, '2026-10', 5)).toEqual({ income: 200000, expense: 80000, balance: 120000 });
  });

  it('groups by category, largest first', () => {
    expect(byCategory(tx, '2026-10')).toEqual([
      { categoryId: 'groceries', total: 55000 },
      { categoryId: 'housing', total: 50000 },
    ]);
  });

  it('builds a fixed-length trend including empty months', () => {
    const points = trend(tx, '2026-10', 3);
    expect(points.map((p) => p.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(points[0]).toEqual({ month: '2026-08', income: 0, expense: 0 });
    expect(points[2].expense).toBe(105000);
  });

  it('reports budget usage', () => {
    const categories = createInitialData().categories.map((c) => (c.id === 'groceries' ? { ...c, budget: 40000 } : c));
    const [status] = budgetStatus(categories, tx, '2026-10');
    expect(status.category.id).toBe('groceries');
    expect(status.ratio).toBe(1.375);
  });
});

describe('backup', () => {
  it('round-trips and restores missing fallback categories', () => {
    const data = createDemoData('2026-10-04');
    expect(parseBackup(serializeBackup(data))).toEqual(data);

    const broken = { ...data, categories: data.categories.filter((c) => c.id !== FALLBACK.expense) };
    expect(parseBackup(JSON.stringify(broken)).categories.some((c) => c.id === FALLBACK.expense)).toBe(true);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('nope')).toThrow(/JSON/);
    expect(() => parseBackup('{"foo":1}')).toThrow(/Backup/);
  });
});

describe('demo data', () => {
  it('never creates bookings in the future', () => {
    const data = createDemoData('2026-10-04');
    expect(data.transactions.length).toBeGreaterThan(100);
    expect(data.transactions.every((t) => t.date <= '2026-10-04')).toBe(true);
  });
});
