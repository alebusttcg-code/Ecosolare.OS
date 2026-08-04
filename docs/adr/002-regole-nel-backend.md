# ADR-002 — Le regole critiche vivono nel backend applicativo

**Stato:** accettata · **Data:** 4 agosto 2026

## Contesto

Esiste la tentazione di costruire gran parte del sistema con un motore di automazione visuale (n8n, Make, Zapier): è veloce e sembra manutenibile da chiunque.

## Decisione

Il motore di automazione può occuparsi di: comunicazioni, sincronizzazioni, webhook, notifiche, processi asincroni non critici.

**Non può contenere:** transizioni di stato, calcolo del margine, regole di readiness, permessi, validazioni di dominio, numerazioni.

## Motivazione

Le regole critiche devono essere **versionate, testate e revisionabili**. Una regola dentro un flusso visuale non ha diff leggibile, non ha test, non ha code review, e può essere modificata da chi non ha modo di sapere cosa sta rompendo.

Il caso concreto: se il calcolo del margine vive in un nodo di automazione, un giorno qualcuno lo modifica per un caso particolare e per sei mesi tutti i preventivi riportano un margine sbagliato, senza che nulla lo segnali.

## Conseguenze

- Più codice da scrivere rispetto al trascinare nodi.
- Ogni regola critica ha un test.
- Il sistema resta funzionante anche se il motore di automazione è indisponibile: le automazioni si fermano, le regole no.

## Alternativa considerata

Motore di automazione come orchestratore centrale. Scartata: sposta il rischio sul componente meno controllabile.
