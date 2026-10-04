import { BudgetList, CategoryBars, TrendChart } from '../components/charts';
import { MonthSwitcher, navigate } from '../components/ui';
import { addDays, formatDate, formatMonthShort, monthOf, shiftMonth, todayISO } from '../lib/dates';
import { createDemoData } from '../lib/demo';
import { formatCents, formatEuro, formatPercent, formatSigned } from '../lib/money';
import { upcoming } from '../lib/recurring';
import { budgetStatus, byCategory, savingsRate, totalsFor, trend } from '../lib/stats';
import { useStore } from '../store';

function Delta({ now, before, upIsGood, period }: { now: number; before: number; upIsGood: boolean; period: string }) {
  if (before === 0) return <div className="kpi-delta">{period}: –</div>;
  const change = (now - before) / before;
  if (Math.abs(change) < 0.005) return <div className="kpi-delta">gleich wie {period}</div>;
  const good = change > 0 === upIsGood;
  return (
    <div className={`kpi-delta ${good ? 'delta-good' : 'delta-bad'}`}>
      {change > 0 ? '▲' : '▼'} {formatPercent(Math.abs(change))} ggü. {period}
    </div>
  );
}

export function Dashboard({ month, setMonth, onAdd }: { month: string; setMonth: (m: string) => void; onAdd: () => void }) {
  const { data, replace, notify } = useStore();
  const { transactions, categories } = data;

  if (transactions.length === 0) {
    return (
      <>
        <header className="page-header">
          <h1>Übersicht</h1>
        </header>
        <div className="card empty">
          <div className="emoji">👋</div>
          <h2 style={{ color: 'var(--text)', margin: '8px 0' }}>Willkommen bei deiner Finanzapp</h2>
          <p>
            Erfasse Einnahmen und Ausgaben, importiere Kontoumsätze per CSV und behalte Budgets und Fixkosten im Blick.
            Alle Daten bleiben ausschließlich auf diesem Gerät.
          </p>
          <div className="btn-row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={onAdd}>
              Erste Buchung erfassen
            </button>
            <button type="button" className="btn" onClick={() => navigate('/import')}>
              Kontoauszug importieren (CSV)
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                replace({ ...createDemoData(todayISO()), settings: data.settings });
                notify('Demo-Daten geladen');
              }}
            >
              Mit Demo-Daten ausprobieren
            </button>
          </div>
        </div>
      </>
    );
  }

  const today = todayISO();
  // Mid-month, compare against the same days of the previous month instead of the whole month.
  const isCurrent = month === monthOf(today);
  const day = Number(today.slice(8, 10));
  const previousMonth = shiftMonth(month, -1);
  const period = isCurrent ? `1.–${day}. ${formatMonthShort(previousMonth)}` : 'Vormonat';
  const totals = totalsFor(transactions, month);
  const previous = totalsFor(transactions, previousMonth, isCurrent ? day : 31);
  const rate = savingsRate(totals);
  const spending = byCategory(transactions, month);
  const budgets = budgetStatus(categories, transactions, month);
  const due = upcoming(data.recurring, addDays(today, 30)).slice(0, 6);
  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      <header className="page-header">
        <h1>Übersicht</h1>
        <MonthSwitcher month={month} onChange={setMonth} />
      </header>

      <div className="stack">
        <section className="kpis" aria-label="Kennzahlen">
          <div className="card kpi">
            <div className="kpi-label">Einnahmen</div>
            <div className="kpi-value">{formatEuro(totals.income)}</div>
            <Delta now={totals.income} before={previous.income} upIsGood period={period} />
          </div>
          <div className="card kpi">
            <div className="kpi-label">Ausgaben</div>
            <div className="kpi-value">{formatEuro(totals.expense)}</div>
            <Delta now={totals.expense} before={previous.expense} upIsGood={false} period={period} />
          </div>
          <div className="card kpi">
            <div className="kpi-label">Saldo</div>
            <div className="kpi-value" style={totals.balance < 0 ? { color: 'var(--critical-text)' } : undefined}>
              {formatSigned(totals.balance, true)}
            </div>
            <div className="kpi-delta">Einnahmen − Ausgaben</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Sparquote</div>
            <div className="kpi-value">{rate === null ? '–' : formatPercent(rate)}</div>
            <div className="kpi-delta">vom Einkommen übrig</div>
          </div>
        </section>

        <div className="grid-2">
          <div className="stack">
          <section className="card">
            <div className="card-header">
              <h2>Ausgaben nach Kategorie</h2>
              <span className="card-sub">{formatCents(totals.expense)}</span>
            </div>
            {spending.length ? (
              <CategoryBars
                items={spending}
                categories={categories}
                onSelect={(id) => navigate('/buchungen', { kategorie: id })}
              />
            ) : (
              <p className="hint">Keine Ausgaben in diesem Monat.</p>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Verlauf der letzten 12 Monate</h2>
            </div>
            <TrendChart points={trend(transactions, month)} current={month} onSelect={setMonth} />
          </section>
          </div>

          <div className="stack">
            <section className="card">
              <div className="card-header">
                <h2>Budgets</h2>
              </div>
              {budgets.length ? (
                <BudgetList items={budgets} />
              ) : (
                <p className="hint">
                  Lege unter <a href="#/mehr">Mehr → Kategorien</a> monatliche Budgets fest, um hier den Verbrauch zu sehen.
                </p>
              )}
            </section>

            <section className="card">
              <div className="card-header">
                <h2>Nächste 30 Tage</h2>
                <a className="card-sub" href="#/fixkosten">
                  Fixkosten
                </a>
              </div>
              {due.length ? (
                <ul className="list">
                  {due.map(({ recurring: r, date }) => (
                    <li key={r.id + date}>
                      <div className="list-item" style={{ cursor: 'default' }}>
                        <span className="list-icon">{catById.get(r.categoryId)?.icon ?? '🔁'}</span>
                        <span className="list-main">
                          <div className="list-title">{r.note}</div>
                          <div className="list-sub">{formatDate(date)}</div>
                        </span>
                        <span className={`amount ${r.type}`}>
                          {r.type === 'income' ? '+' : '−'}
                          {formatCents(r.amount)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint">Keine anstehenden Fixkosten. Daueraufträge und Abos legst du unter „Fixkosten“ an.</p>
              )}
            </section>
          </div>
        </div>

      </div>
    </>
  );
}
