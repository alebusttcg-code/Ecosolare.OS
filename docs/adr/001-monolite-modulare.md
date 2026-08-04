# ADR-001 — Monolite modulare, non microservizi

**Stato:** accettata · **Data:** 4 agosto 2026

## Contesto

Il sistema copre otto aree funzionali (CRM, preventivi, documenti, commesse, materiali, cantieri, controllo economico, assistenza). Il brief chiede modularità e mette in guardia contro "un'unica applicazione monolitica e fragile". Gli utenti previsti sono 8–30.

## Decisione

Un'unica applicazione Next.js + TypeScript, con moduli separati da **confini applicativi**: cartelle con interfaccia pubblica esplicita e nessun import trasversale non dichiarato. Nessun servizio separato, nessuna comunicazione di rete fra moduli.

## Motivazione

La fragilità di cui parla il brief non nasce dal deploy unico: nasce dall'assenza di confini. Un monolite con confini netti è modulare; dieci microservizi che condividono il database non lo sono.

Con 8–30 utenti, i microservizi aggiungerebbero solo costi: deploy multipli, versionamento delle interfacce, transazioni distribuite, osservabilità distribuita. Costi pagati per una scala che non arriverà.

## Conseguenze

- Un solo deploy, una sola pipeline, una sola base di codice da conoscere.
- Le transazioni restano locali: aprire una commessa da un contratto firmato è una transazione, non una saga distribuita.
- Se un modulo dovrà essere estratto, il confine esiste già e l'estrazione è meccanica.
- **Rischio:** i confini vanno fatti rispettare attivamente. Senza disciplina degenerano. Mitigazione: regole di import verificate in CI quando il numero di moduli lo giustificherà.

## Alternativa considerata

Frontend separato + API NestJS. Più pulito concettualmente, ma raddoppia superficie di codice, deploy e autenticazione per un team piccolo. Scartata.
