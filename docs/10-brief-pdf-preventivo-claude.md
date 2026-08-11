# Brief per Claude — Preventivo PDF EcoSolare OS

**Obiettivo:** portare il PDF del preventivo da “funzionante e riconoscibile” a **brochure commerciale premium**, chiaramente superiore all’attuale e all’altezza (o sopra) dei PDF di riferimento del commerciale EcoSolare (modello Riboldi / dossier SolarEdge Design), con brand **EcoSolare Design** al posto di SolarEdge.

**Destinatario:** agente Claude che lavora nel repo EcoSolare OS (Next.js App Router, React-PDF, TypeScript).
**Lingua UI/docs:** italiano. Codice/schema: inglese.
**Data contesto:** agosto 2026.

---

## 1. Contesto di prodotto (non negoziabile)

EcoSolare OS è il CRM operativo. Il PDF **non è una schermata del CRM**: è il biglietto da visita verso il cliente. Deve sembrare prodotto da un art director commerciale, non da un export tecnico.

### Vincoli di sistema già decisi (ADR / registro)

- Template **unico e data-driven**: stessi blocchi per tutti i preventivi; cambiano solo i numeri/testi del caso.
- **Nessun costo di acquisto / margine** nel payload PDF (permesso `can_view_costs`).
- Importi e simulazione **calcolati server-side** dai dati del caso (studio tetto + totale preventivo + `app_settings` A18).
- Studio tetto (`site_studies`) obbligatorio e completo per creare il preventivo (D-020).
- Schema DB solo via migrazioni; validazione Zod ai confini.
- Commenti/UI in italiano; codice in inglese.

### File chiave oggi

| Area | Percorso |
|------|----------|
| Template React-PDF | `src/lib/pdf/preventivo.tsx` |
| Grafici SVG | `src/lib/pdf/grafici.tsx` |
| DTO PDF | `src/lib/pdf/dati-preventivo.ts` |
| Generazione buffer | `src/lib/pdf/genera-preventivo.tsx` |
| Mapping simulazione → PDF | `src/lib/pdf/mappa-simulazione-pdf.ts` |
| Planimetria / anteprima | `src/lib/pdf/planimetria-moduli.ts`, `src/lib/pdf/ortofoto-moduli-pdf.ts` |
| Query dati preventivo | `src/lib/queries/quotes.ts` |
| Brand / palette PDF | `src/lib/brand/ecosolare.ts` |
| Motore economico | `src/lib/domain/simulazione-fv.ts`, `economia-fv.ts`, `bilancio-energia.ts` |
| Screenshot Moduli | `src/app/(app)/sviluppo/anteprima-moduli.ts` (cattura al salvataggio studio → `snapshot.anteprimaModuliDataUri`) |
| Pagine marketing statiche | `public/preventivo/template/*.jpg` |
| Decisioni | `docs/01-registro-decisioni.md` (D-020 e note redesign) |
| Estetica UI (riferimento tono, non palette abisso) | `.cursor/rules/estetica-design.mdc` |

### Palette PDF (carta chiara — non usare l’abisso dell’UI interna)

Da `ECOSOLARE.pdf`: carta `#ffffff` / soft `#f7f9fc`, inchiostro `#1a2332`, blu `#3f7fc4` / `#2a5f9e`, oro `#d9a441`, verde `#2f9e6b`, arancio `#e07a3d`, teal `#2a9d8f`. Tipografia: DM Sans (già registrata). **Grassetto obbligatorio** su numeri chiave (kWp, €, MWh, anni garanzia, payback).

---

## 2. Cosa il commerciale vuole (voce del fondatore / feedback reali)

Trascrizione sintetica di quanto chiesto in iterazione:

