# ADR-005 — Outbox transazionale per gli eventi di dominio

**Stato:** accettata · **Data:** 4 agosto 2026

## Contesto

Gli eventi di dominio (§10 del blueprint) innescano azioni visibili al cliente: email, messaggi, task, solleciti. Due modi ovvi di implementarli sono entrambi sbagliati:

- inviare l'email dentro la transazione → se la transazione fallisce, l'email è già partita;
- inviarla dopo il commit → se il processo muore in mezzo, l'evento è perso senza traccia.

## Decisione

**Outbox transazionale.** L'evento viene scritto nella tabella `domain_events` nella **stessa transazione** della modifica dati. Un worker separato lo consegna ai gestori.

Ogni gestore è **idempotente**, con vincolo univoco su `(event_id, handler_name)` in `event_handler_runs`.

## Motivazione

Garantisce che evento e dato siano coerenti: o esistono entrambi o nessuno dei due. La consegna è at-least-once, quindi la stessa automazione può essere invocata più volte: l'idempotenza è ciò che rende questo innocuo.

Elimina alla radice la classe di bug che distrugge la fiducia nelle automazioni: *"il cliente ha ricevuto tre volte lo stesso sollecito"*. Un utente che riceve un doppio invio smette di fidarsi dell'intero sistema, non solo di quella funzione.

## Conseguenze

- Serve un worker e una tabella di outbox: complessità iniziale non banale.
- Ogni gestore deve dichiarare una chiave naturale di idempotenza (es. `follow_up_seq:{quote_version_id}`).
- I fallimenti persistenti finiscono in dead-letter **visibile all'amministratore**: un'automazione che fallisce in silenzio è peggio di nessuna automazione.
- La consegna è asincrona: l'interfaccia non deve promettere effetti immediati.

## Alternativa considerata

Chiamate dirette dopo il commit. Scartata: perde eventi e non è ricostruibile.
