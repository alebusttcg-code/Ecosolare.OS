# ADR-007 — AI dietro un service layer con minimizzazione dei dati

**Stato:** accettata · **Data:** 4 agosto 2026

## Contesto

Il brief prevede quattro assistenti AI. I dati trattati includono anagrafiche, documenti di identità, bollette e dati economici.

## Decisione

1. **Un solo punto di accesso:** interfaccia `AiProvider`, implementazione sostituibile, mockabile nei test. Nessuna chiamata al modello sparsa nel codice applicativo.
2. **Ogni output AI è una proposta**, mai un dato. Diventa dato solo dopo conferma umana esplicita.
3. **Minimizzazione:** nessun documento personale integrale inviato di default; redazione di codice fiscale, IBAN e numeri di documento, salvo quando estrarli è lo scopo dichiarato dell'operazione.
4. **Tracciamento:** ogni interazione registrata in `ai_interactions` con modello, costo, utente ed esito.
5. **Nessun SQL generato dal modello.** L'assistente direzionale sceglie fra query parametriche predefinite e testate; se nessuna corrisponde, risponde che non lo sa.
6. **L'AI non aggira il RBAC:** ogni risposta è filtrata dai permessi di chi ha chiesto.

## Motivazione

Il rischio maggiore non è che l'AI sbagli: è che sbagli in modo plausibile. Un numero inventato in una dashboard di controllo di gestione è peggio di nessun numero, perché viene usato per decidere.

Il punto 5 è la regola più importante del documento: dare al modello accesso libero al database produce risposte credibili e sbagliate, che è l'esito peggiore possibile per un sistema di controllo.

Il tracciamento dei costi esiste perché il budget AI sia un dato osservabile e non una sorpresa in fattura.

## Conseguenze

- Aggiungere un caso d'uso AI richiede scrivere e testare le query, non solo il prompt.
- Cambiare provider è una implementazione, non una riscrittura.
- Alcune domande resteranno senza risposta finché non si scrive la query corrispondente. È accettabile: meglio "non lo so" di un numero inventato.

## Alternativa considerata

Text-to-SQL sul database. Scartata per il motivo al punto 5.