1. **Il cuore del preventivo** non sono le pagine marketing: sono le pagine che nel PDF di riferimento erano brandizzate **“SolarEdge Report / Design”** (circa pp. 11–16). Devono diventare **“EcoSolare Design”** — stesso ruolo narrativo (simulazione, tetto, energia, soldi), brand EcoSolare.
2. **La foto del tetto** deve mostrare i **pannelli disposti in Sviluppo**, non un’ortofoto “vuota” né un overlay SVG fatto male (colori sbagliati/magenta, stile diverso dall’editor). Soluzione già avviata: JPEG catturato dalla vista Moduli al salvataggio (`anteprimaModuliDataUri`). Il risultato deve essere **pixel-fedeltà all’editor Moduli**, non “quasi”.
3. **KPI finanziari** devono restare **calcolati sul caso** (produzione/consumo/tariffe/investimento dello studio+preventivo), non brochure fisse.
4. Copy trust / footer allineati al materiale commerciale:
   - «EcoSolare: +2000 Impianti Realizzati»
   - «+500 impianti monitorati da remoto ogni giorno»
   - «+2000 clienti soddisfatti»
   - «€ 200.000 capitale sociale interamente versato»
   - Ragione sociale / P.IVA / sedi come da materiali ufficiali (verificare coerenza indirizzo La Spezia: in brand oggi Via Buonviaggio 163/19125; alcuni screenshot commerciali riportano 183/19126 — **allineare a fonte ufficiale**, non inventare).
5. Pagine di riferimento mostrate (screenshot):
   - Trust strip + footer logo/legale
   - «1. DETTAGLI IMPIANTO» con componenti + producibilità + diagramma orientamento/inclinazione
   - «2. CARATTERISTICHE» con elenco FV (pannelli, inverter, struttura, DC/AC, quadri) e blocco **pompa di calore** quando presente + attività incluse
   - Schema idraulico «Schema di massima» (termico) — oggi assente o non all’altezza
6. Il fondatore ha giudicato **penoso** il tentativo di ricomporre falda/moduli in SVG su ortofoto. Ha chiesto esplicitamente: *«non fai prima a fare uno screenshot alla sezione Moduli in Sviluppo?»* — quella è la direzione corretta; va portata a maturità (qualità, framing, multi-falda, sempre aggiornata al salvataggio).
7. Qualità attesa: **ampiamente migliore** dell’attuale — non un polish cosmetico, ma un salto da “export CRM decente” a “dossier che il cliente tiene e firma”.

---

## 3. Struttura attuale del PDF (baseline da superare)

Ordine odierno in `DocumentoPreventivo`:

1. **Copertina** — letterhead Da/A, titolo proposta, data/n. prev., hero tetto (anteprima o fallback), KPI barra (moduli, kWp, MWh), trust strip, footer.
2. **§1 Dettagli impianto** — testo composizione, producibilità + anteprima tetto, falde, regime incentivi.
3. **§2 Caratteristiche** — tabella listino righe preventivo, totale, incluso/escluso testuali.
4. **Garanzie** — blocchi da dossier testuale.
5. **§7 Condizioni economiche** — detrazione, netto, bollette, note, firma.
6. **Marketing statico** — JPG template (perché qualità, Altroconsumo, recensioni, garanzie, garanzia 10 anni).
7. **EcoSolare Design** (4 pagine circa):
   - D1: header EcoSolare Design + cliente + vista tetto + KPI finanziari (netto, NPV, payback) + box simulazione
   - D2: stacked produzione/consumo + tabella moduli + risparmio bolletta
   - D3: cashflow barre + tabella anni
   - D4: energia mensile + di nuovo layout tetto

### Limiti noti dell’attuale (da affrontare nel brief)

- Gerarchia tipografica e whitespace ancora “da template React-PDF”, non da brochure stampata.
- Numerazione sezioni inconsistente (§1, §2, poi “Garanzie”, poi §7).
- §2 “Caratteristiche” è soprattutto **listino prezzi**, mentre nel PDF commerciale di riferimento è **narrativa tecnica FV + PdC** (bullet brand, potenze, attività incluse). Il listino può restare ma non deve rubare il posto al racconto tecnico.
- Manca diagramma **orientamento/inclinazione** (rosa dei venti / casa 3D stilizzata) visto negli screenshot.
- Blocco **termico / schema di massima** poco o per nulla valorizzato rispetto al riferimento.
- EcoSolare Design esiste ma non ha ancora la densità/ritmo delle 6 pagine SolarEdge (legende, callout, coerenza header/footer di sezione, tabella moduli per falda reale, qualità grafici).
- Anteprima moduli: dipende dal **ri-salvataggio** dello studio; studi vecchi senza `anteprimaModuliDataUri` restano sul fallback ortofoto+SVG (da evitare in produzione commerciale).
- Pagine marketing sono statiche buone; il resto deve alzarsi al loro livello, non il contrario.
- Possibile gonfiamento jsonb per JPEG in snapshot — accettato per ora; se serve, migrare a storage file.

