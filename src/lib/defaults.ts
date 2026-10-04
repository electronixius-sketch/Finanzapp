import type { AppData, Category, Rule, TxType } from './types';

/** Fallback categories – cannot be deleted; everything unassigned lands here. */
export const FALLBACK: Record<TxType, string> = {
  expense: 'other-expense',
  income: 'other-income',
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'housing', name: 'Wohnen & Nebenkosten', icon: '🏠', type: 'expense' },
  { id: 'groceries', name: 'Lebensmittel', icon: '🛒', type: 'expense' },
  { id: 'dining', name: 'Restaurant & Café', icon: '🍽️', type: 'expense' },
  { id: 'mobility', name: 'Mobilität', icon: '🚆', type: 'expense' },
  { id: 'insurance', name: 'Versicherungen', icon: '🛡️', type: 'expense' },
  { id: 'subscriptions', name: 'Abos & Verträge', icon: '📺', type: 'expense' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', type: 'expense' },
  { id: 'health', name: 'Gesundheit & Drogerie', icon: '💊', type: 'expense' },
  { id: 'leisure', name: 'Freizeit & Hobby', icon: '🎮', type: 'expense' },
  { id: 'travel', name: 'Urlaub & Reisen', icon: '✈️', type: 'expense' },
  { id: 'gifts', name: 'Geschenke & Spenden', icon: '🎁', type: 'expense' },
  { id: 'savings', name: 'Sparen & Anlegen', icon: '📈', type: 'expense' },
  { id: FALLBACK.expense, name: 'Sonstiges', icon: '📦', type: 'expense' },
  { id: 'salary', name: 'Gehalt', icon: '💼', type: 'income' },
  { id: 'refunds', name: 'Erstattungen', icon: '↩️', type: 'income' },
  { id: FALLBACK.income, name: 'Sonstige Einnahmen', icon: '💶', type: 'income' },
];

// Order matters: the first matching rule wins, so specific keywords come before generic ones.
const KEYWORDS: [string, string[]][] = [
  ['subscriptions', ['netflix', 'spotify', 'disney', 'amazon prime', 'prime video', 'apple.com/bill', 'youtube', 'audible', 'dazn', 'telekom', 'vodafone', 'o2', 'congstar', '1&1']],
  ['groceries', ['rewe', 'edeka', 'aldi', 'lidl', 'penny', 'netto', 'kaufland', 'tegut', 'globus', 'norma']],
  ['health', ['dm-drogerie', 'dm drogerie', 'rossmann', 'apotheke', 'müller']],
  ['mobility', ['deutsche bahn', 'db vertrieb', 'deutschlandticket', 'shell', 'aral', 'esso', 'total', 'tankstelle', 'bvg', 'mvg', 'hvv', 'uber', 'bolt', 'flixbus', 'parken']],
  ['dining', ['lieferando', 'wolt', 'mcdonalds', "mcdonald's", 'burger king', 'starbucks', 'restaurant', 'café', 'cafe']],
  ['insurance', ['versicherung', 'huk', 'allianz', 'axa', 'ergo', 'debeka', 'signal iduna']],
  ['housing', ['miete', 'nebenkosten', 'stadtwerke', 'strom', 'rundfunk', 'hausverwaltung']],
  ['shopping', ['amazon', 'zalando', 'ikea', 'mediamarkt', 'saturn', 'otto', 'h&m', 'decathlon']],
  ['travel', ['booking.com', 'airbnb', 'lufthansa', 'ryanair', 'eurowings']],
  ['savings', ['sparplan', 'depot', 'trade republic', 'scalable']],
  ['salary', ['gehalt', 'lohn', 'bezüge']],
  ['refunds', ['erstattung', 'rückzahlung', 'gutschrift']],
];

export const DEFAULT_RULES: Rule[] = KEYWORDS.flatMap(([categoryId, words]) =>
  words.map((keyword) => ({ id: `rule-${categoryId}-${keyword}`, keyword, categoryId })),
);

export function createInitialData(): AppData {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    transactions: [],
    recurring: [],
    rules: DEFAULT_RULES.map((r) => ({ ...r })),
    settings: { theme: 'system' },
  };
}
