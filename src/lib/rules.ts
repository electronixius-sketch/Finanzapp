import { FALLBACK } from './defaults';
import type { Category, Rule, TxType } from './types';

const norm = (s: string) => s.toLocaleLowerCase('de-DE');
const wordChar = /[\p{L}\p{N}]/u;

/**
 * Case-insensitive match that must start at a word boundary, so "esso" hits
 * "ESSO Station" but not "Espresso", while "total" still hits "TotalEnergies".
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  const t = norm(text);
  const k = norm(keyword.trim());
  if (!k) return false;
  for (let i = t.indexOf(k); i !== -1; i = t.indexOf(k, i + 1)) {
    if (i === 0 || !wordChar.test(t[i - 1])) return true;
  }
  return false;
}

/** First rule whose keyword matches and whose category fits the booking direction wins. */
export function categorize(text: string, type: TxType, rules: Rule[], categories: Category[]): string {
  const typeOf = new Map(categories.map((c) => [c.id, c.type]));
  for (const rule of rules) {
    if (typeOf.get(rule.categoryId) === type && matchesKeyword(text, rule.keyword)) return rule.categoryId;
  }
  return FALLBACK[type];
}