---

## 4. Obiettivo di design (definition of done)

Un PDF scaricato da un preventivo reale di prova deve:

1. **Superare il test del brand:** togliendo il logo, resta riconoscibile come EcoSolare (blu/oro, tono, EcoSolare Design), non come SolarEdge né come “PDF generico AI”.
2. **Superare il test del tetto:** la vista impianto è indistinguibile (a occhio) dalla vista Moduli in Sviluppo per quello studio.
3. **Superare il test del cuore:** le pagine EcoSolare Design sono il pezzo che il commerciale mostra per primo dopo la copertina/marketing — chiare, dense, belle, numericamente vere.
4. **Superare il test del cliente poco tecnico:** in 30 secondi si capiscono potenza, produzione, risparmio, payback, cosa è incluso.
5. **Superare il test stampa A4:** margini, niente tagli, footer fisso, numeri pagina, contrasti OK in B/N ragionevole.
6. **Non rompere** motori di calcolo, permessi, D-020, assenza costi.

---

## 5. Direzione creativa dettagliata

### 5.1 Principi

- Una cosa importante per pagina/viewport; gerarchia tipografica forte (H1 sezione → H2 → corpo → caption).
- Pochi elementi, bilanciati; niente clutter di chip/badge inutili.
- Numeri sempre in **Enfasi** (bold); unità chiare (kWp, kWh, MWh, €, anni).
- Grafici SVG: legende leggibili, scale coerenti, niente “sparigli” di colore; verde = beneficio, arancio = costo/rete, blu/teal = flussi energetici.
- Motion non esiste in PDF: compensare con ritmo di pagina, regole oro, barre KPI, frame chart sobri.
- Evitare look “AI template” (viola, cream+terracotta, giornale hairline, dark mode neon).

### 5.2 Header / footer

- Pagine commerciali (1–7-ish): logo centrato o letterhead già presente + footer sedi/sito.
- Pagine **EcoSolare Design**: header dedicato (brand «EcoSolare Design» + sottotitolo «Simulazione impianto» + logo piccolo + codice preventivo), box cliente (nome, indirizzo immobile, data, titolo proposta). Coerenza su tutte le D*.
- Footer: includere ragione sociale completa e CF/P.IVA quando disponibili in brand (oggi commento in `ecosolare.ts` dice che P.IVA si aggiunge quando disponibile — se c’è fonte ufficiale negli screenshot: *L.D. Service srl Unipersonale — CF/P.IVA 01312660119*, validare e mettere in brand).

### 5.3 Copertina

- Hero = **solo** anteprima Moduli (screenshot), non overlay SVG.
- KPI bar sotto: moduli, potenza CC, produzione/consumo — come oggi ma più curata (allineamenti, tipografia, eventuali etichette meno “CRM”).
- Trust strip 4 card: testo già in `ECOSOLARE.trust`; layout meno “stretto”, più brochure.
- Titolo proposta umano («Proposta Impianto 6 kW»), non codice interno.

### 5.4 §1 Dettagli impianto (allineare agli screenshot)

- Narrativa: potenza, n. pannelli, marca/modello se disponibili dal catalogo/righe, inverter.
- **Producibilità:** breve intro + **anteprima tetto** + elenco falde (inclinazione, esposizione, area).
- Ideale: piccolo diagramma orientamento (anche SVG stilizzato) se i dati falda lo consentono — presente nel riferimento, assente o debole oggi.
- Regime RID / detrazione: chiaro, senza legalese eccessivo.

### 5.5 §2 Caratteristiche (gap principale vs riferimento)

Oggi ≈ listino. Serve:

- Sottosezione **Impianto fotovoltaico** stile bullet commerciale (potenza, moduli con Wp e tipologia, inverter, struttura, linee DC/AC, cavi, quadri/scaricatori) — dati da righe preventivo + studio + dossier, **senza inventare marche** se non in dati.
- Sottosezione **Pompa di calore / termico** se `bloccoTermico` / dossier termico presente (già nel DTO).
- **Attività incluse** narrative (non solo elenco generico).
- Il **listino prezzi** può stare in pagina dedicata o in coda a questa sezione, ma non sostituire il racconto.

