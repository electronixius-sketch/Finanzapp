import { useMemo, useState } from 'react';
import { Amount, MonthSwitcher, navigate, Segmented, type Route } from '../components/ui';
import { formatDate, formatDay, monthOf } from '../lib/dates';
import { formatSigned } from '../lib/money';
import type { Transaction, TxType } from '../lib/types';
import { useStore } from '../store';

type TypeFilter = 'all' | TxType;

export function Transactions({
  route,
  month,
  setMonth,
  onEdit,
}: {
  route: Route;
  month: string;
  setMonth: (m: string) => void;
  onEdit: (t: Transaction) => void;
}) {
  const { data } = useStore();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const categoryFilter = route.params.get('kategorie') ?? '';
  const catById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);

  const q = query.trim().toLocaleLowerCase('de-DE');
  // A search looks through all months – you rarely remember when something was booked.
  const filtered = data.transactions
    .filter((t) => (q ? true : monthOf(t.date) === month))
    .filter((t) => typeFilter === 'all' || t.type === typeFilter)
    .filter((t) => !categoryFilter || t.categoryId === categoryFilter)
    .filter((t) => {
      if (!q) return true;
      const name = catById.get(t.categoryId)?.name ?? '';
      return `${t.note} ${name}`.toLocaleLowerCase('de-DE').includes(q);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const groups: { date: string; items: Transaction[] }[] = [];
  for (const t of filtered) {
    const last = groups[groups.length - 1];
    if (last?.date === t.date) last.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  }
  const net = filtered.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);

  const setCategory = (id: string) => navigate('/buchungen', id ? { kategorie: id } : undefined);

  return (
    <>
      <header className="page-header">
        <h1>Buchungen</h1>
        {!q && <MonthSwitcher month={month} onChange={setMonth} />}
      </header>

      <div className="filters">
        <input
          className="input"
          type="search"
          placeholder="Suchen in allen Monaten …"
          aria-label="Buchungen durchsuchen"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input"
          aria-label="Kategorie filtern"
          value={categoryFilter}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Alle Kategorien</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <Segmented
          label="Art filtern"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            ['all', 'Alle'],
            ['expense', 'Ausgaben'],
            ['income', 'Einnahmen'],
          ]}
        />
      </div>

      <section className="card">
        <div className="summary-line">
          <span>
            {filtered.length} {filtered.length === 1 ? 'Buchung' : 'Buchungen'}
            {q && ' (alle Monate)'}
          </span>
          <span>Summe: {formatSigned(net)}</span>
        </div>
        {groups.length === 0 ? (
          <div className="empty">
            <div className="emoji">🧾</div>
            <p>
              {q || categoryFilter || typeFilter !== 'all'
                ? 'Keine passenden Buchungen gefunden.'
                : 'In diesem Monat gibt es noch keine Buchungen.'}
            </p>
          </div>
        ) : (
          groups.map((g) => {
            const daySum = g.items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
            return (
              <div key={g.date} className="day-group">
                <div className="day-header">
                  <span>{q ? formatDate(g.date) : formatDay(g.date)}</span>
                  <span>{formatSigned(daySum)}</span>
                </div>
                <ul className="list">
                  {g.items.map((t) => {
                    const c = catById.get(t.categoryId);
                    return (
                      <li key={t.id}>
                        <button type="button" className="list-item" onClick={() => onEdit(t)}>
                          <span className="list-icon" aria-hidden>
                            {c?.icon ?? '❔'}
                          </span>
                          <span className="list-main">
                            <div className="list-title">{t.note || c?.name || 'Ohne Beschreibung'}</div>
                            <div className="list-sub">
                              {c?.name ?? 'Unbekannte Kategorie'}
                              {t.recurringId && ' · Fixkosten'}
                            </div>
                          </span>
                          <Amount cents={t.amount} type={t.type} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
