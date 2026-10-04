export type TxType = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: TxType;
  /** Monthly budget in cents (expense categories only). */
  budget?: number;
}

export interface Transaction {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Always positive, in cents. Direction comes from `type`. */
  amount: number;
  type: TxType;
  categoryId: string;
  /** Short description: payee, shop, purpose. */
  note: string;
  recurringId?: string;
  /** Fingerprint of an imported bank row, used to skip duplicates on re-import. */
  importHash?: string;
}

export type Interval = 'monthly' | 'quarterly' | 'halfyearly' | 'yearly';

export interface Recurring {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  note: string;
  interval: Interval;
  /** Day of month the booking is due on (1–31, clamped to month length). */
  day: number;
  /** Next date a transaction will be created for. */
  nextDate: string;
  active: boolean;
}

export interface Rule {
  id: string;
  /** Case-insensitive substring matched against payee / purpose. */
  keyword: string;
  categoryId: string;
}

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  theme: Theme;
  lastBackup?: string;
}

export interface AppData {
  version: 1;
  categories: Category[];
  transactions: Transaction[];
  recurring: Recurring[];
  rules: Rule[];
  settings: Settings;
}