### 5.6 EcoSolare Design (cuore — priorità massima)

Obiettivo: densità e chiarezza delle pagine SolarEdge Design, brand EcoSolare.

Contenuti minimi (possono essere 4–6 pagine, ritmo migliore dell’attuale):

| Pagina | Contenuto |
|--------|-----------|
| Design 1 | Header + cliente + **grande** anteprima tetto + KPI finanziari (netto, NPV, payback) + risultati simulazione (kWp, produzione, moduli×Wp) |
| Design 2 | Stacked produzione (casa vs rete) e consumo (solare vs rete) con %; legende curate |
| Design 3 | Tabella configurazione moduli **per falda** se i dati lo permettono (oggi spesso totali); risparmio bolletta anno 1 |
| Design 4 | Cashflow grafico + tabella; disclaimer orizzonte modello |
| Design 5 | Energia mensile (barre) a piena larghezza; opzionale seconda anteprima tetto solo se non ridondante |
| Design 6 (opz.) | Sintesi “perché conviene” one-pager numerica (solo dati già calcolati) |

Regole:

- Mai ridisegnare moduli in SVG sopra la foto se esiste `anteprimaModuliDataUri`.
- Se manca anteprima: messaggio esplicito “layout non disponibile — riaprire e salvare lo studio in Sviluppo”, non overlay brutto.
- Tutti i numeri da `simulazione` / `condizioniEconomiche` / `dettagliImpianto` già nel DTO.

### 5.7 Termico / schema di massima

Se nel dossier c’è termico: pagina dedicata con descrizione + prezzo/detrazione già in `bloccoTermico`. Schema idraulico: solo se esiste asset reale (immagine in storage/dossier); **non** inventare schemi generici fuorvianti. Se non c’è asset, layout tipografico forte batte uno schema finto.

### 5.8 Marketing

Lasciare le JPG template; eventualmente riordinare se il flusso narrativo migliora (es. marketing subito dopo copertina vs dopo condizioni — **decidere in base al PDF Riboldi di riferimento** in attachments/transcript, non a caso).

---

## 6. Dati e wiring (non rompere)

### Fonti numeriche

- `simulaImpiantoFv({ snapshot, investimentoLordoCents, parametri })` in `quotes.ts` al build DTO.
- Snapshot studio: produzione, consumo, tariffe, frazione autoconsumo, layouts, poligoni, **anteprimaModuliDataUri**.
- Parametri globali: detrazione %, anni, orizzonte, inflazione, sconto, degradazione (`getParametriSimulazioneFv`).
- Anteprima: generata client in `laboratorio.tsx` → `catturaAnteprimaModuli` → persistita nello snapshot.

### Miglioramenti dati utili al design (se servono)

- Esporre per falda: n. moduli, kWp, pitch, azimuth (oggi `FaldaPdf` ha inclinazione/esposizione/area ma la tabella Design ripete totali).
- Marca/modello pannello/inverter dalle righe listino o dal formato moduli dello studio (`formatoId` / wattPicco).
- Garantire che ogni “Salva studio completo” aggiorni l’anteprima; opzionale: bottone “Aggiorna anteprima PDF” o rigenerazione server-side fedele all’editor (stessi colori) se il client fallisce.
- Non mettere costi fornitori nel PDF.

### React-PDF caveats (lezioni già pagate)

- `rgba()` / overlay SVG su Image: **fragile** (colori magenta/errati). Preferire bitmap unica.
- Absolute Image + Svg: allineamento viewBox vs `objectFit` delicato; meglio evitare overlay.
- Singleton `getDb()` in HMR: già mitigato per `siteStudies`; non correlato al PDF ma non regressare query studio.
- Font: solo famiglie registrate; Helvetica nei SVG grafici è ok per tick.

---

## 7. Piano di lavoro suggerito (ordine)

