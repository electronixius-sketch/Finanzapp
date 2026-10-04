import { createInitialData } from './defaults';
import { addMonths, monthOf, shiftMonth } from './dates';
import { newId } from './id';
import { materializeRecurring } from './recurring';
import type { AppData, Recurring, Transaction } from './types';

/** Deterministic pseudo-random numbers so the demo looks the same every time. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const VARIABLE: [string, string[], number, number, number][] = [
  // category, payees, bookings per month, min €, max €
  ['groceries', ['REWE', 'EDEKA', 'ALDI SÜD', 'Lidl'], 9, 12, 78],
  ['dining', ['Lieferando', 'Café Rösterei', 'Pizzeria Da Mario'], 4, 9, 46],
  ['mobility', ['Aral Tankstelle', 'Deutsche Bahn'], 2, 25, 85],
  ['shopping', ['Amazon', 'Zalando', 'IKEA'], 2, 15, 120],
  ['health', ['dm-drogerie markt', 'Rossmann', 'Apotheke am Markt'], 2, 6, 35],
  ['leisure', ['Kino', 'Thalia', 'Fitness Studio Tagespass'], 2, 10, 45],
];

/** Six months of plausible data so the app can be explored before entering real numbers. */
export function createDemoData(today: string): AppData {
  const rand = seeded(42);
  const data = createInitialData();
  const start = `${shiftMonth(monthOf(today), -5)}-01`;

  const templates: Omit<Recurring, 'id' | 'nextDate' | 'active'>[] = [
    { note: 'Gehalt', categoryId: 'salary', type: 'income', amount: 285000, day: 28, interval: 'monthly' },
    { note: 'Miete', categoryId: 'housing', type: 'expense', amount: 89000, day: 1, interval: 'monthly' },
    { note: 'Stadtwerke Strom', categoryId: 'housing', type: 'expense', amount: 7400, day: 15, interval: 'monthly' },
    { note: 'Deutschlandticket', categoryId: 'mobility', type: 'expense', amount: 5800, day: 1, interval: 'monthly' },
    { note: 'Netflix', categoryId: 'subscriptions', type: 'expense', amount: 1399, day: 5, interval: 'monthly' },
    { note: 'Spotify', categoryId: 'subscriptions', type: 'expense', amount: 1199, day: 12, interval: 'monthly' },
    { note: 'Telekom Mobilfunk', categoryId: 'subscriptions', type: 'expense', amount: 2995, day: 20, interval: 'monthly' },
    { note: 'Haftpflichtversicherung', categoryId: 'insurance', type: 'expense', amount: 6500, day: 10, interval: 'yearly' },
    { note: 'ETF-Sparplan', categoryId: 'savings', type: 'expense', amount: 25000, day: 2, interval: 'monthly' },
  ];
  const recurring: Recurring[] = templates.map((r) => ({
    ...r,
    id: newId(),
    active: true,
    nextDate: addMonths(start, 0, r.day),
  }));

  const transactions: Transaction[] = [];
  for (let m = 0; m < 6; m++) {
    const month = shiftMonth(monthOf(start), m);
    for (const [categoryId, payees, perMonth, min, max] of VARIABLE) {
      for (let i = 0; i < perMonth; i++) {
        const day = 1 + Math.floor(rand() * 28);
        const date = `${month}-${String(day).padStart(2, '0')}`;
        if (date > today) continue;
        transactions.push({
          id: newId(),
          date,
          type: 'expense',
          categoryId,
          note: payees[Math.floor(rand() * payees.length)],
          amount: Math.round((min + rand() * (max - min)) * 100),
        });
      }
    }
  }

  data.categories = data.categories.map((c) =>
    c.id === 'groceries' ? { ...c, budget: 40000 } : c.id === 'dining' ? { ...c, budget: 12000 } : c.id === 'shopping' ? { ...c, budget: 15000 } : c,
  );
  return materializeRecurring({ ...data, recurring, transactions }, today).data;
}
