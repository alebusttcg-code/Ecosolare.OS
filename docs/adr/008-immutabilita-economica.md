# ADR-008 — Immutabilità dei dati economici

**Stato:** accettata · **Data:** 4 agosto 2026

## Contesto

Il brief chiede di non modificare retroattivamente i dati storici, di distinguere costo stimato da costo reale e di non cancellare dati economici senza storico.

## Decisione

1. **Una versione di preventivo inviata non si modifica.** Si crea la versione successiva. Dopo `sent`, la riga è immutabile a livello applicativo.
2. **Snapshot:** ogni `quote_version` congela in JSONB listino, aliquote e regole vigenti al momento dell'invio. Un preventivo inviato deve essere ricostruibile identico anche dopo che il listino è cambiato.
3. **Nessuna cancellazione fisica** di dati economici o operativi: soft delete più riga di audit.
4. **Costo stimato e costo reale sono colonne diverse.** Mai la stessa colonna aggiornata.
5. Ogni importo è calcolato **server-side**. Il client non calcola mai un totale che verrà salvato.

## Motivazione

Il punto 2 è quello che si scopre tardi e costa caro: senza snapshot, riaprire un preventivo di sei mesi fa dopo un aggiornamento del listino mostra numeri diversi da quelli che il cliente ha ricevuto e firmato. È un problema contrattuale, non tecnico.

Il punto 4 è la premessa dell'intero controllo di gestione: se il costo stimato viene sovrascritto da quello reale, lo scostamento — cioè il dato che giustifica la Fase 5 — non è più calcolabile.

## Conseguenze

- Più righe in tabella: le versioni si accumulano. Irrilevante ai volumi previsti.
- L'interfaccia deve rendere evidente quale versione è quella corrente.
- I report storici sono stabili: lo stesso report eseguito due volte a distanza di mesi dà lo stesso risultato.
- Le correzioni sono possibili ma tracciate, mai silenziose.

## Alternativa considerata

Modifica in loco con storico dei campi in audit. Scartata: l'audit ricostruisce *cosa è cambiato*, non permette di *ricostruire il documento* così come era.
