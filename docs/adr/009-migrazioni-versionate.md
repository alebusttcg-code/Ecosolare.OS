# ADR-009 — Migrazioni versionate, mai modifiche manuali al database

**Stato:** accettata · **Data:** 4 agosto 2026

## Contesto

Il brief è esplicito: nessuna modifica strutturale al database deve essere applicata manualmente senza migrazione versionata.

## Decisione

- Lo schema è definito in `src/db/schema.ts` (Drizzle).
- `npm run db:generate` produce file SQL in `drizzle/`, versionati in repository.
- `npm run db:migrate` è l'**unica** via di applicazione, identica in locale, staging e produzione.
- Le migrazioni sono **ripetibili**: applicarle una seconda volta è un no-op, verificato da un test automatico.
- I file di migrazione ricevono un nome parlante (`0000_fondamenta.sql`), non quello casuale generato dallo strumento.

## Motivazione

Una modifica applicata a mano in produzione esiste in un solo posto — quel database — e non in nessun ambiente di sviluppo. Il primo che rigenera lo schema da zero scopre che non corrisponde più a nulla.

La ripetibilità è ciò che rende sicuro rilanciare un deploy senza sapere se le migrazioni erano già passate: senza, ogni deploy incerto diventa una decisione manuale sotto pressione.

Il nome parlante serve a chi legge la storia del repository fra un anno: `0000_blushing_lila_cheney` non dice nulla.

## Conseguenze

- Una modifica di schema richiede sempre due passaggi: modifica del modello, generazione della migrazione.
- Le migrazioni distruttive (drop di colonna) vanno riviste a mano prima del merge: lo strumento non sa quali dati siano recuperabili.
- Il test `migrations.test.ts` applica le migrazioni reali su un database vuoto a ogni esecuzione della CI, quindi un errore lo scopre la pipeline, non la produzione.
