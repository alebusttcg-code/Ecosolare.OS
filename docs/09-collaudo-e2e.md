# Collaudo E2E — checklist operativa

Checklist manuale da ripetere **prima del go-live** e **settimanalmente** durante
l'adozione. Ogni voce: eseguire, segnare data/esito, annotare anomalie.

**Ambiente:** staging (`https://…vercel.app`) finché non c'è produzione dedicata.

**Durata:** ~45 minuti la prima volta, ~20 minuti le successive.

---

## Preparazione

| # | Azione | Esito | Data | Note |
|---|---|---|---|---|
| P1 | Utente amministratore attivo, password cambiata | ☐ | | |
| P2 | Almeno un utente `commerciale` creato in Amministrazione → Utenti | ☐ | | |
| P3 | Database seed applicato (stati pipeline, checklist documenti) | ☐ | | |
| P4 | Storage Supabase configurato (upload non sparisce al refresh) | ☐ | | |
| P5 | `npm run outbox` o cron Vercel attivo (se Drive configurato) | ☐ | | |

---

## Flusso commerciale — lead → firma

| # | Passo | Esito | Data | Note |
|---|---|---|---|---|
| 1 | **Intake:** POST `/api/intake` o form → lead compare in Lead | ☐ | | |
| 2 | Lead ha responsabile e prossima azione | ☐ | | |
| 3 | Apertura popup lead: tel/WhatsApp funzionano | ☐ | | |
| 4 | «Scheda completa» chiude overlay e naviga (no scroll bloccato) | ☐ | | |
| 5 | Prequalifica / questionario compilato | ☐ | | |
| 6 | Sopralluogo creato e chiuso con checklist | ☐ | | |
| 7 | Preventivo creato, versione visibile, margine per chi ha `can_view_costs` | ☐ | | |
| 8 | Approvazione sotto soglia (se applicabile) | ☐ | | |
| 9 | «Invia preventivo» / cambio stato coerente con UI | ☐ | | |
| 10 | Firma registrata → contratto + commessa aperta | ☐ | | |

---

## Flusso commessa — readiness e documenti

| # | Passo | Esito | Data | Note |
|---|---|---|---|---|
| 11 | Commessa in Cantieri con stato readiness corretto | ☐ | | |
| 12 | Upload documento obbligatorio → stato «da verificare» | ☐ | | |
| 13 | Approvazione documento → readiness si aggiorna | ☐ | | |
| 14 | Download documento via `/api/documenti/[id]` (non path diretto) | ☐ | | |
| 15 | OK amministrativo / pagamento (se previsto) | ☐ | | |
| 16 | Cartella Drive creata (se outbox + credenziali OK) | ☐ | | |

---

## Navigazione e UX

| # | Passo | Esito | Data | Note |
|---|---|---|---|---|
| 17 | Ricerca globale ⌘K trova lead/cliente/commessa | ☐ | | |
| 18 | Badge sidebar (attività scadute, approvazioni) coerenti | ☐ | | |
| 19 | Dialogo/modal: chiusura con Escape, click backdrop, navigazione | ☐ | | |
| 20 | Mobile: drawer menu si chiude dopo navigazione | ☐ | | |
| 21 | Toast conferma dopo azioni principali (salva, completa, carica) | ☐ | | |

---

## Permessi (scope)

| # | Passo | Esito | Data | Note |
|---|---|---|---|---|
| 22 | Utente `commerciale` vede tutti i lead e cantieri | ☐ | | |
| 23 | Utente `cantiere` + **Solo campo** vede solo commesse con task assegnati | ☐ | | |
| 24 | Field-only non accede a lead né preventivi | ☐ | | |
| 25 | Utente senza `can_view_costs` non vede costi in API/UI | ☐ | | |

> Per il test 23: crea utente cantiere con flag «Solo campo», assegna un task
> su una commessa, verifica che l'altra commessa non compaia in elenco né in ⌘K.

---

## Registro esecuzioni

| Data | Esecutore | Ambiente | Esito globale | Anomalie aperte |
|---|---|---|---|---|
| | | staging | ☐ OK ☐ KO | |
| | | staging | ☐ OK ☐ KO | |
| | | produzione | ☐ OK ☐ KO | |

**Esito globale OK** = tutte le voci P1–P5 e almeno 1–14 senza bloccanti; 15–25
documentate se non applicabili.

---

## Anomalie note (da backlog)

Usare questa sezione durante il collaudo; spostare in issue/ticket quando si fissa.

| ID | Descrizione | Gravità | Stato |
|---|---|---|---|
| | | P0 / P1 / P2 | aperta / risolta |

---

## Collegamenti

- Deploy staging: [08-deploy-staging-vercel.md](08-deploy-staging-vercel.md)
- Baseline KPI: [03-baseline-kpi.md](03-baseline-kpi.md)
- Configurazione Supabase: [07-configurazione-supabase.md](07-configurazione-supabase.md)
