import { parseDate } from './dates';
import { parseAmount } from './money';

/** Bank exports are UTF-8 or Windows-1252 (Sparkasse, Volksbank, …). */
export function decodeBytes(buffer: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder('windows-1252').decode(buffer);
  }
  return text.replace(/^﻿/, '');
}

function countOutsideQuotes(line: string, ch: string): number {
  let count = 0;
  let quoted = false;
  for (const c of line) {
    if (c === '"') quoted = !quoted;
    else if (c === ch && !quoted) count++;
  }
  return count;
}

/** Picks the delimiter that splits the most lines into the same number of fields. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 50);
  let best = ';';
  let bestScore = -1;
  for (const d of [';', ',', '\t']) {
    const freq = new Map<number, number>();
    for (const line of lines) {
      const c = countOutsideQuotes(line, d);
      if (c > 0) freq.set(c, (freq.get(c) ?? 0) + 1);
    }
    for (const [count, lineCount] of freq) {
      const score = lineCount * 1000 + count;
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
  }
  return best;
}

/** RFC 4180-style parser: quoted fields, "" escapes, line breaks inside quotes. */
export function parseCSV(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f !== ''));
}

export type Field = 'date' | 'amount' | 'debit' | 'credit' | 'payee' | 'payer' | 'purpose';
export type Mapping = Record<Field, number>;

export const FIELD_LABEL: Record<Field, string> = {
  date: 'Datum',
  amount: 'Betrag',
  debit: 'Soll / Ausgang',
  credit: 'Haben / Eingang',
  payee: 'Empfänger / Gegenseite',
  payer: 'Auftraggeber (bei Eingängen)',
  purpose: 'Verwendungszweck',
};

// Patterns in priority order; the first header matching an earlier pattern wins.
const PATTERNS: Record<Field, RegExp[]> = {
  date: [/^buchungstag$/, /^buchungsdatum$/, /^buchung$/, /^datum$/, /^date$/, /buchungstag|buchungsdatum/, /datum|date/, /valuta|wertstellung/],
  amount: [/^betrag/, /^umsatz/, /^amount/, /betrag|umsatz|amount/],
  debit: [/^soll\b/, /^ausgang/, /debit/],
  credit: [/^haben\b/, /^eingang/, /credit/],
  payee: [/beg(ue|ü)nstigter/, /auftraggeber\s*\/\s*empf/, /zahlungsempf/, /zahlungsbeteiligt/, /empf(ä|ae)nger/, /^name/, /payee|counterparty|gegenseite|partner/],
  payer: [/zahlungspflichtig/],
  purpose: [/verwendungszweck/, /^buchungstext$/, /payment reference|reference|beschreibung|description|purpose/, /buchungstext|vorgang|umsatzart/],
};

const EXCLUDE: Partial<Record<Field, RegExp>> = {
  amount: /saldo|kontostand|balance|w(ä|ae)hrung|currency|fremd|ursprung|r(ü|ue)cklastschrift/,
  payee: /iban|bic|blz|konto/,
  payer: /iban|bic|blz|konto/,
  date: /valuta|wertstellung/,
};

const HEADER_HINT = /buchung|datum|date|betrag|umsatz|amount|verwendungszweck|empf|auftraggeber|payee|valuta/;

/**
 * Bank exports often start with account metadata ("Umsatzanzeige;Datei erstellt am …"),
 * so take the row that looks most like a header, not the first one that looks a bit like it.
 */
export function findHeaderRow(rows: string[][]): number {
  let best = 0;
  let bestHits = 0;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const hits = rows[i].filter((cell) => HEADER_HINT.test(cell.toLowerCase())).length;
    if (hits > bestHits) {
      best = i;
      bestHits = hits;
    }
  }
  return best;
}

export function guessMapping(header: string[]): Mapping {
  const lower = header.map((h) => h.toLowerCase());
  const taken = new Set<number>();
  const mapping = {} as Mapping;
  const order: Field[] = ['date', 'amount', 'payee', 'payer', 'purpose', 'debit', 'credit'];
  for (const field of order) {
    mapping[field] = -1;
    if ((field === 'debit' || field === 'credit') && mapping.amount >= 0) continue;
    search: for (const pattern of PATTERNS[field]) {
      for (let i = 0; i < lower.length; i++) {
        if (taken.has(i) || !pattern.test(lower[i])) continue;
        // Valuta is only acceptable as the last-resort date pattern.
        if (EXCLUDE[field]?.test(lower[i]) && !(field === 'date' && pattern === PATTERNS.date.at(-1))) continue;
        mapping[field] = i;
        taken.add(i);
        break search;
      }
    }
  }
  return mapping;
}

export interface Draft {
  row: number;
  date: string | null;
  /** Signed cents: negative = money going out. */
  amount: number | null;
  payee: string;
  purpose: string;
}

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

export function toDrafts(rows: string[][], headerRow: number, mapping: Mapping): Draft[] {
  const drafts: Draft[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (f: Field) => (mapping[f] >= 0 ? row[mapping[f]] : undefined);

    let amount: number | null = null;
    if (mapping.amount >= 0) {
      amount = parseAmount(get('amount') ?? '');
    } else if (mapping.debit >= 0 || mapping.credit >= 0) {
      const debit = parseAmount(get('debit') ?? '');
      const credit = parseAmount(get('credit') ?? '');
      if (debit) amount = -Math.abs(debit);
      else if (credit) amount = Math.abs(credit);
    }

    let payee = clean(get('payee'));
    const payer = clean(get('payer'));
    if (payer && (amount ?? 0) > 0) payee = payer;
    else if (!payee) payee = payer;

    // Rows like "Kontostand am …" or footers have neither a date nor an amount.
    const date = parseDate(get('date') ?? '');
    if (!date && amount === null) continue;
    drafts.push({ row: r, date, amount, payee, purpose: clean(get('purpose')) });
  }
  return drafts;
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Stable fingerprint per bank row. Identical rows in one file (two coffees on the
 * same day) get an occurrence suffix so they stay distinct but re-importing the
 * same file still matches.
 */
export function importHashes(drafts: Draft[]): string[] {
  const seen = new Map<string, number>();
  return drafts.map((d) => {
    const base = fnv1a([d.date, d.amount, d.payee.toLowerCase(), d.purpose.toLowerCase()].join('|'));
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}-${n}`;
  });
}
