import { get, set } from 'idb-keyval';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { parseBackup } from './lib/backup';
import { todayISO } from './lib/dates';
import { createInitialData } from './lib/defaults';
import { materializeRecurring } from './lib/recurring';
import type { AppData } from './lib/types';

const KEY = 'finanzapp-data';

async function loadData(): Promise<AppData | null> {
  try {
    const stored = await get<AppData>(KEY);
    if (stored) return stored;
  } catch {
    // IndexedDB unavailable (e.g. some private modes) – try localStorage below.
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return parseBackup(raw);
  } catch {
    // Nothing stored or storage blocked.
  }
  return null;
}

async function saveData(data: AppData): Promise<boolean> {
  try {
    await set(KEY, data);
    return true;
  } catch {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }
}

interface Store {
  data: AppData;
  /** Applies a pure update; due recurring bookings are created automatically afterwards. */
  update: (fn: (data: AppData) => AppData) => void;
  replace: (data: AppData) => void;
  notify: (message: string) => void;
  saveFailed: boolean;
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore outside of StoreProvider');
  return store;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const timer = useRef<number>(undefined);

  const notify = useCallback((msg: string) => {
    setMessage(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 3200);
  }, []);

  const bookDue = useCallback(
    (d: AppData) => {
      const result = materializeRecurring(d, todayISO());
      if (result.created > 0) {
        notify(result.created === 1 ? '1 Fixkosten-Buchung angelegt' : `${result.created} Fixkosten-Buchungen angelegt`);
      }
      return result.data;
    },
    [notify],
  );

  // Kept in a ref so updates stay pure and back-to-back updates see each other.
  const current = useRef<AppData | null>(null);
  const commit = useCallback(
    (next: AppData) => {
      const booked = bookDue(next);
      current.current = booked;
      setData(booked);
    },
    [bookDue],
  );

  useEffect(() => {
    loadData().then((stored) => {
      commit(stored ?? createInitialData());
      // Ask the browser not to evict our data under storage pressure.
      navigator.storage?.persist?.().catch(() => undefined);
    });
  }, [commit]);

  // A PWA can stay open for days – book anything that became due meanwhile.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && current.current) commit(current.current);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [commit]);

  useEffect(() => {
    if (data) saveData(data).then((ok) => setSaveFailed(!ok));
  }, [data]);

  useEffect(() => {
    const theme = data?.settings.theme ?? 'system';
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [data?.settings.theme]);

  const update = useCallback(
    (fn: (d: AppData) => AppData) => {
      if (current.current) commit(fn(current.current));
    },
    [commit],
  );

  if (!data) return <div className="splash">Lade Daten …</div>;

  return (
    <StoreContext.Provider value={{ data, update, replace: commit, notify, saveFailed }}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {message && <div className="toast">{message}</div>}
      </div>
    </StoreContext.Provider>
  );
}
