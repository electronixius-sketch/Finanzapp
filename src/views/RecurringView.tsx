import { formatDate } from '../lib/dates';
import { formatCents, formatEuro, formatSigned } from '../lib/money';
import { INTERVAL_LABEL, monthlyEquivalent } from '../lib/recurring';
import type { Recurring, TxType } from '../lib/types';
import { useStore } from '../store';

export function RecurringView({ onEdit, onAdd }: { onEdit: (r: Recurring) => void; onAdd: () => void }) {
  const { data } = useStore();
  const catById = new Map(data.categories.map((c) => [c.id, c]));
  const perMonth = (type: TxType) =>
    data.recurring.filter((r) => r.active && r.type === type).reduce((s, r) => s + monthlyEquivalent(r), 0);
  const fixedCosts = perMonth('expense');
  const fixedIncome = perMonth('income');

  const section = (type: TxType, title: string) => {
    const items = data.recurring
      .filter((r) => r.type === type)
      .sort((a, b) => Number(b.active) - Number(a.active) || b.amount - a.amount);
    if (!items.length) return null;
    return (
      <section className="card">
        <div className="card-header">
          <h2>{title}</h2>
        </div>
        <ul className="list">
          {items.map((r) => (
            <li key={r.id}>
              <button type="button" className={`list-item${r.active ? '' : ' muted-item'}`} onClick={() => onEdit(r)}>
                <span className="list-icon" aria-hidden>
                  {catById.get(r.categoryId)?.icon ?? '🔁'}
                </span>
                <span className="list-main">
                  <div className="list-title">
                    {r.note} {!r.active && <span className="badge">pausiert</span>}
                  </div>
                  <div className="list-sub">
                    {INTERVAL_LABEL[r.interval]}
                    {r.active && ` · ${formatDate(r.nextDate)}`}
                    {r.interval !== 'monthly' && ` · ≈ ${formatCents(monthlyEquivalent(r))}/Monat`}
                  </div>
                </span>
                <span className={`amount ${r.type}`}>
                  {r.type === 'income' ? '+' : '−'}
                  {formatCents(r.amount)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <>
      <header className="page-header">
        <h1>Fixkosten</h1>
        <button type="button" className="btn btn-primary btn-small" onClick={onAdd}>
          + Neu
        </button>
      </header>

      <div className="stack">
        <section className="kpis" aria-label="Monatliche Fixbeträge">
          <div className="card kpi">
            <div className="kpi-label">Fixkosten / Monat</div>
            <div className="kpi-value">{formatEuro(fixedCosts)}</div>
            <div className="kpi-delta">≈ {formatEuro(fixedCosts * 12)} im Jahr</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Feste Einnahmen / Monat</div>
            <div className="kpi-value">{formatEuro(fixedIncome)}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Frei verfügbar</div>
            <div className="kpi-value">{formatSigned(fixedIncome - fixedCosts, true)}</div>
            <div className="kpi-delta">nach Fixkosten</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Fixkostenquote</div>
            <div className="kpi-value">{fixedIncome > 0 ? `${Math.round((fixedCosts / fixedIncome) * 100)} %` : '–'}</div>
            <div className="kpi-delta">der festen Einnahmen</div>
          </div>
        </section>

        {data.recurring.length === 0 ? (
          <div className="card empty">
            <div className="emoji">🔁</div>
            <p>
              Lege hier Miete, Abos, Versicherungen oder dein Gehalt an. Sie werden am Fälligkeitstag automatisch als
              Buchung eingetragen – so siehst du sofort, was nach den Fixkosten übrig bleibt.
            </p>
            <button type="button" className="btn btn-primary" onClick={onAdd}>
              Ersten Eintrag anlegen
            </button>
          </div>
        ) : (
          <>
            {section('expense', 'Ausgaben')}
            {section('income', 'Einnahmen')}
          </>
        )}
      </div>
    </>
  );
}
