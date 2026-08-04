# ADR-006 — Permessi valutati server-side in un policy layer unico

**Stato:** accettata · **Data:** 4 agosto 2026

## Contesto

Quattro ruoli e due capacità (D-007), con una regola economicamente rilevante: i costi di acquisto non sono visibili a chi non ha `can_view_costs`.

## Decisione

Un modulo unico e **puro** — `src/lib/auth/policy.ts` — espone `can(subject, action, resource)`. Nessun accesso al database, nessuna dipendenza da Next.js, quindi interamente testabile.

- `authorize()` **solleva** invece di restituire un booleano.
- `guard()` in `src/lib/auth/session.ts` combina autenticazione, autorizzazione e registrazione del diniego.
- La matrice in codice è la trascrizione fedele della §11.2 del blueprint: documento e implementazione si verificano a vicenda.
- Ogni lista applica uno `scopeFor()` **nella query**, non nel rendering.

## Motivazione

L'interfaccia nasconde, il backend nega. Nascondere un pulsante non è un controllo di accesso: è un suggerimento.

`authorize()` solleva perché un `if` dimenticato passa inosservato in code review, un `throw` mancante no.

Il modulo è puro perché la tentazione, quando il controllo richiede una query, è rimandarlo ("qui il dato ce l'ho già, controllo dopo"). Rendendolo puro, il controllo costa zero e non c'è scusa per saltarlo.

## Conseguenze

- 36 test di autorizzazione girano in millisecondi e falliscono il build se una regola non negoziabile viene violata.
- L'utente rimane la fonte di verità **dal database**, non dalla sessione: revocare una capacità ha effetto immediato, non alla scadenza della sessione. Costo: una query per richiesta.
- I costi non devono comparire nemmeno nel payload JSON servito a chi non li può vedere.

## Alternativa considerata

Row Level Security di PostgreSQL. Potente, ma difficile da debuggare, da testare e da far evolvere; sposta la logica di dominio in un luogo che gli sviluppatori applicativi non leggono. Riconsiderabile se il sistema dovesse diventare multi-tenant.
