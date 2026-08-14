# Registro delle decisioni architetturali (ADR)

Una decisione architetturale per file. Ogni ADR risponde a: **cosa** è stato deciso,
**perché**, **cosa costa**, e **cosa era l'alternativa**.

Gli ADR non si modificano dopo l'accettazione: si superano con un ADR successivo.
Serve a rispondere fra un anno alla domanda "perché è fatto così?" senza dover
ricostruire il ragionamento a memoria.

| ADR | Titolo | Stato |
|---|---|---|
| [001](001-monolite-modulare.md) | Monolite modulare, non microservizi | Accettata |
| [002](002-regole-nel-backend.md) | Le regole critiche vivono nel backend applicativo | Accettata |
| [003](003-lead-non-entita-separata.md) | Il lead non è un'entità separata | Accettata |
| [004](004-questionari-jsonb.md) | Risposte dei questionari in JSONB versionato | Accettata |
| [005](005-outbox-transazionale.md) | Outbox transazionale per gli eventi di dominio | Accettata |
| [006](006-policy-layer-server-side.md) | Permessi valutati server-side in un policy layer unico | Accettata |
| [007](007-ai-service-layer.md) | AI dietro un service layer con minimizzazione dei dati | Accettata |
| [008](008-immutabilita-economica.md) | Immutabilità dei dati economici | Accettata |
| [009](009-migrazioni-versionate.md) | Migrazioni versionate, mai modifiche manuali al database | Accettata |
| [010](010-pglite-per-i-test.md) | PGlite per i test, PostgreSQL gestito per tutto il resto | Accettata |
| [011](011-drive-specchio-non-archivio.md) | Google Drive è uno specchio, non l'archivio | Accettata |
| [012](012-nessuna-cancellazione-dei-file.md) | Nessun file viene mai cancellato | Accettata |
| [013](013-verifica-in-due-passaggi.md) | Verifica in due passaggi con TOTP | Superata |
| [014](014-pagina-pubblica-stato-cliente.md) | Pagina di stato per il cliente, senza account | Accettata |
| [015](015-preventivo-html-css-playwright.md) | Preventivo HTML/CSS stampato con Playwright Chromium | Accettata |
| [016](016-motore-fisico-autonomo.md) | Motore di producibilità fisico e autonomo, dati posseduti | Accettata |

Riferimento esteso: [§8.3 del blueprint](../00-discovery-blueprint-v1.md).
Decisioni di prodotto e di processo (non architetturali): [registro decisioni](../01-registro-decisioni.md).
