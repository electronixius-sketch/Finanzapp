import { FALLBACK, createInitialData } from './defaults';
import { formatDate } from './dates';
import type { AppData } from './types';

export function serializeBackup(data: AppData): string {
  return JSON.stringify({ app: 'finanzapp', exportedAt: new Date().toISOString(), data }, null, 2);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Validates a backup file and fills in anything a future/older version may lack. */
export function parseBackup(text: string): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }
  const data = isObj(parsed) && isObj(parsed.data) ? parsed.data : parsed;
  if (!isObj(data) || !Array.isArray(data.transactions) || !Array.isArray(data.categories)) {
    throw new Error('Die Datei sieht nicht nach einem Finanzapp-Backup aus.');
  }
  for (const t of data.transactions as unknown[]) {
    if (!isObj(t) || typeof t.date !== 'string' || typeof t.amount !== 'number' || typeof t.categoryId !== 'string') {
      throw new Error('Das Backup enthält fehlerhafte Buchungen.');
    }
  }
  const base = createInitialData();
  const result: AppData = {
    version: 1,
    categories: data.categories as AppData['categories'],
    transactions: data.transactions as AppData['transactions'],
    recurring: Array.isArray(data.recurring) ? (data.recurring as AppData['recurring']) : [],
    rules: Array.isArray(data.rules) ? (data.rules as AppData['rules']) : base.rules,
    settings: { ...base.settings, ...(isObj(data.settings) ? data.settings : {}) },
  };
  // The fallback categories must always exist.
  for (const id of Object.values(FALLBACK)) {
    if (!result.categories.some((c) => c.id === id)) {
      result.categories.push(base.categories.find((c) => c.id === id)!);
    }
  }
  return result;
}

const csvCell = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Semicolon-separated with German decimals so Excel opens it correctly. */
export function transactionsToCSV(data: AppData): string {
  const names = new Map(data.categories.map((c) => [c.id, c.name]));
  const lines = [['Datum', 'Typ', 'Kategorie', 'Beschreibung', 'Betrag'].join(';')];
  const sorted = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    const signed = (t.type === 'expense' ? -t.amount : t.amount) / 100;
    lines.push(
      [
        formatDate(t.date),
        t.type === 'expense' ? 'Ausgabe' : 'Einnahme',
        csvCell(names.get(t.categoryId) ?? ''),
        csvCell(t.note),
        signed.toFixed(2).replace('.', ','),
      ].join(';'),
    );
  }
  // BOM so Excel detects UTF-8 (umlauts).
  return '﻿' + lines.join('\r\n');
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
