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
| 2b | Alla creazione lead: 2 follow-up pre (+2/+4 gg) in **Follow-up** | ☐ | | |
| 2c | Creando un sopralluogo i FU pre aperti spariscono (saltati) | ☐ | | |
| 2d | Chiudendo il sopralluogo: 2 FU post (+2/+4 gg) | ☐ | | |
| 2e | Firma contratto: FU post aperti chiusi | ☐ | | |
| 2f | Collega Telegram da Follow-up (`/start CODICE`) | ☐ | | |
| 2g | Giorno scadenza + cron: arriva reminder; reply smarca FU e salva note | ☐ | | |
| 3 | Apertura popup lead: tel/WhatsApp funzionano | ☐ | | |
| 4 | «Scheda completa» chiude overlay e naviga (no scroll bloccato) | ☐ | | |
| 5 | Prequalifica / questionario compilato | ☐ | | |
| 5b | Sopralluogo: card **Studio tetto** → Apri Sviluppo → salva studio completo → ritorno automatico all’agenda | ☐ | | |
| 5c | Geometria Copertura precompilata e editabile; senza studio «Completa» resta disabilitato | ☐ | | |
| 6 | Sopralluogo creato e chiuso con checklist (dopo studio completo) | ☐ | | |
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
| 16b | Impostazioni → **Personale**: crea almeno un dipendente attivo | ☐ | | |
| 16c | Su commessa **Pianificabile**: pianifica data + operai → stage «Cantiere pianificato» | ☐ | | |
| 16d | Elenco Cantieri mostra data e operai; ripianifica / annulla funzionano | ☐ | | |
| 16e | Avvia installazione → stage «In corso»; completa → «Installazione completata» | ☐ | | |
| 16f | **Agenda cantieri**: elenco per giorno con operai assegnati | ☐ | | |

---

## Navigazione e UX

| # | Passo | Esito | Data | Note |
|---|---|---|---|---|
| 17 | _(rimosso)_ Ricerca globale ⌘K | — | | |
| 18 | Badge sidebar (attività scadute, approvazioni) coerenti | ☐ | | |
| 19 | Dialogo/modal: chiusura con Escape, click backdrop, navigazione | ☐ | | |
| 20 | Mobile: drawer menu si chiude dopo navigazione | ☐ | | |
| 21 | Toast conferma dopo azioni principali (salva, completa, carica) | ☐ | | |

---

## Permessi (scope)

| # | Passo | Esito | Data | Note |
|---|---|---|---|---|
| 22 | Utente `commerciale` vede tutti i lead e cantieri | ☐ | | |
| 23 | _(differito)_ Field-only / PWA: operai senza login (D-013) | — | | |
| 24 | Utente **Operativo** (`cantiere`) pianifica; Commerciale non crea pianificazione | ☐ | | |
| 25 | Utente senza `can_view_costs` non vede costi in API/UI | ☐ | | |

> Per il test 23: crea utente cantiere con flag «Solo campo», assegna un task
> su una commessa, verifica che l'altra commessa non compaia in elenco.

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

## Sviluppo — Solar API (D-016)

| # | Azione | Esito | Data | Note |
|---|---|---|---|---|
| S0 | GCP: abilitare **Geocoding**, **Solar**, **Maps JavaScript**, **Maps Static**, **Map Tiles**, **Places API (New)**; API key in `GOOGLE_MAPS_API_KEY` | ☐ | | |
| S1 | Come admin o commerciale: menu **Sviluppo** → digitare indirizzo (autocomplete Places) → **Analizza tetto** | ☐ | | |
| S2 | Compare mappa satellitare del tetto, indirizzo geocodificato, qualità immagini e tabella falde | ☐ | | |
| S2b | Selezionare una falda (marker o riga tabella) → poligono oro editabile → trascina un vertice → quote in metri e pannello falda si aggiornano | ☐ | | |
| S2c | **Ripristina bbox Solar** riporta il poligono allo stato iniziale; **Deseleziona** toglie l’editing | ☐ | | |
| S2d | Dopo analisi: messaggio DSM pronto (o errore copertura). Selezionare falda → compare **Sezione (DSM)** e **Vista 3D**; orbit/zoom sulla mesh | ☐ | | |
| S2e | Seconda analisi stesso indirizzo: DSM da cache server (niente doppio download evidente / risposta più rapida) | ☐ | | |
| S2f | **Cambia tetto** → click su altro edificio in mappa → nuova analisi entro ~200 m; oltre / senza copertura: messaggio chiaro | ☐ | | |
| S3 | Indirizzo inesistente o zona senza copertura: messaggio chiaro (non crash) | ☐ | | |
| S4 | Utente contabilità/cantiere: voce Sviluppo assente | ☐ | | |
| S5 | Dal sopralluogo (commerciale): Apri Sviluppo con `?da=/agenda/…` → salva completo → redirect al sopralluogo; «← Torna al sopralluogo» visibile | ☐ | | |

**Nota costi:** ogni `dataLayers:get` + download GeoTIFF è fatturato da Google. Il lab mette in cache la griglia per ~30 min sullo stesso punto/raggio.

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
