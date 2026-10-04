import { useState, type FormEvent } from 'react';
import { addMonths, todayISO } from '../lib/dates';
import { FALLBACK } from '../lib/defaults';
import { newId } from '../lib/id';
import { centsToInput, parseAmount } from '../lib/money';
import { INTERVAL_LABEL } from '../lib/recurring';
import { categorize } from '../lib/rules';
import type { Interval, Recurring, TxType } from '../lib/types';
import { useStore } from '../store';
import { CategoryOptions, Modal, Segmented } from './ui';

export function RecurringForm({ initial, onClose }: { initial?: Recurring; onClose: () => void }) {
  const { data, update, notify } = useStore();
  const [type, setType] = useState<TxType>(initial?.type ?? 'expense');
  const [amount, setAmount] = useState(initial ? centsToInput(initial.amount) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? FALLBACK.expense);
  const [categoryTouched, setCategoryTouched] = useState(Boolean(initial));
  const [rhythm, setRhythm] = useState<Interval>(initial?.interval ?? 'monthly');
  // New items start next month by default so nothing is booked twice by accident.
  const [nextDate, setNextDate] = useState(initial?.nextDate ?? addMonths(todayISO(), 1));
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState('');

  const changeType = (t: TxType) => {
    setType(t);
    setCategoryId(categorize(note, t, data.rules, data.categories));
    setCategoryTouched(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(amount);
    if (cents === null || cents === 0) return setError('Bitte einen gültigen Betrag eingeben.');
    if (!note.trim()) return setError('Bitte eine Bezeichnung eingeben, z. B. „Miete“.');
    if (!nextDate) return setError('Bitte ein Datum wählen.');
    const item: Recurring = {
      id: initial?.id ?? newId(),
      type,
      amount: Math.abs(cents),
      note: note.trim(),
      categoryId,
      interval: rhythm,
      day: Number(nextDate.slice(8, 10)),
      nextDate,
      active,
    };
    update((d) => ({
      ...d,
      recurring: initial ? d.recurring.map((r) => (r.id === item.id ? item : r)) : [...d.recurring, item],
    }));
    notify(initial ? 'Fixkosten aktualisiert' : 'Fixkosten angelegt');
    onClose();
  };

  const remove = () => {
    if (!initial || !confirm(`„${initial.note}“ löschen? Bereits gebuchte Einträge bleiben erhalten.`)) return;
    update((d) => ({ ...d, recurring: d.recurring.filter((r) => r.id !== initial.id) }));
    notify('Fixkosten gelöscht');
    onClose();
  };

  const isPast = nextDate && nextDate <= todayISO();

  return (
    <Modal title={initial ? 'Fixkosten bearbeiten' : 'Neue Fixkosten / Dauerauftrag'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <Segmented
          full
          label="Art"
          value={type}
          onChange={changeType}
          options={[
            ['expense', 'Ausgabe'],
            ['income', 'Einnahme'],
          ]}
        />
        <label className="field">
          <span>Betrag in €</span>
          <input
            className="input input-amount"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            autoFocus={!initial}
          />
        </label>
        <label className="field">
          <span>Bezeichnung</span>
          <input
            className="input"
            placeholder="z. B. Miete, Netflix, Gehalt"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setError('');
              if (!categoryTouched) setCategoryId(categorize(e.target.value, type, data.rules, data.categories));
            }}
          />
        </label>
        <div className="form-row">
          <label className="field">
            <span>Kategorie</span>
            <select
              className="input"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setCategoryTouched(true);
              }}
            >
              <CategoryOptions categories={data.categories} type={type} />
            </select>
          </label>
          <label className="field">
            <span>Rhythmus</span>
            <select className="input" value={rhythm} onChange={(e) => setRhythm(e.target.value as Interval)}>
              {(Object.keys(INTERVAL_LABEL) as Interval[]).map((i) => (
                <option key={i} value={i}>
                  {INTERVAL_LABEL[i]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Nächste Buchung am</span>
          <input className="input" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        </label>
        {isPast && active && (
          <p className="hint">Das Datum liegt nicht in der Zukunft – fällige Buchungen werden beim Speichern sofort angelegt.</p>
        )}
        <label className="checkbox">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Aktiv (automatisch buchen)
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          {initial && (
            <button type="button" className="btn btn-danger" onClick={remove}>
              Löschen
            </button>
          )}
          <button type="submit" className="btn btn-primary">
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}