1. **Audit visivo pagina per pagina** del PDF attuale vs PDF/screenshot di riferimento (Riboldi + screenshot trust/dettagli/caratteristiche/schema). Elenco gap prioritizzati.
2. **Solidificare anteprima Moduli** (sempre presente su studi completi; framing; niente fallback SVG brutto in EcoSolare Design).
3. **Ridisegnare EcoSolare Design** (cuore): tipografia, spacing, KPI, grafici, header di sezione — obiettivo “wow” commerciale.
4. **Riscrivere §1 e §2** verso narrativa commerciale (non listino-first); listino in posizione secondaria chiara.
5. **Footer/legale/trust** allineati a fonti ufficiali.
6. **Termico** se dati/asset esistono.
7. **Pass di rifinitura:** margini A4, orphans, densità, test su 2–3 preventivi reali (solo FV; FV+PdC; multi-falda).
8. Aggiornare nota in `docs/01-registro-decisioni.md` (estensione redesign); test unitari sui mapper se cambiano DTO; `npm run check` prima di commit.

---

## 8. Criteri di accettazione (checklist)

- [ ] Copertina con anteprima = screenshot Moduli (stesso layout pannelli).
- [ ] Nessun overlay SVG magenta/verde “inventato” sopra l’ortofoto quando c’è anteprima.
- [ ] Blocco EcoSolare Design presente, brandizzato, con NPV/payback/bollette/cashflow/energia **del caso**.
- [ ] §1 leggibile da non tecnico; falde e producibilità chiare.
- [ ] §2 racconta FV (+ termico se c’è), non solo tabella prezzi.
- [ ] Trust + footer coerenti col materiale commerciale.
- [ ] Nessun costo/margine nel PDF.
- [ ] Multi-falda: anteprima unica con tutti i moduli; legenda corretta.
- [ ] PDF generabile senza crash; studi senza anteprima degradano in modo onesto.
- [ ] Confronto affiancato con PDF Riboldi: il commerciale dice “è meglio” o “è allo stesso livello con brand nostro” — non “è un export del gestionale”.

---

## 9. Cosa NON fare

- Non tornare al tema abisso/nero editoriale nel PDF cliente.
- Non reintrodurre overlay SVG “furbi” al posto dello screenshot Moduli.
- Non copiare trademark/testi SolarEdge; solo il **ruolo** delle pagine Design.
- Non hardcodare aliquote/detrazioni/soglie nel template (restano config).
- Non inventare marche, schemi idraulici o producibilità non calcolate.
- Non gonfiare il PDF di pagine vuote o marketing ridondante.
- Non commit/push senza richiesta esplicita dell’utente umano.
- Non modificare la matrice permessi / ADR per “comodità PDF”.

---

## 10. Riferimenti da aprire prima di disegnare

1. Screenshot utente in assets conversazione (trust, dettagli, caratteristiche, schema; confronti anteprima tetto “penoso” vs desiderato; vista Moduli Sviluppo).
2. PDF di riferimento commerciali (Riboldi / Preventivo-PRV-*) se presenti negli allegati agent o in `public/preventivo/`.
3. Codice attuale: `preventivo.tsx`, `grafici.tsx`, `anteprima-moduli.ts`, `ecosolare.ts`.
4. Editor reale: `src/app/(app)/sviluppo/editor-moduli.tsx` (colori e proiezione = verità visiva tetto).
5. Questo brief + D-020 nel registro decisioni.

---

## 11. Prompt operativo (incolla in Claude)

> Sei Claude nel repo EcoSolare OS. Obiettivo: elevare il PDF preventivo (`src/lib/pdf/preventivo.tsx` e satelliti) a dossier commerciale premium **EcoSolare Design**, superiore all’attuale e allineato ai feedback del fondatore (cuore = pagine ex-SolarEdge Design; tetto = screenshot vista Moduli; KPI finanziari per-caso; §1/§2 narrativi come screenshot; niente overlay SVG fragili).
> Leggi interamente il brief in `docs/10-brief-pdf-preventivo-claude.md`, il registro D-020, e i file PDF key sopra.
> Lavora a slice verticali verificabili (prima anteprima+Design, poi §1/§2, poi legale/termico).
> Mantieni data-driven, carta chiara blu/oro, grassetti sui numeri, zero costi nel payload.
> A fine slice: come testare (salvare studio → rigenerare PDF) e cosa è cambiato. Non commitare se non richiesto.

---

## 12. Esito atteso in una frase

Il cliente riceve un PDF che sembra preparato dal commerciale EcoSolare con strumenti Design proprietari — non un export del software — con il tetto vero, i numeri veri, e il brand **EcoSolare Design** al centro del racconto.
