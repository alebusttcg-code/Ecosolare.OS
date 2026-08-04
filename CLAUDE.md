@AGENTS.md

# EcoSolare OS — convenzioni di progetto

Prima di modificare qualcosa di strutturale, leggere
[il blueprint](docs/00-discovery-blueprint-v1.md) e gli [ADR](docs/adr/README.md).
Le decisioni di prodotto sono nel [registro decisioni](docs/01-registro-decisioni.md).

## Regole che non si negoziano

- **Permessi sempre server-side.** Ogni endpoint e server action inizia con
  `guard(action, resource)` da `src/lib/auth/session.ts`. Nascondere nell'interfaccia
  non è un controllo di accesso (ADR-006).
- **La matrice permessi in `src/lib/auth/policy.ts` è la trascrizione della §11.2 del
  blueprint.** Se cambia una, deve cambiare l'altra.
- **Nessun costo di acquisto nel payload servito** a chi non ha `can_view_costs`.
  Non basta non mostrarlo.
- **Nessuna modifica manuale al database.** Schema in `src/db/schema.ts`,
  `npm run db:generate`, migrazione versionata (ADR-009).
- **Importi calcolati server-side**, mai dal client. Costo stimato e costo reale
  sono colonne diverse (ADR-008).
- **Niente valori normativi nel codice** (aliquote, detrazioni, soglie): sono
  configurazioni con validità temporale.
- **Validare ogni input con Zod** al confine (form, API, webhook).
- `@electric-sql/pglite` è solo per i test, isolato in `src/db/testing.ts`:
  non importarlo dal codice applicativo (ADR-010).

## Struttura

```
src/
  app/            rotte Next (App Router)
  auth.ts         configurazione Auth.js
  db/             schema, connessione, migrazioni, helper di test
  env.ts          variabili d'ambiente validate
  lib/auth/       policy layer (puro) e sessione
  lib/audit.ts    scrittura audit log
drizzle/          migrazioni SQL versionate
docs/             blueprint, decisioni, ADR, materiali Sprint 0
```

## Comandi

```bash
npm run check     # lint + typecheck + test — da eseguire prima di ogni commit
npm run dev       # richiede DATABASE_URL
npm run db:generate && npm run db:migrate
```

## Lingua

Codice, schema e nomi di file in inglese; commenti, documentazione e interfaccia
utente in italiano. I commenti spiegano **perché**, non cosa.
