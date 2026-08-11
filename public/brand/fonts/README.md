# Font del preventivo premium

Il dossier cliente usa i font prescritti dal brief commerciale:

- `Manrope-Regular.ttf`, `Manrope-SemiBold.ttf` e `Manrope-Bold.ttf` per testo,
  etichette e metadati;
- `BodoniModa-Regular.ttf` e `BodoniModa-Bold.ttf` per titoli editoriali e
  valori principali; `BodoniModa-Text.ttf` mantiene leggibili le unità piccole.

I pesi statici sono istanziati dai font variabili del repository ufficiale
Google Fonts e sono distribuiti secondo SIL Open Font License 1.1. Le licenze sono incluse nei file
`OFL-Manrope.txt` e `OFL-BodoniModa.txt`.

Il renderer HTML/CSS li carica esclusivamente in locale e attende tutti i pesi
prima di esporre il segnale `data-pdf-ready` a Playwright. Non sono ammessi
fallback nel PDF consegnato al cliente.
