import { useMemo, useState } from 'react';
import { CategoryOptions, navigate } from '../components/ui';
import {
  decodeBytes,
  FIELD_LABEL,
  findHeaderRow,
  guessMapping,
  importHashes,
  parseCSV,
  toDrafts,
  type Field,
  type Mapping,
} from '../lib/csv';
import { formatDate, monthOf } from '../lib/dates';
import { newId } from '../lib/id';
import { formatCents } from '../lib/money';
import { categorize } from '../lib/rules';
import type { Transaction, TxType } from '../lib/types';
import { useStore } from '../store';

interface Parsed {
  fileName: string;
  rows: string[][];
  headerRow: number;
  mapping: Mapping;
}

type Status = 'new' | 'duplicate' | 'invalid';

const MAIN_FIELDS: Field[] = ['date', 'amount', 'payee', 'purpose'];
// Only needed for some banks (DKB: separate payer column; Postbank & co.: Soll/Haben columns).
const EXTRA_FIELDS: Field[] = ['payer', 'debit', 'credit'];

export function ImportView({ setMonth }: { setMonth: (m: string) => void }) {
  const { data, update, notify } = useStore();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState('');
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [overrides, setOverrides] = useState<Map<number, string>>(new Map());

  const readFile = async (file: File) => {
    setError('');
    try {
      const rows = parseCSV(decodeBytes(await file.arrayBuffer()));
      if (rows.length < 2) throw new Error('Die Datei enthält keine Umsätze.');
      const headerRow = findHeaderRow(rows);
      setParsed({ fileName: file.name, rows, headerRow, mapping: guessMapping(rows[headerRow]) });
      setExcluded(new Set());
      setIncluded(new Set());
      setOverrides(new Map());
    } catch (err) {
      setParsed(null);
      setError(err instanceof Error ? err.message : 'Die Datei konnte nicht gelesen werden.');
    }
  };

  const existing = useMemo(
    () => new Set(data.transactions.map((t) => t.importHash).filter(Boolean)),
    [data.transactions],
  );

  const candidates = useMemo(() => {
    if (!parsed) return [];
    const drafts = toDrafts(parsed.rows, parsed.headerRow, parsed.mapping);
    const hashes = importHashes(drafts);
    return drafts.map((d, i) => {
      const valid = d.date !== null && d.amount !== null && d.amount !== 0;
      const type: TxType = (d.amount ?? 0) > 0 ? 'income' : 'expense';
      const status: Status = !valid ? 'invalid' : existing.has(hashes[i]) ? 'duplicate' : 'new';
      return {
        draft: d,
        hash: hashes[i],
        type,
        status,
        suggested: categorize(`${d.payee} ${d.purpose}`, type, data.rules, data.categories),
      };
    });
  }, [parsed, existing, data.rules, data.categories]);

  const typeOf = new Map(data.categories.map((c) => [c.id, c.type]));
  // An override only counts while it fits the direction (changing the amount column can flip it).
  const categoryFor = (c: (typeof candidates)[number]) => {
    const override = overrides.get(c.draft.row);
    return override && typeOf.get(override) === c.type ? override : c.suggested;
  };

  const isSelected = (row: number, status: Status) =>
    status === 'new' ? !excluded.has(row) : status === 'duplicate' ? included.has(row) : false;
  const selected = candidates.filter((c) => isSelected(c.draft.row, c.status));
  const counts = {
    new: candidates.filter((c) => c.status === 'new').length,
    duplicate: candidates.filter((c) => c.status === 'duplicate').length,
    invalid: candidates.filter((c) => c.status === 'invalid').length,
  };

  const toggle = (row: number, status: Status, on: boolean) => {
    const [set, setter] = status === 'new' ? [excluded, setExcluded] : [included, setIncluded];
    const next = new Set(set);
    if ((status === 'new') !== on) next.add(row);
    else next.delete(row);
    setter(next);
  };

  const setMapping = (field: Field, index: number) => {
    if (!parsed) return;
    setParsed({ ...parsed, mapping: { ...parsed.mapping, [field]: index } });
  };

  const runImport = () => {
    const transactions: Transaction[] = selected.map((c) => ({
      id: newId(),
      date: c.draft.date!,
      amount: Math.abs(c.draft.amount!),
      type: c.type,
      categoryId: categoryFor(c),
      note: (c.draft.payee || c.draft.purpose).slice(0, 140),
      importHash: c.hash,
    }));
    update((d) => ({ ...d, transactions: [...d.transactions, ...transactions] }));
    notify(`${transactions.length} Buchungen importiert`);
    const latest = transactions.reduce((m, t) => (t.date > m ? t.date : m), '');
    if (latest) setMonth(monthOf(latest));
    navigate('/buchungen');
  };

  const header = parsed ? parsed.rows[parsed.headerRow] : [];

  const fieldSelect = (field: Field) =>
    parsed && (
      <label key={field} className="field">
        <span>{FIELD_LABEL[field]}</span>
        <select className="input" value={parsed.mapping[field]} onChange={(e) => setMapping(field, Number(e.target.value))}>
          <option value={-1}>– keine –</option>
          {header.map((h, i) => (
            <option key={i} value={i}>
              {h || `Spalte ${i + 1}`}
            </option>
          ))}
        </select>
      </label>
    );

  return (
    <>
      <header className="page-header">
        <h1>CSV-Import</h1>
        <a className="btn btn-small" href="#/mehr">
          Zurück
        </a>
      </header>

      <div className="stack">
        <section className="card">
          <label className="dropzone">
            <span style={{ fontSize: 36 }} aria-hidden>
              📄
            </span>
            <strong>{parsed ? parsed.fileName : 'CSV-Datei auswählen'}</strong>
            <span className="hint">
              {parsed ? 'Andere Datei wählen' : 'Umsatzexport aus dem Online-Banking (.csv)'}
            </span>
            <input
              type="file"
              accept=".csv,.txt,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readFile(file);
                e.target.value = '';
              }}
            />
          </label>
          {error && (
            <p className="form-error" style={{ marginTop: 12 }}>
              {error}
            </p>
          )}
          {!parsed && (
            <p className="hint" style={{ marginTop: 12 }}>
              So geht’s: Im Online-Banking die Umsatzliste öffnen, Zeitraum wählen und „Export → CSV“ (bei manchen
              Banken „CSV-CAMT“ oder „Excel“) herunterladen. Die Datei wird nur lokal in deinem Browser gelesen.
            </p>
          )}
        </section>

        {parsed && (
          <section className="card">
            <div className="card-header">
              <h2>Spalten zuordnen</h2>
            </div>
            <p className="hint" style={{ marginBottom: 12 }}>
              Die Spalten wurden automatisch erkannt. Prüfe die Vorschau unten und korrigiere die Zuordnung bei Bedarf.
            </p>
            <div className="mapping">
              {MAIN_FIELDS.map(fieldSelect)}
              <label className="field">
                <span>Zeile mit Spaltennamen</span>
                <select
                  className="input"
                  value={parsed.headerRow}
                  onChange={(e) => {
                    const headerRow = Number(e.target.value);
                    setParsed({ ...parsed, headerRow, mapping: guessMapping(parsed.rows[headerRow]) });
                  }}
                >
                  {parsed.rows.slice(0, 40).map((row, i) => (
                    <option key={i} value={i}>
                      Zeile {i + 1}: {row.slice(0, 3).join(' · ').slice(0, 40)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <details open={EXTRA_FIELDS.some((f) => parsed.mapping[f] >= 0)} style={{ marginTop: 12 }}>
              <summary>Weitere Spalten (Auftraggeber, Soll/Haben)</summary>
              <div className="mapping" style={{ marginTop: 12 }}>
                {EXTRA_FIELDS.map(fieldSelect)}
              </div>
            </details>
          </section>
        )}

        {parsed && (
          <section className="card">
            <div className="card-header">
              <h2>Vorschau</h2>
              <span className="card-sub">
                {counts.new} neu · {counts.duplicate} schon vorhanden{counts.invalid ? ` · ${counts.invalid} unlesbar` : ''}
              </span>
            </div>
            {candidates.length === 0 ? (
              <p className="hint">Keine Umsätze gefunden – stimmt die Kopfzeile?</p>
            ) : (
              <div className="table-scroll">
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>
                        <span className="visually-hidden">Importieren</span>
                      </th>
                      <th>Datum</th>
                      <th>Beschreibung</th>
                      <th>Kategorie</th>
                      <th style={{ textAlign: 'right' }}>Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => {
                      const on = isSelected(c.draft.row, c.status);
                      return (
                        <tr key={c.draft.row} className={on ? '' : 'skip'}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label="Importieren"
                              checked={on}
                              disabled={c.status === 'invalid'}
                              onChange={(e) => toggle(c.draft.row, c.status, e.target.checked)}
                            />
                          </td>
                          <td>{c.draft.date ? formatDate(c.draft.date) : '–'}</td>
                          <td className="desc">
                            <div>{c.draft.payee || c.draft.purpose || '–'}</div>
                            <div className="list-sub">
                              {c.status === 'duplicate'
                                ? 'bereits importiert'
                                : c.status === 'invalid'
                                  ? 'Datum oder Betrag nicht lesbar'
                                  : c.draft.payee && c.draft.purpose}
                            </div>
                          </td>
                          <td>
                            {c.status !== 'invalid' && (
                              <select
                                className="input"
                                aria-label="Kategorie"
                                value={categoryFor(c)}
                                onChange={(e) => setOverrides(new Map(overrides).set(c.draft.row, e.target.value))}
                              >
                                <CategoryOptions categories={data.categories} type={c.type} />
                              </select>
                            )}
                          </td>
                          <td className="num">
                            {c.draft.amount !== null ? (
                              <span className={`amount ${c.type}`}>
                                {c.type === 'income' ? '+' : '−'}
                                {formatCents(Math.abs(c.draft.amount))}
                              </span>
                            ) : (
                              '–'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="import-summary">
              <span>
                <strong>{selected.length}</strong> ausgewählt
              </span>
              <button type="button" className="btn btn-primary btn-small" disabled={selected.length === 0} onClick={runImport}>
                Importieren
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
