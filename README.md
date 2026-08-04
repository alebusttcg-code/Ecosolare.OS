# EcoSolare Operating System

Sistema operativo aziendale per EcoSolare: ciclo completo
*Lead → Qualifica → Sopralluogo → Preventivo → Contratto → Commessa → Pratiche → Materiali → Cantiere → Controllo economico → Assistenza*
per le tre linee di business (fotovoltaico, elettrico, idraulico).

**Stato:** Fase 1 completa — anagrafiche, immobili, intake lead, pipeline, attività,
amministrazione utenti e configurazioni.
Audit operativo (Sprint 0, interviste e baseline) ancora da svolgere.

## Avvio in locale

Serve Node 24 e una `DATABASE_URL` verso un PostgreSQL gestito in UE — anche un piano
gratuito. L'ambiente di sviluppo usa lo stesso database della produzione per tipo, non
un surrogato ([ADR-010](docs/adr/010-pglite-per-i-test.md)); i test invece girano su
PGlite e non richiedono nulla.

```bash
npm install
cp .env.example .env.local   # e compilare
npm run db:migrate
npm run db:seed              # stati pipeline, fonti lead, configurazioni
npm run dev
```

Il primo accesso crea l'amministratore iniziale: va impostata `ADMIN_BOOTSTRAP_EMAIL`.
Dopo di che non esiste auto-registrazione — gli utenti li crea un amministratore.

```bash
npm run check    # lint + typecheck + test (42 test)
```

## Documentazione

| Documento | Contenuto |
|---|---|
| [Discovery & Technical Blueprint](docs/00-discovery-blueprint-v1.md) | Il documento di riferimento: architettura, modello dati, moduli, ruoli, KPI, MVP, roadmap, rischi, stime |
| [Registro decisioni](docs/01-registro-decisioni.md) | Ogni decisione presa, con motivazione e conseguenze. Le decisioni superate restano tracciate |
| [Guida alle interviste](docs/02-sprint0-guida-interviste.md) | Sprint 0 · le 5 interviste operative, domande pronte all'uso |
| [Baseline KPI](docs/03-baseline-kpi.md) + [template CSV](docs/baseline-kpi-template.csv) | Sprint 0 · misura del "prima", senza cui il ROI non è dimostrabile |
| [Endpoint di intake](docs/04-endpoint-intake.md) | Come collegare i form del sito e le landing page |
| [ADR](docs/adr/README.md) | Decisioni architetturali, una per file, con alternative scartate |

## Riferimenti rapidi

- **Referente di progetto:** Federico Leporati
- **Ruoli:** `amministratore`, `contabilita`, `commerciale`, `cantiere` + capacità `can_view_costs`, `is_field_only` ([D-007](docs/01-registro-decisioni.md))
- **Stack previsto:** Next.js + TypeScript · PostgreSQL · object storage UE · SSO Google Workspace
- **Definizione di MVP riuscito:** per 30 giorni consecutivi, il 100% dei nuovi lead entra nel sistema e nessuna opportunità aperta resta senza prossima azione
