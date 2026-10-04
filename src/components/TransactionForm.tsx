import { useState, type FormEvent } from 'react';
import { todayISO } from '../lib/dates';
import { FALLBACK } from '../lib/defaults';
import { newId } from '../lib/id';
import { centsToInput, parseAmount } from '../lib/money';
import { categorize } from '../lib/rules';
import type { Transaction, TxType } from '../lib/types';
import { useStore } from '../store';
import { CategoryOptions, Modal, Segmented } from './ui';

export function TransactionForm({ initial, onClose }: { initial?: Transaction; onClose: () => void }) {
  const { data, update, notify } = useStore();
  const [type, setType] = useState<TxType>(initial?.type ?? 'expense');
  const [amount, setAmount] = useState(initial ? centsToInput(initial.amount) : '');
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? FALLBACK.expense);
  const [note, setNote] = useState(initial?.note ?? '');
  // Until the user picks a category, suggest one from the description.
  const [categoryTouched, setCategoryTouched] = useState(Boolean(initial));
  const [error, setError] = useState('');

  const changeType = (t: TxType) => {
    setType(t);
    if (data.categories.find((c) => c.id === categoryId)?.type !== t) {
      setCategoryId(categorize(note, t, data.rules, data.categories));
      setCategoryTouched(false);
    }
  };

  const changeNote = (text: string) => {
    setNote(text);
    if (!categoryTouched) setCategoryId(categorize(text, type, data.rules, data.categories));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(amount);
    if (cents === null || cents === 0) {
      setError('Bitte einen gültigen Betrag eingeben, z. B. 12,50.');
      return;
    }
    if (!date) {
      setError('Bitte ein Datum wählen.');
      return;
    }
    const tx: Transaction = {
      ...initial,
      id: initial?.id ?? newId(),
      type,
      amount: Math.abs(cents),
      date,
      categoryId,
      note: note.trim(),
    };
    update((d) => ({
      ...d,
      transactions: initial ? d.transactions.map((t) => (t.id === tx.id ? tx : t)) : [...d.transactions, tx],
    }));
    notify(initial ? 'Buchung aktualisiert' : 'Buchung gespeichert');
    onClose();
  };

  const remove = () => {
    if (!initial || !confirm('Diese Buchung wirklich löschen?')) return;
    update((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== initial.id) }));
    notify('Buchung gelöscht');
    onClose();
  };

  return (
    <Modal title={initial ? 'Buchung bearbeiten' : 'Neue Buchung'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <Segmented
          full
          label="Art der Buchung"
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
            autoComplete="off"
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
          <span>Beschreibung</span>
          <input
            className="input"
            placeholder={type === 'expense' ? 'z. B. REWE, Tankstelle, Kino' : 'z. B. Gehalt, Verkauf'}
            value={note}
            onChange={(e) => changeNote(e.target.value)}
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
            <span>Datum</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
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
