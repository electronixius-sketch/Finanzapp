import { describe, expect, it } from 'vitest';
import { decodeBytes, detectDelimiter, findHeaderRow, guessMapping, importHashes, parseCSV, toDrafts } from './csv';

function load(text: string) {
  const rows = parseCSV(text);
  const headerRow = findHeaderRow(rows);
  const mapping = guessMapping(rows[headerRow]);
  return { rows, headerRow, mapping, drafts: toDrafts(rows, headerRow, mapping) };
}

describe('parseCSV', () => {
  it('handles quotes, escaped quotes and line breaks inside fields', () => {
    const rows = parseCSV('a;"b;c";"say ""hi"""\r\n1;"multi\nline";3\n', ';');
    expect(rows).toEqual([
      ['a', 'b;c', 'say "hi"'],
      ['1', 'multi\nline', '3'],
    ]);
  });

  it('detects semicolons even when amounts contain commas', () => {
    expect(detectDelimiter('Datum;Text;Betrag\n01.10.2026;REWE;-12,50\n02.10.2026;Lohn;2.000,00')).toBe(';');
    expect(detectDelimiter('Date,Payee,Amount\n2026-10-01,REWE,-12.50')).toBe(',');
  });
});

describe('bank formats', () => {
  it('Sparkasse (CSV-CAMT)', () => {
    const { drafts } = load(
      [
        '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Glaeubiger ID";"Mandatsreferenz";"Kundenreferenz (End-to-End)";"Sammlerreferenz";"Lastschrift Ursprungsbetrag";"Auslagenersatz Ruecklastschrift";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"',
        '"DE00";"01.10.26";"01.10.26";"FOLGELASTSCHRIFT";"Einkauf 123";"";"";"";"";"";"";"REWE Markt GmbH";"DE11";"XYZ";"-23,45";"EUR";"Umsatz gebucht"',
        '"DE00";"30.09.26";"30.09.26";"GUTSCHR. UEBERWEISUNG";"Gehalt 09/2026";"";"";"";"";"";"";"Arbeitgeber AG";"DE22";"XYZ";"2.850,00";"EUR";"Umsatz gebucht"',
      ].join('\n'),
    );
    expect(drafts).toEqual([
      { row: 1, date: '2026-10-01', amount: -2345, payee: 'REWE Markt GmbH', purpose: 'Einkauf 123' },
      { row: 2, date: '2026-09-30', amount: 285000, payee: 'Arbeitgeber AG', purpose: 'Gehalt 09/2026' },
    ]);
  });

  it('ING with metadata lines before the header', () => {
    const { headerRow, drafts } = load(
      [
        'Umsatzanzeige;Datei erstellt am: 04.10.2026 10:00',
        '',
        'IBAN;DE00 1234',
        'Kontoname;Girokonto',
        'Zeitraum;01.09.2026 - 04.10.2026',
        'Saldo;1.234,56;EUR',
        '',
        'Buchung;Valuta;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung',
        '02.10.2026;02.10.2026;Netflix International;Lastschrift;Netflix Abo;1.234,56;EUR;-13,99;EUR',
      ].join('\n'),
    );
    expect(headerRow).toBe(5);
    expect(drafts).toEqual([
      { row: 6, date: '2026-10-02', amount: -1399, payee: 'Netflix International', purpose: 'Netflix Abo' },
    ]);
  });

  it('DKB picks the counterparty depending on the direction', () => {
    const { drafts } = load(
      [
        '"Girokonto";"DE00"',
        '"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"',
        '"03.10.26";"03.10.26";"Gebucht";"Max Muster";"Lidl sagt Danke";"Einkauf";"Ausgang";"DE1";"-8,20";"";"";""',
        '"01.10.26";"01.10.26";"Gebucht";"Oma Erna";"Max Muster";"Geburtstag";"Eingang";"DE2";"50";"";"";""',
      ].join('\n'),
    );
    expect(drafts.map((d) => [d.payee, d.amount])).toEqual([
      ['Lidl sagt Danke', -820],
      ['Oma Erna', 5000],
    ]);
  });

  it('comdirect uses the booking text as purpose', () => {
    const { mapping, drafts } = load(
      [
        ';',
        '"Umsätze Girokonto";"Zeitraum: 30 Tage";',
        '"Buchungstag";"Wertstellung (Valuta)";"Vorgang";"Buchungstext";"Umsatz in EUR";',
        '"01.10.2026";"01.10.2026";"Lastschrift / Belastung";"Auftraggeber: ARAL AG Buchungstext: Tanken";"-61,02";',
      ].join('\n'),
    );
    expect(mapping.date).toBe(0);
    expect(mapping.amount).toBe(4);
    expect(drafts[0]).toMatchObject({ date: '2026-10-01', amount: -6102, purpose: 'Auftraggeber: ARAL AG Buchungstext: Tanken' });
  });

  it('N26 (comma separated, English headers)', () => {
    const { drafts } = load(
      [
        '"Date","Payee","Account number","Transaction type","Payment reference","Amount (EUR)","Amount (Foreign Currency)","Type Foreign Currency","Exchange Rate"',
        '"2026-10-01","Spotify","","MasterCard Payment","","-11.99","","",""',
      ].join('\n'),
    );
    expect(drafts[0]).toMatchObject({ date: '2026-10-01', amount: -1199, payee: 'Spotify' });
  });

  it('separate debit and credit columns', () => {
    const { drafts } = load('Datum;Empfänger;Soll;Haben\n01.10.2026;Bäcker;3,50;\n02.10.2026;Rückzahlung;;20,00');
    expect(drafts.map((d) => d.amount)).toEqual([-350, 2000]);
  });

  it('skips footer rows without date and amount', () => {
    const { drafts } = load('Datum;Text;Betrag\n01.10.2026;A;-1,00\nKontostand;;\n');
    expect(drafts).toHaveLength(1);
  });
});

describe('decodeBytes', () => {
  it('falls back to Windows-1252 for umlauts from older exports', () => {
    const bytes = new Uint8Array([0x42, 0xe4, 0x63, 0x6b, 0x65, 0x72]); // "Bäcker" in cp1252
    expect(decodeBytes(bytes.buffer)).toBe('Bäcker');
  });
});

describe('importHashes', () => {
  it('keeps identical rows distinct but stable across re-imports', () => {
    const d = { row: 1, date: '2026-10-01', amount: -350, payee: 'Bäcker', purpose: '' };
    const first = importHashes([d, { ...d, row: 2 }]);
    expect(first[0]).not.toBe(first[1]);
    expect(importHashes([d, { ...d, row: 2 }])).toEqual(first);
  });
});
