import { useRef, useState, type FormEvent } from 'react';
import { CategoryOptions, Modal, navigate, Segmented } from '../components/ui';
import { download, parseBackup, serializeBackup, transactionsToCSV } from '../lib/backup';
import { formatDate, todayISO } from '../lib/dates';
import { createInitialData, FALLBACK } from '../lib/defaults';
import { createDemoData } from '../lib/demo';
import { newId } from '../lib/id';
import { centsToInput, formatEuro, parseAmount } from '../lib/money';
import { categorize } from '../lib/rules';
import type { Category, Theme, TxType } from '../lib/types';
import { useStore } from '../store';

function CategoryForm({ initial, type, onClose }: { initial?: Category; type: TxType; onClose: () => void }) {
  const { data, update, notify } = useStore();
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '🏷️');
  const [budget, setBudget] = useState(initial?.budget ? centsToInput(initial.budget) : '');
  const [error, setError] = useState('');
  const isFallback = initial && Object.values(FALLBACK).includes(initial.id);
  const used = initial ? data.transactions.filter((t) => t.categoryId === initial.id).length : 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Bitte einen Namen eingeben.');
    const cents = budget.trim() ? parseAmount(budget) : null;
    if (budget.trim() && (cents === null || cents < 0)) return setError('Das Budget ist kein gültiger Betrag.');
    const category: Category = {
      id: initial?.id ?? newId(),
      type: initial?.type ?? type,
      name: name.trim(),
      icon: icon.trim() || '🏷️',
      ...(cents ? { budget: cents } : {}),
    };
    update((d) => ({
      ...d,
      categories: initial ? d.categories.map((c) => (c.id === category.id ? category : c)) : [...d.categories, category],
    }));
    onClose();
  };

  const remove = () => {
    if (!initial || isFallback) return;
    const fallback = FALLBACK[initial.type];
    const msg = used
      ? `„${initial.name}“ löschen? ${used} Buchungen werden nach „${data.categories.find((c) => c.id === fallback)?.name}“ verschoben.`
      : `„${initial.name}“ löschen?`;
    if (!confirm(msg)) return;
    update((d) => ({
      ...d,
      categories: d.categories.filter((c) => c.id !== initial.id),
      transactions: d.transactions.map((t) => (t.categoryId === initial.id ? { ...t, categoryId: fallback } : t)),
      recurring: d.recurring.map((r) => (r.categoryId === initial.id ? { ...r, categoryId: fallback } : r)),
      rules: d.rules.filter((r) => r.categoryId !== initial.id),
    }));
    notify('Kategorie gelöscht');
    onClose();
  };

  return (
    <Modal title={initial ? 'Kategorie bearbeiten' : 'Neue Kategorie'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="form-row" style={{ gridTemplateColumns: '84px 1fr' }}>
          <label className="field">
            <span>Symbol</span>
            <input className="input" style={{ textAlign: 'center', fontSize: 22 }} value={icon} onChange={(e) => setIcon(e.target.value)} />
          </label>
          <label className="field">
            <span>Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!initial} />
          </label>
        </div>
        {(initial?.type ?? type) === 'expense' && (
          <label className="field">
            <span>Monatliches Budget in € (optional)</span>
            <input className="input" inputMode="decimal" placeholder="z. B. 400" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </label>
        )}
        {initial && <p className="hint">{used} Buchungen in dieser Kategorie.</p>}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          {initial && !isFallback && (
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

function Categories() {
  const { data } = useStore();
  const [editing, setEditing] = useState<{ category?: Category; type: TxType } | null>(null);

  const group = (type: TxType, title: string) => (
    <>
      <div className="card-header" style={{ marginTop: type === 'income' ? 16 : 0 }}>
        <h2>{title}</h2>
        <button type="button" className="link-btn" onClick={() => setEditing({ type })}>
          + Kategorie
        </button>
      </div>
      <ul className="list">
        {data.categories
          .filter((c) => c.type === type)
          .map((c) => (
            <li key={c.id}>
              <button type="button" className="list-item" onClick={() => setEditing({ category: c, type })}>
                <span className="list-icon" aria-hidden>
                  {c.icon}
                </span>
                <span className="list-main">
                  <div className="list-title">{c.name}</div>
                </span>
                {c.budget ? <span className="card-sub">Budget {formatEuro(c.budget)}</span> : null}
              </button>
            </li>
          ))}
      </ul>
    </>
  );

  return (
    <section className="card">
      {group('expense', 'Ausgaben-Kategorien & Budgets')}
      {group('income', 'Einnahmen-Kategorien')}
      {editing && <CategoryForm initial={editing.category} type={editing.type} onClose={() => setEditing(null)} />}
    </section>
  );
}

function Rules() {
  const { data, update, notify } = useStore();
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('groceries');
  const catById = new Map(data.categories.map((c) => [c.id, c]));
  const categoryExists = catById.has(categoryId);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !categoryExists) return;
    // New rules go first so they win over the built-in defaults.
    update((d) => ({ ...d, rules: [{ id: newId(), keyword: keyword.trim(), categoryId }, ...d.rules] }));
    setKeyword('');
    notify('Regel hinzugefügt');
  };

  const applyToUncategorized = () => {
    let changed = 0;
    update((d) => ({
      ...d,
      transactions: d.transactions.map((t) => {
        if (t.categoryId !== FALLBACK[t.type]) return t;
        const next = categorize(t.note, t.type, d.rules, d.categories);
        if (next === t.categoryId) return t;
        changed++;
        return { ...t, categoryId: next };
      }),
    }));
    notify(changed ? `${changed} Buchungen neu zugeordnet` : 'Keine Buchungen zum Zuordnen gefunden');
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>Automatische Zuordnung</h2>
      </div>
      <p className="hint">
        Enthält die Beschreibung einer Buchung ein Stichwort, wird sie automatisch der Kategorie zugeordnet – bei der
        Eingabe und beim CSV-Import. Die erste passende Regel gewinnt.
      </p>
      <form className="rule-form" onSubmit={add}>
        <input className="input" placeholder="Stichwort, z. B. bäckerei" aria-label="Stichwort" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <select className="input" aria-label="Kategorie" value={categoryExists ? categoryId : ''} onChange={(e) => setCategoryId(e.target.value)}>
          {!categoryExists && <option value="">Kategorie wählen</option>}
          <optgroup label="Ausgaben">
            <CategoryOptions categories={data.categories} type="expense" />
          </optgroup>
          <optgroup label="Einnahmen">
            <CategoryOptions categories={data.categories} type="income" />
          </optgroup>
        </select>
        <button type="submit" className="btn btn-primary" disabled={!keyword.trim() || !categoryExists}>
          Hinzufügen
        </button>
      </form>
      <details>
        <summary>Alle {data.rules.length} Regeln anzeigen</summary>
        <div className="rule-list">
          {data.rules.map((r) => {
            const c = catById.get(r.categoryId);
            return (
              <div key={r.id} className="rule-item">
                <code>{r.keyword}</code>
                <span className="grow">
                  → {c?.icon} {c?.name}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Regel ${r.keyword} löschen`}
                  onClick={() => update((d) => ({ ...d, rules: d.rules.filter((x) => x.id !== r.id) }))}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </details>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-small" onClick={applyToUncategorized}>
          Regeln auf „Sonstiges“-Buchungen anwenden
        </button>
      </div>
    </section>
  );
}

function Backup() {
  const { data, update, replace, notify } = useStore();
  const fileInput = useRef<HTMLInputElement>(null);

  const exportBackup = () => {
    download(`finanzapp-backup-${todayISO()}.json`, serializeBackup(data), 'application/json');
    update((d) => ({ ...d, settings: { ...d.settings, lastBackup: todayISO() } }));
  };

  const restore = async (file: File) => {
    try {
      const restored = parseBackup(await file.text());
      if (!confirm(`Backup mit ${restored.transactions.length} Buchungen wiederherstellen? Die aktuellen Daten werden ersetzt.`)) return;
      replace(restored);
      notify('Backup wiederhergestellt');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Backup konnte nicht gelesen werden.');
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>Datensicherung</h2>
      </div>
      <p className="hint">
        Deine Daten werden nur in diesem Browser auf diesem Gerät gespeichert – ohne Konto und ohne Cloud. Lade
        regelmäßig ein Backup herunter, z. B. bevor du Browserdaten löschst oder das Gerät wechselst.
        {data.settings.lastBackup ? ` Letztes Backup: ${formatDate(data.settings.lastBackup)}.` : ' Bisher kein Backup erstellt.'}
      </p>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-primary btn-small" onClick={exportBackup}>
          Backup herunterladen
        </button>
        <button type="button" className="btn btn-small" onClick={() => fileInput.current?.click()}>
          Backup wiederherstellen
        </button>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => download(`finanzapp-buchungen-${todayISO()}.csv`, transactionsToCSV(data), 'text/csv')}
        >
          Als CSV exportieren (Excel)
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) restore(file);
            e.target.value = '';
          }}
        />
      </div>
    </section>
  );
}

export function Settings() {
  const { data, update, replace, notify } = useStore();

  return (
    <>
      <header className="page-header">
        <h1>Mehr</h1>
      </header>
      <div className="stack">
        <section className="card">
          <div className="card-header">
            <h2>Kontoumsätze importieren</h2>
          </div>
          <p className="hint">
            Exportiere deine Umsätze im Online-Banking als CSV-Datei (z. B. Sparkasse, ING, DKB, comdirect, N26, Volksbank)
            und importiere sie hier. Bereits importierte Buchungen werden erkannt und übersprungen.
          </p>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primary btn-small" onClick={() => navigate('/import')}>
              CSV importieren
            </button>
          </div>
        </section>

        <Categories />
        <Rules />
        <Backup />

        <section className="card">
          <div className="card-header">
            <h2>Darstellung</h2>
          </div>
          <Segmented<Theme>
            label="Farbschema"
            value={data.settings.theme}
            onChange={(theme) => update((d) => ({ ...d, settings: { ...d.settings, theme } }))}
            options={[
              ['system', 'System'],
              ['light', 'Hell'],
              ['dark', 'Dunkel'],
            ]}
          />
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Daten zurücksetzen</h2>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                if (!confirm('Demo-Daten laden? Deine aktuellen Daten werden dabei ersetzt.')) return;
                replace({ ...createDemoData(todayISO()), settings: data.settings });
                notify('Demo-Daten geladen');
                navigate('/');
              }}
            >
              Demo-Daten laden
            </button>
            <button
              type="button"
              className="btn btn-small btn-danger"
              onClick={() => {
                if (!confirm('Wirklich ALLE Buchungen, Fixkosten, Kategorien und Regeln löschen? Das lässt sich nicht rückgängig machen.')) return;
                replace({ ...createInitialData(), settings: data.settings });
                notify('Alle Daten gelöscht');
                navigate('/');
              }}
            >
              Alle Daten löschen
            </button>
          </div>
        </section>

        <p className="hint" style={{ textAlign: 'center' }}>
          Finanzapp · Daten bleiben auf deinem Gerät · kein Tracking
        </p>
      </div>
    </>
  );
}
