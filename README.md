# Finanzapp

Ein schlankes Haushaltsbuch als Web-App (PWA): Einnahmen und Ausgaben erfassen, Kontoumsätze per CSV
importieren, Budgets und Fixkosten im Blick behalten. **Alle Daten bleiben lokal im Browser** – kein Konto,
kein Server, keine Cloud, kein Tracking.

## Funktionen

- **Übersicht** pro Monat: Einnahmen, Ausgaben, Saldo, Sparquote, Vergleich zum Vormonat
  (im laufenden Monat fair gegen dieselben Tage des Vormonats), Ausgaben nach Kategorie,
  12-Monats-Verlauf (auch als Tabelle), Budgets, anstehende Fixkosten.
- **Buchungen** erfassen, bearbeiten, durchsuchen (Suche über alle Monate) und nach Kategorie / Art filtern.
- **Fixkosten & Daueraufträge** (monatlich, vierteljährlich, halbjährlich, jährlich) werden am
  Fälligkeitstag automatisch gebucht; Übersicht über Fixkosten pro Monat und was danach frei bleibt.
- **CSV-Import** von Kontoumsätzen mit automatischer Spaltenerkennung – getestet mit den Formaten von
  Sparkasse (CSV-CAMT), ING, DKB, comdirect, N26 sowie Soll/Haben-Spalten. Windows-1252-Dateien
  (Umlaute) werden erkannt, bereits importierte Umsätze beim erneuten Import übersprungen.
- **Automatische Kategorisierung** über Stichwort-Regeln (REWE → Lebensmittel, Netflix → Abos …),
  erweiterbar und auch nachträglich auf „Sonstiges“-Buchungen anwendbar.
- **Kategorien & Budgets** frei anpassbar.
- **Backup** als JSON herunterladen / wiederherstellen, Export als CSV für Excel.
- **Offline-fähig** und auf dem Handy „Zum Startbildschirm hinzufügen“ installierbar. Hell/Dunkel-Modus.

## Lokal starten

```bash
npm install
npm run dev        # Entwicklungsserver auf http://localhost:5173
npm test           # Unit-Tests (Beträge, Datumslogik, CSV-Formate, Fixkosten, Statistik, Backup)
npm run build      # Produktions-Build nach dist/
npm run preview    # Build lokal ansehen (inkl. Service Worker)
```

## Veröffentlichen (GitHub Pages)

Der Workflow `.github/workflows/deploy.yml` baut die App bei jedem Push auf `main` und veröffentlicht sie.
Einmalig nötig: im Repository unter **Settings → Pages → Build and deployment → Source** „GitHub Actions“
auswählen. Danach ist die App unter `https://<benutzer>.github.io/<repo>/` erreichbar.
(Bei privaten Repositories setzt GitHub Pages einen kostenpflichtigen Plan voraus.)

Da es eine reine statische Seite ist, funktioniert jeder andere Static-Hoster (Netlify, Cloudflare Pages …)
genauso: einfach den Ordner `dist/` hochladen.

## Wichtig zu den Daten

Die Daten liegen in der IndexedDB des Browsers auf dem jeweiligen Gerät. Sie werden **nicht** zwischen
Geräten synchronisiert und gehen verloren, wenn die Website-Daten im Browser gelöscht werden. Deshalb
regelmäßig unter **Mehr → Datensicherung** ein Backup herunterladen.

## Aufbau

```
src/
  lib/         reine Logik ohne UI (mit Tests): Beträge, Daten, CSV, Regeln, Fixkosten, Statistik, Backup
  components/  Formulare, Diagramme, UI-Bausteine
  views/       Übersicht, Buchungen, Fixkosten, Mehr, CSV-Import
  store.tsx    Zustand + Speicherung (IndexedDB, Fallback localStorage)
public/        Manifest, Service Worker, Icons
```
