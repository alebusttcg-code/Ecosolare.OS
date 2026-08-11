# Font dossier PDF (EcoSolare)

- **Cormorant Garamond** (TTF) — titoli, SIL OFL (`OFL-CormorantGaramond.txt`)
- **DM Sans** (TTF) — corpo e tabelle, SIL OFL (`OFL-DMSans.txt`)

Usati solo da `@react-pdf/renderer`. Servono TTF statici (non variable/WOFF2)
per il subsetting di fontkit.
# Font del preventivo premium

Il dossier cliente usa i font prescritti dal brief commerciale:

- `Manrope-Regular.ttf`, `Manrope-SemiBold.ttf` e `Manrope-Bold.ttf` per testo,
  etichette e metadati;
- `BodoniModa-Regular.ttf` e `BodoniModa-Bold.ttf` per titoli editoriali e
  valori principali; `BodoniModa-Text.ttf` mantiene leggibili le unità piccole.

I pesi statici sono istanziati dai font variabili del repository ufficiale
Google Fonts e sono distribuiti secondo SIL Open Font License 1.1. Le licenze sono incluse nei file
`OFL-Manrope.txt` e `OFL-BodoniModa.txt`.

I precedenti DM Sans e Cormorant Garamond restano nel repository per la
compatibilità con artefatti storici, ma non sono il fallback del nuovo PDF.
