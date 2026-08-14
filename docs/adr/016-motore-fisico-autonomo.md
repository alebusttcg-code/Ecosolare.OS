# ADR-016 — Motore di producibilità fisico e autonomo, dati posseduti

**Data:** 14 agosto 2026

**Stato:** Accettata

**Decisore:** Federico Leporati

## Decisione

La stima di producibilità passa da una **formula calibrata** sui tre dossier
SolarEdge a un **motore fisico**: irraggiamento e temperatura sul sito
(trasposizione al piano dei moduli, derating termico, perdite di sistema,
inverter con clipping, bifacciale) e ombra reale per falda. L'autoconsumo nasce
dal confronto orario fra produzione e un **profilo di carico** scelto per tipo di
utenza, non da una frazione fissa.

Due vincoli non negoziabili:

1. **SolarEdge non è un riferimento su cui tararsi.** La fisica di riferimento è
   pubblica (PVGIS del Centro Comune di Ricerca UE, pvlib, NREL SAM). I dossier
   consegnati servono a **validare**, mai a calibrare.

2. **Nessuna dipendenza esterna a runtime.** Le API di dati (PVGIS per la
   climatologia, Google Solar per ombra e geometria) si chiamano **una volta
   all'ingest di un sito** e i dati si **posseggono** in database. Un preventivo
   non chiama nessuno: la climatologia di un luogo e la geometria di un tetto sono
   statiche, e ri-scaricarle a ogni iterazione sarebbe fragile e costoso.

Disegno completo e percorso in [docs/15](../15-motore-fisico-autonomo.md).

## Perché

- Una formula calibrata è precisa **solo** quanto i casi su cui è tarata — tre
  tetti, tutti sud/sud-ovest e quasi piani. Fuori da lì estrapola. Un motore
  fisico parte dal sito e vale su qualunque tetto, come SolarEdge.
- L'ombra misurata da Google (foto aeree) può battere l'ombra modellata a mano di
  SolarEdge: è l'unico punto dove abbiamo un dato migliore del suo.
- Il profilo di carico è lo stesso metodo che l'azienda già usa nel Designer
  (consumo annuo + utenza) ed è **forma statica**: nessuna dipendenza, e sul
  consumo vero del cliente — quando disponibile — supera SolarEdge, che assume.
- Possedere i dati per-sito risolve insieme autonomia a runtime, costi delle API
  a pagamento e il difetto D11 (cache DSM oggi solo in memoria di processo).

## Costo e vincoli

- Serve costruire gli anelli fisici (trasposizione, temperatura, perdite,
  inverter) come moduli **puri e testati**, e un ingest PVGIS con cache per-sito.
- La produzione va portata a risoluzione **giorno-tipo mensile** (mese × ora),
  non più solo annua: è la condizione per un autoconsumo credibile.
- I profili di carico vanno **catturati** uno a uno (il giornaliero della pompa di
  calore manca ancora): non si inventano, un profilo sbagliato falsa l'autoconsumo.
- Il numero resta una stima con incertezza inevitabile (TMY = anno tipico): va
  **dichiarata**, non nascosta.
- `produzione-fv.ts` (la formula attuale) resta come **ripiego** finché il motore
  fisico non copre ogni caso, per non perdere i preventivi in corso.

## Alternative escluse

- **Continuare con la formula calibrata:** accurata solo vicino ai tre dossier,
  cieca su est/ovest/inclinato, senza PR né clipping. È il punto di partenza da
  superare, non da consolidare.
- **Orchestrare SolarEdge (o un suo pari commerciale) via API/scraping:** viola
  il primo vincolo — ci renderebbe dipendenti dal rivale — e non è autonomo.
- **Chiamare PVGIS a ogni preventivo:** fisica corretta ma dipendenza a runtime,
  costo di latenza e fragilità se l'API è giù. Si ingerisce e si possiede invece.
- **Reimplementare da zero un simulatore per battere SolarEdge sul suo terreno,
  senza usare le fonti pubbliche:** lavoro enorme e inutile — la fisica è già
  pubblica e validata (PVGIS, pvlib); la si usa come dato, non la si reinventa.
