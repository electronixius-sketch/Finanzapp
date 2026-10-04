import { useState } from 'react';
import { RecurringForm } from './components/RecurringForm';
import { TransactionForm } from './components/TransactionForm';
import { Icons, useHashRoute } from './components/ui';
import { monthOf, todayISO } from './lib/dates';
import type { Recurring, Transaction } from './lib/types';
import { useStore } from './store';
import { Dashboard } from './views/Dashboard';
import { ImportView } from './views/ImportView';
import { RecurringView } from './views/RecurringView';
import { Settings } from './views/Settings';
import { Transactions } from './views/Transactions';

type Editor =
  | { kind: 'transaction'; item?: Transaction }
  | { kind: 'recurring'; item?: Recurring }
  | null;

const TABS = [
  { path: '/', label: 'Übersicht', icon: Icons.overview },
  { path: '/buchungen', label: 'Buchungen', icon: Icons.list },
  { path: '/fixkosten', label: 'Fixkosten', icon: Icons.repeat },
  { path: '/mehr', label: 'Mehr', icon: Icons.more },
];

export function App() {
  const route = useHashRoute();
  const { saveFailed } = useStore();
  const [month, setMonth] = useState(() => monthOf(todayISO()));
  const [editor, setEditor] = useState<Editor>(null);

  const addTransaction = () => setEditor({ kind: 'transaction' });
  const activeTab = route.path === '/import' ? '/mehr' : route.path;

  let view;
  switch (route.path) {
    case '/buchungen':
      view = (
        <Transactions route={route} month={month} setMonth={setMonth} onEdit={(item) => setEditor({ kind: 'transaction', item })} />
      );
      break;
    case '/fixkosten':
      view = (
        <RecurringView onAdd={() => setEditor({ kind: 'recurring' })} onEdit={(item) => setEditor({ kind: 'recurring', item })} />
      );
      break;
    case '/mehr':
      view = <Settings />;
      break;
    case '/import':
      view = <ImportView setMonth={setMonth} />;
      break;
    default:
      view = <Dashboard month={month} setMonth={setMonth} onAdd={addTransaction} />;
  }

  return (
    <div className="app">
      <nav className="tabbar" aria-label="Hauptnavigation">
        <div className="brand">
          <img src="icon.svg" alt="" />
          Finanzapp
        </div>
        {TABS.map((tab) => (
          <a key={tab.path} href={`#${tab.path}`} aria-current={activeTab === tab.path ? 'page' : undefined}>
            <tab.icon />
            {tab.label}
          </a>
        ))}
      </nav>

      <main className="content">
        {saveFailed && (
          <div className="banner" role="alert">
            ⚠ Speichern fehlgeschlagen – der Browser blockiert lokalen Speicher (privater Modus?). Lade ein Backup herunter,
            damit nichts verloren geht.
          </div>
        )}
        {view}
      </main>

      {(route.path === '/' || route.path === '/buchungen') && (
        <button type="button" className="fab" aria-label="Neue Buchung" onClick={addTransaction}>
          +
        </button>
      )}

      {editor?.kind === 'transaction' && <TransactionForm initial={editor.item} onClose={() => setEditor(null)} />}
      {editor?.kind === 'recurring' && <RecurringForm initial={editor.item} onClose={() => setEditor(null)} />}
    </div>
  );
}
