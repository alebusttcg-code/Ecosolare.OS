# Audit preventivo EcoSolare — direzione Premium V2

Data: 11 agosto 2026

## Riferimenti analizzati

- preventivo storico Walter Ricci, 22 pagine;
- `Preventivo-Ricci-Walter-Premium.pdf`, 22 pagine;
- brief definitivo allegato alla sessione;
- tavola grafica «Il progetto in sintesi»;
- logo EcoSolare trasparente allegato.

Il brief prevale su struttura, dati e comportamento. La tavola «Il progetto in
sintesi» prevale sulla direzione estetica, perché il PDF Premium precedente è
stato esplicitamente respinto come insufficiente.

## Diagnosi

1. Il PDF storico contiene i dati giusti, ma non costruisce una gerarchia
   commerciale: sembra un documento Word esportato.
2. Il primo Premium migliora allineamento e coerenza, ma rimane un report
   gestionale. Titoli, box e pagine SolarEdge incastonate competono tra loro.
3. La copertina precedente dedica spazio a mittente, destinatario e trust
   generico prima di spiegare il progetto. La nuova copertina apre invece sui
   cinque numeri che sostengono la vendita.
4. Le pagine 10–14 sono leggibili ma percepite come allegati esterni. Nel nuovo
   sistema il loro contenuto deve appartenere al linguaggio EcoSolare, oppure
   essere importato in vettoriale dentro una cornice coerente.
5. Le schede 15–22 sono documentazione tecnica condizionale e versionata, non
   template da copiare dentro il codice.
6. Il PDF Premium allegato è composto da 22 immagini raster 1400×1980. È utile
   come riferimento visivo, ma non può essere il motore definitivo: testo,
   accessibilità, sostituzione dati e qualità vettoriale ne risentono.

## Decisioni applicate

- Manrope per interfaccia e corpo; Bodoni Moda per titoli e numeri principali.
- Formato A4, carta avorio quasi bianca, navy/blue/gold EcoSolare.
- Griglia, margini, header e footer unici e deterministici.
- Copertina orientata al progetto: potenza, produzione, autonomia, CO₂ e
  investimento, con vista reale del tetto del cliente.
- Vecchio generatore mantenuto disponibile; la nuova copertina è attivabile con
  `PREVENTIVO_PDF_PREMIUM_V2=1` finché la direzione non viene approvata.
- Registro pagine centralizzato: 14 pagine commerciali/report + documentazione
  tecnica condizionale. Il fixture Walter contiene 8 pagine tecniche e quindi
  torna esattamente a 22.

## Prossima tranche dopo il lock visivo

1. Estendere lo stesso shell premium alle pagine 2–9.
2. Ricomporre o importare in vettoriale i report 10–14.
3. Implementare libreria documenti prodotto e merge delle pagine tecniche.
4. Aggiungere validazione Zod del contratto PDF e blocco hard su campi mancanti.
5. Snapshot immutabile, hash e visual regression 1400×1980 sul caso Walter.
