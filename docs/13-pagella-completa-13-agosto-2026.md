# Pagella completa EcoSolare OS — 13 agosto 2026

Seconda passata, a un giorno dalla [pagella dell'12 agosto](11-pagella-crm.md) e
dopo la giornata di interventi che quella ha innescato. Non è un aggiornamento
di stato: è una lettura nuova, fatta come se il codice non l'avessi mai visto,
per non ereditare i giudizi vecchi su un codice che nel frattempo è cambiato.

## Metodo, e cosa ho verificato con le mani

Non mi sono fidato dei «Fatto il 13 agosto» segnati nei documenti: li ho
ricontrollati nel codice, uno per uno. Ho anche **misurato lo stato di salute**
invece di dedurlo:

| Verifica | Esito (13 agosto, ore 21) |
|---|---|
| `tsc --noEmit` | **pulito** |
| `eslint` | **pulito** — zero warning (l'avviso storico in `upload.ts` è sparito) |
| `vitest run` | **730 test verdi su 730**, 72 file — erano 410 in 38 file all'audit |

Ho letto integralmente: il policy layer, la sessione e il guard, lo schema
(48 tabelle), i motori di dominio che producono i numeri venduti
(`produzione-fv`, `economia-fv`, `indicatori-fv`, `money`), il layout di
navigazione e la sidebar, le firme delle server action critiche, i test
energetici, l'outbox, la cache DSM, il flusso di login. Ho campionato — non
letto riga per riga — il rendering PDF, il laboratorio Sviluppo (3.600 righe
client) e i gestori Drive/Telegram.

**Non ho misurato:** resa su mobile reale, accessibilità (contrasto, tastiera,
screen reader), tempi di risposta sotto carico, comportamento con 2.000 righe
in elenco. Sono giudizi che richiedono strumenti che qui non ho usato, e
preferisco dichiararli mancanti che darli a occhio.

---

## Voto complessivo — **7,3** → **7,7** (14 agosto)

Un giorno fa era 6,8. Il salto è reale e per tre ragioni concrete: **il modello
che produce i numeri venduti ora regge** (era il difetto che costava vendite in
silenzio), **l'igiene del codice è passata da problema a punto di forza**, e la
**base di test è quasi raddoppiata**. Le fondamenta erano già da azienda seria;
adesso lo è anche il primo strato sopra.

Quello che tiene il voto sotto l'8 non è più la qualità di ciò che c'è: è
**quello che manca dopo la firma** — fattura, ore lavorate, ticket, ordini a
fornitore non esistono come entità.

> Il 13 agosto un secondo freno era la **verifica in due passaggi**, spenta con
> la pagina rimasta orfana. Il 14 agosto è stata **esclusa per sempre** e il
> codice morto rimosso: non è più un difetto, è una decisione presa (vedi
> [addendum](#addendum--14-agosto-2026)).

> **Aggiornamento 14 agosto 2026** — dopo questa pagella sono stati chiusi tre
> punti; i voti aggiornati sono nell'ultima colonna e nell'[addendum](#addendum--14-agosto-2026) in fondo.

| # | Settore | 12 ago | 13 ago | 14 ago |
|---|---|---:|---:|---:|
| 1 | Fondamenta: dati, permessi, aritmetica, migrazioni | 8,5 | 9 | **9** |
| 2 | Motore energetico (produzione, ombra, accumulo) | 5,5 | 7,5 | **7,5** |
| 3 | Motore economico (cashflow, VAN, TIR, LCOE) | 6,5 | 6,5 | **6,5** |
| 4 | Preventivo: dati in ingresso e coerenza | 5,5 | 7 | **9** |
| 5 | Documento PDF | 8 | 8 | **8** |
| 6 | Sezione Sviluppo (laboratorio tetto) | 6 | 6 | **6** |
| 7 | Navigazione e modello mentale | 6 | 7 | **7** |
| 8 | Sicurezza ed esercizio | 7 | 6,5 | **8** |
| 9 | Collaudo | 7 | 7,5 | **7,5** |
| 10 | Igiene del codice | 5,5 | 8 | **8** |
| 11 | Completezza funzionale (ciclo del denaro) | — | 4 | **4** |

I due settori che pesano verso il basso — **8** (sicurezza) e **11**
(completezza) — sono anche gli unici due dove il rischio non è di eleganza ma di
soldi veri e di dati veri.

---

# Parte I — I numeri che mandiamo al cliente

## 1. Fondamenta — **9**

Il pezzo che un anno fa scriverei «da tenere così» e oggi anche. Verificato riga
per riga, non a impressione.

- **Aritmetica monetaria da manuale.** [`money.ts`](../src/lib/domain/money.ts)
  lavora su interi in unità scalate — centesimi, decimillesimi (i prezzi hanno
  quattro decimali perché nel FV si ragiona in euro/Watt), millesimi, punti
  base. Nessun `float` tocca mai un euro. `dividiArrotondando`
  ([money.ts:44](../src/lib/domain/money.ts)) fa l'arrotondamento commerciale
  *away from zero* invece di `Math.round`, con la spiegazione del perché sui
  negativi il default sbaglierebbe di un centesimo dalla parte sbagliata.
- **Permessi server-side senza scorciatoie.**
  [`policy.ts`](../src/lib/auth/policy.ts) è puro — niente DB, niente Next — e
  la matrice è una *whitelist*: tutto ciò che non è elencato è negato, quindi una
  risorsa nuova nasce inaccessibile. `guard()`
  ([session.ts:83](../src/lib/auth/session.ts)) rilegge l'utente dal database a
  ogni richiesta (una revoca ha effetto immediato) e registra ogni diniego
  nell'audit. `getProjectDetail` ora fa il gating dei costi **nella query**
  ([projects.ts:217](../src/lib/queries/projects.ts)), non nel componente: il
  buco «regge per fortuna» dell'audit (D7) è chiuso alla fonte.
- **48 tabelle, 26 migrazioni versionate, RLS su tutte.** Il test dello schema
  conta le tabelle con RLS invece di elencarle: protegge il futuro, non
  fotografa il presente.

Nulla da fare qui, se non non romperlo. Unica ombra, minore, sotto Igiene: una
migrazione orfana (§10).

## 2. Motore energetico — **7,5** _(da 5,5)_

Questo è il salto più grosso, ed è meritato. Il difetto che «costava vendite in
silenzio» — l'esposizione penalizzata fino al 28% su un tetto a est — non c'è più.

**Cosa è cambiato, e perché è giusto.** Il modello separabile (esposizione ×
inclinazione, moltiplicati come se fossero indipendenti) è stato sostituito da
una **tabella bilineare** inclinazione × scostamento-da-sud
([produzione-fv.ts:86](../src/lib/domain/produzione-fv.ts)) con interpolazione
lineare fra i nodi. Non è un dettaglio: su un tetto piano l'esposizione non conta
nulla, e nessun modello separabile può dirlo. La riga a 0° è costante — fisica,
non taratura — e lungo ogni riga i valori non risalgono mai allontanandosi da sud.

**L'ombra di Google ora entra nel preventivo.** `fattoreOmbra`
([produzione-fv.ts:163](../src/lib/domain/produzione-fv.ts)) confronta le ore di
sole della falda con la **falda migliore** del tetto, non più con la media
compressa a ±12%. L'unica informazione che il modello geometrico non potrebbe
mai dedurre — l'albero, il condominio di fianco — adesso pesa.

**I test non sono più bugiardi.** Prima erano ordinali («sud rende più di
nord») e restavano verdi mentre il modello sottostimava i dossier del 21–34%.
Ora sono **calibrati**: `fattoreOrientamento(30,180)` deve fare 1,00,
est 0,86, nord 0,67, con tolleranza fissata
([produzione-fv.test.ts:44](../src/lib/domain/produzione-fv.test.ts)). Se
qualcuno ritocca la tabella, il test dice *di quanto* e *su quale caso*.

**Cosa resta, ed è un limite dichiarato, non una svista.** Il fattore d'ombra
usa la falda migliore *dello stesso tetto* come riferimento: **un edificio
ombreggiato per intero** — dietro una collina, in un cortile stretto — ha tutte
le falde basse insieme, quindi il rapporto resta 1 e l'ombra sparisce. Il codice
lo scrive onestamente ([produzione-fv.ts:155](../src/lib/domain/produzione-fv.ts)).
Chiuderlo richiede un riferimento di zona esterno, che oggi non c'è. È l'unico
caso rimasto in cui la produzione può essere sovrastimata — ed è l'errore che fa
male al contrario di prima: promette più del vero.

## 3. Motore economico — **6,5** _(invariato)_

La parte corretta è ancora corretta, e va difesa: degradazione applicata come
identità e non come approssimazione, TIR per bisezione con `null` onesto quando
il tasso non esiste ([indicatori-fv.ts:105](../src/lib/domain/indicatori-fv.ts)),
LCOE che attualizza anche l'energia, bolletta mensile che non scende sotto zero
con l'eccedenza dichiarata a parte come accredito GSE
([economia-fv.ts:145](../src/lib/domain/economia-fv.ts)).

Il voto non sale perché **i due difetti di merito sono ancora lì**, entrambi
verificati nel codice di oggi:

1. **Un piano a 25 anni senza costi di gestione — ora per scelta dichiarata.**
   Il flusso annuo ([economia-fv.ts](../src/lib/domain/economia-fv.ts)) è
   `risparmio energia + risparmio termico + rata detrazione + rata conto termico`:
   nessun opex (inverter, manutenzione, assicurazione). VAN, TIR e ROI sono
   quindi al lordo dei costi di esercizio. **Dal 14 agosto non è più un difetto
   aperto:** è una decisione commerciale registrata ([D-020](01-registro-decisioni.md)),
   con il vincolo esplicito che il modello non presenti mai l'opex come incluso.
   Resta il fatto che i numeri sono ottimisti *per scelta*, non che siano
   sbagliati di nascosto.
2. **L'inflazione è applicata anche alla parte ceduta.** Il risparmio anno 1
   somma prelievo evitato *e* ricavo da cessione, e li fa crescere entrambi con
   `fattoreInfl` ([economia-fv.ts:165](../src/lib/domain/economia-fv.ts)). Il
   prezzo del ritiro dedicato è regolato, non segue l'inflazione al dettaglio:
   +3%/anno per 25 anni sulla quota immessa la sovrastima.

## 4. Preventivo: dati in ingresso — **9** _(da 7, 14 agosto)_

Il settore che l'audit descriveva come «il divario più largo fra la qualità del
motore e la qualità di ciò che gli si dà in pasto» è ora chiuso.

**Risolto e verificato:**
- **SCOP è ora una proprietà del prodotto.** Colonna `scop numeric(4,2)` sul
  catalogo ([schema.ts:860](../src/db/schema.ts)), come `capacityKwh` per la
  batteria. Non si ridigita a ogni preventivo.
- **Il prezzo del gas ha un default configurabile con override.**
  `diagnostica-termico` distingue `prezzoGasPredefinito` (configurazione) da
  `prezzoGasManuale` (eccezione consapevole).
- **Il silenzio non è più la modalità predefinita.** `termicoEntraNelPiano` e
  `datiMancantiTermico` ([diagnostica-termico](../src/lib/domain/diagnostica-termico.ts))
  esistono, sono testati, e alimentano un avviso quando la pompa di calore è a
  preventivo ma non entra nel piano perché manca un dato.

- **La coerenza del prezzo termico ora è un fatto verificabile, non una
  speranza (14 agosto).** L'ultima falla era che un `prezzoLordoEur` scritto a
  mano nei preventivi storici poteva divergere dalla somma delle righe
  `pompa_calore`, e le righe vincevano *in silenzio*. Ora la regola di scelta
  vive in un'unica funzione pura e testata,
  [`coerenzaPrezzoTermico`](../src/lib/domain/diagnostica-termico.ts) (che riusa
  `prezzoTermicoEffettivoCents`, non la riscrive), e l'editor accende un avviso
  quando il valore a mano diverge da quello dedotto: chi apre un preventivo
  storico lo vede, invece di scoprirlo confrontando due pagine. Sette test nuovi
  coprono i casi — righe vincenti, ripiego storico, divergenza, scarto sotto
  l'euro, input sporchi.

**Cosa resta (minore):** il campo `prezzoLordoEur` sopravvive nello schema come
ripiego per i preventivi storici senza righe termiche; salvando un preventivo
con righe riconosciute il valore si riallinea da solo. Non è più un rischio di
coerenza, è un campo in via di estinzione.

## 5. Documento PDF — **8** _(invariato)_

Ancora il pezzo più curato: copy identico al cartaceo, sezioni condizionali,
schede tecniche allegate dal catalogo, degradazione dignitosa quando manca lo
studio. Resta un dettaglio che l'audit precedente aveva colto e che è **ancora
lì**: l'etichetta «**Sovradimensionamento CC/CA**»
([mappa-simulazione-pdf.ts:152](../src/lib/pdf/mappa-simulazione-pdf.ts)) mostra
un valore che è il rapporto potenza-CC / potenza-CA. Quando il campo rende meno
dell'inverter (il caso normale) il numero è sotto 100, cioè un
*sotto*dimensionamento: il valore è giusto, il nome dice il contrario. Si chiami
«rapporto CC/CA». Restano anche i termini di pagamento come costante di codice
invece che campo del preventivo.

---

# Parte II — L'uso

## 6. Sezione Sviluppo — **6** _(invariato)_

È la parte più preziosa del prodotto — l'ortofoto con i moduli disegnati sul
tetto, che nessun concorrente locale mette in un preventivo — ed è ancora la più
fragile da mantenere. `laboratorio.tsx` ha **23 `useState`** in un solo
componente; `editor-moduli.tsx` ha **12 `useEffect`**. In tutta `src/app`
i file di test sono **2** su 95 moduli.

Ventitré stati significa che le combinazioni possibili superano quello che una
persona tiene a mente: non è un difetto oggi — funziona — è un debito che si paga
alla prima modifica di chi non l'ha scritto. La strada resta quella già indicata:
estrarre la macchina a stati in un modulo puro (come è già `studio-tetto.ts` per
i calcoli) e coprirla con test. Non è stato fatto, ed è comprensibile che non lo
sia stato: è lavoro senza gratificazione immediata su codice che gira.

## 7. Navigazione e modello mentale — **7** _(da 6)_

Il riordino ha fatto quello che poteva fare senza diventare una funzione nuova.

**Fatto e verificato in [`layout.tsx`](../src/app/(app)/layout.tsx):**
- Il menu è passato da 16 a **13 voci** (amministratore). «Le mie scadenze» e
  «Follow-up» sono fuse in **«Da fare»**: sparisce la duplicazione vera e la
  parentesi esplicativa che la tradiva.
- Le due agende non si chiamano più entrambe «Agenda»: **«Sopralluoghi»** e
  **«Calendario cantieri»**, così due voci non sembrano doppioni.
- Gli URL coincidono con le etichette (`/lead`, `/clienti`, `/cantieri`): niente
  gergo tecnico nascosto.

**Cosa resta, per scelta più che per svista:**
- **Il ciclo di vita è ancora spezzato in cinque voci** — Lead → Preventivi →
  Clienti → Cantieri (+ filtro Completati). Chi lavora pensa «la pratica dei
  Bianchi», non «l'opportunità, poi il contatto, poi la commessa». Unirle è una
  funzione, non una pulizia, e la matrice permessi è la trascrizione del
  blueprint: non la toccherei senza decisione aziendale.
- **Solo l'amministratore ha una home.** Un commerciale atterra su `/lead`, che
  è un elenco, non il quadro della sua giornata. È il singolo intervento di UX
  con il ritorno più alto rimasto: `soloRuolo: 'amministratore'` sulla dashboard
  ([layout.tsx:54](../src/app/(app)/layout.tsx)) andrebbe sostituito da una home
  per ruolo, non tolta.

---

# Parte III — Dove il rischio è di soldi e di dati

## 8. Sicurezza ed esercizio — **6,5** _(da 7: unico settore in calo)_

Molto è solido e verificato: rate limit sull'intake a finestra scorrevole,
sessioni revocabili, audit log, backup dei documenti verificato, soft-delete al
posto della cancellazione, e — risultato importante — il **database di sviluppo
è ora separato da produzione** (`.env.local` punta a un progetto Supabase
diverso da quello in `.env.produzione.local.bak`). Il rischio operativo più alto
della pagella precedente è chiuso.

Il 13 agosto il voto scendeva per la verifica in due passaggi spenta con la
pagina orfana. Il 14 agosto quel punto è chiuso (vedi sotto) e il settore
risale a **8**; restano aperti solo i due rischi minori qui sotto.

**✅ Verifica in due passaggi — esclusa per sempre (14 agosto).** Era il rilievo
🔴 di ieri: decisione presa e codice morto rimosso. L'accesso resta a fattore
singolo per scelta di prodotto ([ADR-013](adr/013-verifica-in-due-passaggi.md),
superata; [D-020 e D-018](01-registro-decisioni.md)). Dettagli
nell'[addendum](#addendum--14-agosto-2026).

**🟡 Le chiamate a Google Solar — D11, in gran parte chiuso (14 agosto).** I
`buildingInsights` (fino a 25 chiamate a pagamento per click, per trovare
l'edificio) ora si **persistono** su tabella `building_insights_cache` con chiave
lat/lng arrotondata: lo stesso tetto si paga una volta, non a ogni click
([building-insights-cache.ts](../src/lib/solar/building-insights-cache.ts)).
Restano due code minori: la cache DSM è ancora un `Map` di processo
([dsm-cache.ts:4](../src/lib/solar/dsm-cache.ts)) e non c'è un tetto giornaliero
per utente. Il grosso della bolletta — il probing dell'edificio — non c'è più.

**🟠 Nessun controllo di concorrenza sui preventivi (D10).**
`replaceQuoteLines` verifica lo *stato* della versione ma non la sua *età*
([quotes.ts:243](../src/lib/actions/quotes.ts)): due persone sulla stessa bozza
si sovrascrivono in silenzio, e chi salva per secondo vince senza sapere di aver
cancellato il lavoro dell'altro. Basta una colonna `version` intera confrontata
nella `where`.

## 9. Collaudo — **7,5** _(da 7)_

La base di test è quasi raddoppiata: **730 test in 72 file**, contro 410 in 38.
E la crescita è nei posti giusti:
- **Le server action critiche hanno cominciato ad avere test veri**, contro
  PostgreSQL (PGlite): `firma-contratto.test.ts`, `preventivo-righe.test.ts`,
  `catalogo.test.ts`.
- **Le query hanno i primi test** (`costi.test.ts`, `salute.test.ts`): il cost
  gating è ora sorvegliato, non solo scritto.
- I test energetici sono passati da ordinali a **calibrati** (§2).

Cosa resta scoperto, ed è la ragione per cui non arriva all'8:
- `schedule.ts` (723 righe), `banca.ts` (514), `opportunities.ts` (737) — tre dei
  file più lunghi, che toccano soldi e stati — **non hanno un solo test**.
- L'app resta a **2 test su 95 moduli**: il laboratorio Sviluppo, dove vive la
  logica più fragile, è quasi tutto scoperto.
- **Nessun end-to-end.** Il percorso lead → preventivo → firma → cantiere è il
  cuore del prodotto e nessuno lo ripercorre automaticamente.

## 10. Igiene del codice — **8** _(da 5,5)_

Il salto più netto dopo il motore energetico. Il codice morto segnalato dalla
pagella precedente **è stato rimosso e l'ho verificato assente**: `design.ts`
(l'autorità fasulla), `render-documento-completo.ts`, il CSS di stampa duplicato
e già divergente, `registro-pagine.ts`. Il lint è pulito, zero warning.

Resta un solo residuo, minore ma dello stesso genere che tradisce quando si
guarda in fretta: **`drizzle/0011_survey_files_rls.sql` non è nel journal** — lo
slot 0011 è occupato da `0011_dizzy_excalibur` — quindi non viene mai applicata.
È innocua (la stessa istruzione sta altrove) ma un file di migrazione che il
sistema ignora va cancellato.

## 11. Completezza funzionale — **4** _(nuovo)_

Non c'era nella pagella precedente e lo aggiungo perché è la parte che tiene giù
il voto complessivo più di ogni difetto di qualità. Il sistema copre bene
**lead → preventivo → firma → cantiere**. Tutto ciò che viene *dopo la firma* —
dove stanno i soldi veri — o non c'è o è solo previsto.

Ho verificato nello schema: **`invoices`, `time_entries`, `tickets`,
`purchase_orders` non esistono come tabelle**. Eppure:
- `invoice` è nella matrice permessi, ci sono piani di pagamento e
  riconciliazione bancaria — **ma nessuna fattura**. In Italia la fattura
  elettronica è obbligatoria: finché il gestionale non la conosce, esiste un
  secondo sistema che diverge.
- `time_entry` è nella matrice con `write` per il cantiere — **ma la manodopera
  non si registra**. È la voce che decide se un cantiere ha guadagnato o perso, e
  senza di essa il «margine reale» che il sistema mostra non è reale. Questo
  svuota metà dell'ADR-008.
- `ticket` è nella matrice — **ma il post-vendita non c'è**. Nel FV è dove si
  decide la reputazione, e oggi vive su WhatsApp.
- Nessuna traccia di **garanzie e manutenzione programmata** (ricavo ricorrente)
  né di **ordini a fornitore** come entità.

Nessuno di questi è un bug: sono funzioni non ancora costruite, e la scelta di
costruire prima il motore del preventivo era difendibile. Ma è qui che il
prodotto, come strumento aziendale, è ancora a metà.

---

# Piano, in ordine di ritorno

| # | Intervento | Perché | Sforzo |
|---|---|---|---|
| ~~1~~ | ~~Decidere l'MFA~~ | **Fatto il 14 agosto** — escluso per sempre, codice morto rimosso | — |
| ~~2~~ | ~~Google Solar: cache persistente dei buildingInsights (D11)~~ | **Fatto il 14 agosto** — restano cache DSM e tetto giornaliero | — |
| ~~3~~ | ~~Costi di esercizio nel piano a 25 anni~~ | **Chiuso il 14 agosto** — esclusi per decisione ([D-020](01-registro-decisioni.md)), non più un difetto | — |
| 4 | Controllo di concorrenza sui preventivi (D10) | Lavoro cancellato in silenzio fra due commerciali | mezza giornata |
| 5 | Registrazione ore lavorate (`time_entries`) | Senza, il margine mostrato non è vero | 3–4 giorni |
| 6 | Fatture almeno come entità (`invoices`) | Chiude il ciclo del denaro | 1 settimana |
| 7 | Test su `schedule.ts`, `banca.ts`, `opportunities.ts` | I file più lunghi che toccano soldi, oggi scoperti | continuativo |
| 8 | Home per ruolo (non solo admin) | Il commerciale atterra su un elenco, non sulla giornata | 1–2 giorni |
| — | ~~Controllo di coerenza sul prezzo termico~~ (**fatto il 14 agosto**); cancellare `0011_survey_files_rls.sql`; rinominare «Sovradimensionamento CC/CA» | Residui minori | mezz'ora |

Restano due rischi piccoli da presidiare (D11, D10) e poi il salto vero:
**registrare le ore e le fatture**, dove il prodotto smette di essere a metà.
Prima non farsi male, poi fatturare il lavoro che già si fa.

---

## Una nota, la stessa dell'audit e ancora vera

Il laboratorio Sviluppo — editor moduli, mappa tetto, DSM — è da solo più codice
di tutte le server action che gestiscono i soldi messe insieme, ed è la parte più
divertente da costruire. Le ore lavorate e la fattura sono meno affascinanti del
posizionamento 3D dei moduli, e valgono di più. Il rischio del progetto non è
tecnico — la qualità è sopra la media di ciò che si trova in gestionali di questa
dimensione — è di **distribuzione dell'attenzione**.

---

# Addendum — 14 agosto 2026

Tre punti chiusi il giorno dopo la pagella. Tutto verificato a terra:
`tsc` pulito, `eslint` pulito, **707 test verdi in 69 file**.

### 1. Verifica in due passaggi — esclusa per sempre (settore 8: 6,5 → 8)

Decisione di prodotto: l'accesso resta a fattore singolo (email + password), e
non tornerà. Non era più solo spenta — era **codice morto che fingeva una
protezione** — quindi è stata rimossa:

- via la pagina orfana `/due-passaggi`, le server action `*Mfa`, i moduli
  `auth/totp`, `auth/mfa`, `auth/cifratura` e i loro test, la variabile
  `MFA_SECRET_KEY` da `env.ts`, `.env.example` e `configura.ts`;
- `session.ts` semplificato (via `mfaAttiva`/`totpEnabledAt`), `requireUser`
  senza più il parametro-fantasma `consentitoSenzaMfa`;
- decisione scritta in [ADR-013](adr/013-verifica-in-due-passaggi.md) (superata)
  e nel [registro (D-018)](01-registro-decisioni.md).
- Le colonne `totp_*` restano nello schema, inerti: rimuoverle richiede una
  migrazione dedicata e non porta valore. È l'unico residuo, ed è dichiarato.

### 2. Costi di gestione del cliente — esclusi per decisione (settore 3: invariato)

Il piano a 25 anni resta al lordo dell'opex, ma non è più un difetto sospeso: è
la decisione [D-020](01-registro-decisioni.md), con un vincolo scritto anche nel
codice ([`economia-fv.ts`](../src/lib/domain/economia-fv.ts)) — il modello non
deve **mai** presentare l'opex come incluso. I numeri sono ottimisti per scelta
dichiarata, non sbagliati di nascosto.

### 3. Preventivo: dati in ingresso e coerenza — portato a 9 (settore 4: 7 → 9)

L'ultimo rischio di coerenza era il prezzo termico scritto a mano nei preventivi
storici, che poteva divergere dalla somma delle righe con le righe che vincevano
in silenzio. Ora:

- la regola di scelta è **una sola funzione pura e testata**,
  [`coerenzaPrezzoTermico`](../src/lib/domain/diagnostica-termico.ts), che riusa
  `prezzoTermicoEffettivoCents` invece di riscriverla;
- l'editor accende un **avviso di divergenza** quando il valore a mano non
  coincide con quello dedotto — chi apre un preventivo storico lo vede subito;
- **sette test nuovi** coprono i casi (righe vincenti, ripiego storico,
  divergenza oltre l'euro, scarto sotto l'euro che è solo arrotondamento, input
  non-finiti che diventano zero).

Cosa **non** ho fatto, e lo dico: l'avviso di divergenza è verificato a livello
di dominio (test) e col typecheck, **non nel browser** — comparirebbe solo su un
preventivo storico con prezzo manuale divergente dalle righe, uno stato che
richiede di seminare dati apposta. La logica sottostante è coperta dai test.

**Voto complessivo: 7,3 → 7,7.** Restano a muovere l'ago i due grandi assenti —
ore lavorate e fatture — non più la sicurezza né la coerenza del preventivo.
