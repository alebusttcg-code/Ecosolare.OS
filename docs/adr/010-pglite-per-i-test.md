# ADR-010 — PGlite per i test, PostgreSQL gestito per tutto il resto

**Stato:** accettata · **Data:** 4 agosto 2026

## Contesto

I test che toccano il database sono i più utili (verificano vincoli, default, migrazioni) e i più trascurati, perché richiedono un database in esecuzione. La macchina di sviluppo attuale non ha Docker né PostgreSQL installato.

## Decisione

- **Test automatici:** PGlite — PostgreSQL compilato in WebAssembly, eseguito nel processo di test. Nessun servizio da avviare, database vuoto a ogni esecuzione, migrazioni reali applicate.
- **Sviluppo, staging e produzione:** PostgreSQL gestito in regione UE. Nessuna eccezione.

## Motivazione

Le due esigenze sono diverse e vanno servite diversamente.

I test devono essere **ermetici e veloci**: se richiedono di avviare qualcosa, prima o poi qualcuno li salta e la CI diventa opzionale. Con PGlite l'intera suite gira in meno di tre secondi senza prerequisiti.

L'ambiente di sviluppo deve invece **somigliare alla produzione**: un surrogato locale nasconde differenze di comportamento (estensioni, permessi, prestazioni, fuso orario) che emergono poi in produzione, dove costano di più.

PGlite è PostgreSQL vero, non un'emulazione, quindi la differenza fra test e produzione è la versione e le estensioni disponibili, non il dialetto SQL.

## Conseguenze

- Lo sviluppo locale richiede una `DATABASE_URL` verso un PostgreSQL gestito (un piano gratuito è sufficiente): l'applicazione non parte senza.
- `@electric-sql/pglite` è una dipendenza **di sviluppo** e non deve mai essere importata dal codice applicativo. È isolata in `src/db/testing.ts`.
- Se un giorno servisse un'estensione non supportata da PGlite, i test relativi dovranno girare su un PostgreSQL reale in CI. Al momento nessuna estensione è in uso oltre a quelle di base.
