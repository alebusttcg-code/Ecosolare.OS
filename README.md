# EcoSolare Operating System

Sistema operativo aziendale per EcoSolare: ciclo completo
*Lead → Qualifica → Sopralluogo → Preventivo → Contratto → Commessa → Pratiche → Materiali → Cantiere → Controllo economico → Assistenza*
per le tre linee di business (fotovoltaico, elettrico, idraulico).

**Stato:** Sprint 0 — audit operativo e fondamenta tecniche. Nessun codice applicativo.

## Documentazione

| Documento | Contenuto |
|---|---|
| [Discovery & Technical Blueprint](docs/00-discovery-blueprint-v1.md) | Il documento di riferimento: architettura, modello dati, moduli, ruoli, KPI, MVP, roadmap, rischi, stime |
| [Registro decisioni](docs/01-registro-decisioni.md) | Ogni decisione presa, con motivazione e conseguenze. Le decisioni superate restano tracciate |
| [Guida alle interviste](docs/02-sprint0-guida-interviste.md) | Sprint 0 · le 5 interviste operative, domande pronte all'uso |
| [Baseline KPI](docs/03-baseline-kpi.md) + [template CSV](docs/baseline-kpi-template.csv) | Sprint 0 · misura del "prima", senza cui il ROI non è dimostrabile |

## Riferimenti rapidi

- **Referente di progetto:** Federico Leporati
- **Ruoli:** `amministratore`, `contabilita`, `commerciale`, `cantiere` + capacità `can_view_costs`, `is_field_only` ([D-007](docs/01-registro-decisioni.md))
- **Stack previsto:** Next.js + TypeScript · PostgreSQL · object storage UE · SSO Google Workspace
- **Definizione di MVP riuscito:** per 30 giorni consecutivi, il 100% dei nuovi lead entra nel sistema e nessuna opportunità aperta resta senza prossima azione
