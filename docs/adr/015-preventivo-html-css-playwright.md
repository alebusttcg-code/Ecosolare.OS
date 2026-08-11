# ADR-015 — Preventivo HTML/CSS stampato con Playwright Chromium

**Data:** 12 agosto 2026

**Stato:** Accettata

**Decisore:** Federico Leporati

## Decisione

Tutte le pagine progettate da EcoSolare sono un documento HTML/CSS A4
versionato, reso dalla route isolata `/pdf-render/preventivi/[id]`. La stessa
route è l’anteprima nel CRM e la sorgente del download: Playwright `1.62.0`
avvia il proprio Chromium, attende `data-pdf-ready` e stampa con margini zero,
sfondi attivi, locale `it-IT` e fuso `Europe/Rome`.

Il contratto tipografico usa solo i font locali Manrope 400/600/700 e Bodoni
Moda 400/700. Il segnale di ready viene emesso soltanto dopo caricamento e
verifica dei font e dopo il decode di tutte le immagini. Ogni `.pdf-page` deve
misurare esattamente `210mm × 297mm`.

Le schede tecniche dei produttori non vengono rasterizzate: il documento HTML
crea wrapper A4 con uno slot noto; `pdf-lib` incorpora e scala nello slot la
pagina originale del PDF, preservandone testo e vettori. `pdf-lib` non disegna
il template commerciale.

## Perché

- HTML/CSS dà controllo millimetrico, font locali verificabili e una sola
  implementazione tra anteprima e file consegnato.
- Chromium è un motore di stampa deterministico quando versione e browser sono
  bloccati insieme.
- Le schede originali restano leggibili e non perdono qualità per
  rasterizzazione.
- Le quattordici pagine base possono essere finite una volta e alimentate dal
  CRM soltanto nei punti dinamici.

## Costo e vincoli

- Playwright e il browser corrispondente devono essere installati nell’ambiente
  che genera il PDF.
- Ogni modifica al template richiede test strutturali e controllo visivo sia
  dell’HTML sia del PDF ristampato.
- Non sono ammessi React-PDF, ReportLab, jsPDF, canvas per le pagine, Word,
  conversioni esterne o immagini a pagina intera usate come template.

## Alternative escluse

- Renderer PDF a componenti o imperativi: controllo tipografico insufficiente
  e doppia implementazione rispetto all’anteprima.
- Screenshot delle pagine: file pesanti, testo non selezionabile e qualità
  insufficiente.
- Ricomposizione delle schede tecniche: altera il documento ufficiale del
  produttore e ne peggiora la leggibilità.
