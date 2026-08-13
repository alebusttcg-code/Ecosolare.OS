# Pagella EcoSolare OS — 12 agosto 2026

Analisi di semplicità d'uso e di solidità tecnica, con approfondimento sui
numeri e sulla catena **Sviluppo → Preventivo**.

Ho guardato: le 16 voci di menu e cosa ne vede ogni ruolo, i 36 moduli di
dominio, i 19 del PDF, i 16 solari, lo schema (48 tabelle, 25 migrazioni), i 69
file di test. Ho ricalcolato a mano i modelli energetici ed economici e li ho
confrontati con i tre dossier di riferimento.

**Non** ho guardato: la resa su schermo mobile, l'accessibilità, i tempi di
risposta sotto carico. Sono giudizi che richiedono misure che non ho fatto, e
preferisco non darli.

---

## Voto complessivo — **6,8**

Le fondamenta sono da azienda seria: permessi server-side senza scorciatoie,
denaro in aritmetica intera, coda transazionale, nessuna cancellazione. Su
questo si può costruire per anni.

Quello che non regge ancora il peso è **il modello che produce i numeri
venduti**. Non l'aritmetica — quella è corretta — ma le assunzioni fisiche a
monte: fuori dai tetti esposti a sud la produzione è sottostimata fino al 28%, e
il dato di irraggiamento che paghiamo a Google viene scartato. Un preventivo
sbagliato in difetto non fa rumore: fa perdere la vendita, e nessuno saprà mai
perché.

| # | Settore | Voto |
|---|---|---:|
| 1 | Fondamenta: dati, permessi, migrazioni | **8,5** |
| 2 | Motore energetico (produzione, autoconsumo, accumulo) | **5,5** |
| 3 | Motore economico (cashflow, VAN, TIR, LCOE) | **6,5** |
| 4 | Preventivo: dati in ingresso e coerenza | **5,5** |
| 5 | Documento PDF | **8** |
| 6 | Sezione Sviluppo (laboratorio tetto) | **6** |
| 7 | Navigazione e modello mentale | **6** |
| 8 | Ridondanze e codice morto | **5,5** |
| 9 | Collaudo | **7** |
| 10 | Esercizio e produzione | **7** |

---

# Parte I — I numeri

## 2. Motore energetico — **5,5**

### Cosa funziona, e va detto

**L'accumulo è modellato bene.** [`accumulo.ts`](../src/lib/domain/accumulo.ts)
lavora mese per mese e prende il minimo fra tre limiti fisici: quanto la
batteria può ciclare, quanto surplus avanza, quanto si sta ancora prelevando.
Il minimo fra tre limiti non può sovrastimare — è prudente per costruzione. Su
media annua un accumulo da 10 kWh sembrerebbe coprire quasi tutto il prelievo,
il che è falso perché a dicembre il surplus non esiste. Qui non succede.

**Il bilancio energetico conserva.** Autoconsumo + immissione = produzione,
autoconsumo + prelievo = consumo, con l'autoconsumo limitato sia dalla
produzione sia dal consumo.

### Il difetto che costa vendite

**L'esposizione è penalizzata troppo, e la taratura non se ne accorge.**

[`produzione-fv.ts:44`](../src/lib/domain/produzione-fv.ts) calcola il fattore di
orientamento come `0,58 + 0,42 · cos(Δ)`, dove Δ è lo scostamento da sud.
Confronto con i rapporti di producibilità attesi in Italia settentrionale:

| Scostamento da sud | Modello | Atteso | Errore |
|---|---:|---:|---:|
| 0° (sud) | 1,000 | 1,00 | 0% |
| 45° (SE/SO) | 0,877 | 0,96 | −9% |
| **90° (est/ovest)** | **0,580** | **0,80** | **−28%** |
| 135° (NE/NO) | 0,283 | 0,57 | −50% |
| 180° (nord) | 0,160 | 0,42 | −62% |

In pratica, 6 kWp a 30° su falda **est** a Lerici:

- modello: **753 kWh/kWp → 4.515 kWh/anno**
- realtà attesa: ~1.030 kWh/kWp → ~6.200 kWh/anno

Il preventivo perde **1.700 kWh l'anno**, cioè circa 400 € di risparmio annuo,
e il rientro si allunga di anni. Su un tetto a est — che in Italia è comunissimo
— stiamo raccontando un affare peggiore di quello che è.

**Perché nessuno se n'è accorto:** i tre dossier di taratura hanno azimut 174°,
203° e 239°, tutti a sud o sud-ovest. Il modello non è mai stato confrontato con
un tetto a est o a ovest.

**Perché i test non lo prendono:** i cinque test di
[`produzione-fv.test.ts`](../src/lib/domain/produzione-fv.test.ts) sono tutti
*ordinali* — «sud rende più di nord», «latitudine bassa rende più di alta» — più
una banda larghissima (1.000–1.600 kWh/kWp) verificata solo sul caso a sud. Il
fattore può sbagliare del 50% e restano tutti verdi.

### Il dato che paghiamo e buttiamo

La Solar API di Google restituisce, per ogni falda, i **sunshine quantiles**:
ore di sole all'anno effettive, che incorporano l'ombreggiamento reale — l'albero,
il palazzo di fianco, il camino. Sono estratti
([`building-insights.ts:218`](../src/lib/solar/building-insights.ts)) e poi:

- `maxSunshineHoursPerYear` viene **solo visualizzato** nel laboratorio;
- `sunshineMedio` entra nel calcolo **solo come rapporto fra le falde dello
  stesso tetto**, per giunta limitato a ±12%
  ([`produzione-fv.ts:57`](../src/lib/domain/produzione-fv.ts)).

Conseguenza: **due case identiche, una in mezzo al nulla e una all'ombra di un
condominio di sei piani, ricevono la stessa stima di produzione.** L'unica
informazione che il nostro modello non potrebbe mai dedurre da solo — l'ombra —
è quella che scartiamo.

L'ancora assoluta è invece `2860 − latitudine × 35`, una retta.

### Cosa farei

1. Ritarare `fattoreAzimut` su una tabella di riferimento (PVGIS) invece che su
   un coseno inventato, e **fissare i valori attesi in un test**: sud 1,00 ·
   SE/SO 0,96 · E/O 0,80 · NE/NO 0,57 · nord 0,42, con tolleranza ±3%.
2. Usare `sunshineMedio` come **fattore assoluto** rispetto a un riferimento di
   zona, non come rapporto interno: è il solo modo per far entrare l'ombra nel
   preventivo.
3. Aggiungere al PDF una riga che dichiara la fonte della stima. Un numero senza
   provenienza non si può difendere davanti a un cliente che ha già un altro
   preventivo in mano.

---

## 3. Motore economico — **6,5**

### Cosa funziona

**La degradazione è applicata in modo esatto, non approssimato.** Il risparmio è
`bolletta_attuale − bolletta_con_FV`; sviluppando, si dimostra che vale
`d · (autoconsumo · tariffa_prelievo + immissione · tariffa_cessione)`, cioè è
*esattamente* proporzionale al fattore di degradazione. Moltiplicare il risparmio
del primo anno per `(1−δ)^(n−1)` non è una scorciatoia: è l'identità.

**Il TIR è costruito bene** — bisezione su `[−investimento, …flussi]`, con
`null` quando il tasso non esiste invece di uno zero bugiardo. La bisezione è
lenta e stupida, ed è la scelta giusta: Newton-Raphson su flussi che cambiano
segno più volte diverge senza dirlo.

**Il LCOE attualizza anche l'energia**, non solo i soldi. È corretto e raro.

**La bolletta mensile non va sotto zero**, e l'eccedenza è dichiarata a parte
come accredito GSE. Una bolletta negativa non esiste.

### Il difetto: un piano a 25 anni senza un solo costo

[`economia-fv.ts:183`](../src/lib/domain/economia-fv.ts):

```
flusso = risparmio energia + risparmio termico + rata detrazione + rata conto termico
```

Non c'è **nessun costo di esercizio**. In venticinque anni:

- l'inverter si sostituisce quasi certamente una volta (~anno 12, 1.000–1.500 €);
- manutenzione e verifiche periodiche;
- assicurazione, se il cliente la fa;
- per la pompa di calore, manutenzione annuale obbligatoria.

Il risultato è che **VAN, TIR e ROI sono gonfiati e il rientro è più corto del
vero**. Su un impianto da 13.894 € l'inverter da solo sposta il VAN di ~800 € e
il rientro di diversi mesi.

Non è una svista di poco conto: è l'unico posto del piano dove il cliente,
facendo i conti da solo dopo dieci anni, ci troverà in fallo.

### Due scelte da dichiarare, non da nascondere

**«Costo effettivo stimato» somma la detrazione a valore nominale.** 6.947 € di
detrazione in dieci rate non valgono 6.947 € oggi: al 4% ne valgono ~5.630. È
prassi commerciale diffusa e non la cambierei, ma la dicitura dovrebbe dirlo.

**L'inflazione è applicata anche al ritiro dedicato.** Il prezzo di cessione è
regolato e non segue l'inflazione al dettaglio: applicargli +3% l'anno per 25
anni sovrastima la parte immessa in rete.

### Un'etichetta che dice il contrario del numero

[`indicatori-fv.ts:82`](../src/lib/domain/indicatori-fv.ts) stampa
«**Sovradimensionamento CC/CA: 97%**». Il 97% è un *sotto*dimensionamento: il
campo in continua rende meno dell'inverter. Il numero è giusto, il nome è
sbagliato — si chiami «rapporto CC/CA».

### Un rischio che il sistema non vede

Il piano dà per scontato che il cliente **abbia capienza IRPEF** per assorbire
694 € l'anno di detrazione per dieci anni. Un pensionato con imposta lorda
inferiore non la recupera, e il suo piano economico è un altro. Non esiste un
campo che lo registri, e non c'è un avviso.

---

## 4. Preventivo: dati in ingresso e coerenza — **5,5**

È il settore con il divario più largo fra la qualità del motore e la qualità di
ciò che gli si dà in pasto.

### Lo stesso prezzo inserito due volte

La pompa di calore è **una riga del preventivo** (con il suo prezzo, che entra
nel totale) **e** un `prezzoLordoEur` scritto a mano nel blocco termico
([`actions/quotes.ts:171`](../src/lib/actions/quotes.ts)), che decide come si
divide l'investimento fra quota FV e quota termica ai fini degli incentivi.

**Nessun controllo verifica che i due valori coincidano.** Se divergono, pagina 9
del preventivo mostra due verità diverse sullo stesso impianto, e il piano
economico è calcolato su quella sbagliata. È esattamente la classe di difetto che
abbiamo già corretto una volta sul PDF, rimasta in piedi a monte.

*Come lo farei:* il prezzo termico si **deduce dalle righe** con ruolo
`pompa_calore` — il dato c'è già in `leggiConfigurazione`. Il campo a mano
sparisce.

### Dati tecnici del prodotto scritti a mano, per ogni preventivo

Lo **SCOP** e il **prezzo del gas** si digitano nell'editor del preventivo
([`editor.tsx:727`](../src/app/(app)/preventivi/[id]/editor.tsx)):

- lo SCOP è una **proprietà della pompa di calore**, come `capacityKwh` lo è
  della batteria. Il catalogo prodotti ha già `ratedPowerW`, `acPowerKw`,
  `capacityKwh` — manca solo questo;
- il prezzo del gas è una **configurazione con validità temporale**, esattamente
  come le aliquote e le detrazioni che il progetto giustamente si vieta di
  scrivere nel codice.

Oggi ogni commerciale li ridigita a ogni preventivo. Sbaglieranno, e ognuno
sbaglierà in modo diverso.

### Il silenzio è la modalità predefinita

Se SCOP, prezzo gas o consumo gas mancano, il termico **non entra nel piano**:
resta un costo senza il suo risparmio, e il rientro peggiora. Il codice lo
dichiara onestamente («meglio un capitolo muto che un risparmio inventato») e la
scelta è giusta — ma **nell'interfaccia non compare alcun avviso**. Il
commerciale manda un preventivo con un rientro peggiore del vero senza sapere
che gli mancava un campo.

*Come lo farei:* un avviso in testa al preventivo, «la pompa di calore è a
preventivo ma non entra nel piano economico: manca lo SCOP», con il collegamento
al campo.

### Tre dati energetici, tre posti diversi

Consumo elettrico e gas stanno nello **studio tetto** (Sviluppo); SCOP e prezzo
gas nel **preventivo**; capacità batteria e potenza inverter nel **catalogo
prodotti**. Per capire perché un numero è sbagliato bisogna sapere in quale dei
tre posti cercarlo.

---

# Parte II — L'uso

## 7. Navigazione e modello mentale — **6**

### Il menu, per ruolo

| Ruolo | Voci visibili |
|---|---:|
| Amministratore | 16 |
| Contabilità | 10 |
| Commerciale | 10 |
| Operativo (cantiere) | 8 |

**Sedici voci sono troppe** per uno strumento in cui il lavoro quotidiano ne
tocca tre o quattro.

### Due voci mostrano le stesse righe

«Le mie scadenze» legge `activities` filtrando su assegnatario e non completate
([`dashboard.ts:150`](../src/lib/queries/dashboard.ts)). «Follow-up» legge le
stesse `activities` filtrando su `followUpPhase` non nullo.

**Il primo filtro non esclude il secondo insieme**: ogni follow-up aperto
assegnato a me compare in *entrambe* le voci di menu. Completandolo in una,
sparisce dall'altra senza spiegazione.

Il sintomo più chiaro è che l'interfaccia stessa prova a rimediare con una
parentesi nel sottotitolo: *«to-do personali (i follow-up commerciali stanno in
Follow-up)»*. **Un'etichetta che ha bisogno di una nota esplicativa sta
descrivendo una divisione che l'utente non ha in testa.**

### Quattro viste del tempo

`Follow-up` · `Agenda e sopralluoghi` · `Agenda cantieri` · `Le mie scadenze`.
Quattro voci per rispondere alla stessa domanda — *cosa devo fare, e quando* —
divise per criteri interni (la fase commerciale, il tipo di attività, il
reparto) che il sistema conosce e l'utente no.

### Il ciclo di vita spezzato in cinque

`Lead` → `Preventivi e firme` → `Clienti` → `Cantieri` → `Lavori completati`.
Sono **cinque voci per lo stesso oggetto** in cinque momenti della sua vita. Chi
lavora pensa «la pratica dei Bianchi», non «l'opportunità, poi il contatto, poi
la commessa».

### L'operativo vede cose che non gli servono

Un installatore vede «Preventivi e firme», «Follow-up» e «Agenda e sopralluoghi».
Non sono suoi. La matrice permessi è la trascrizione fedele del blueprint §11.2,
quindi **non la cambierei senza decisione aziendale** — ma vale la domanda: un
operativo deve leggere i prezzi di vendita?

### Cosa farei

1. **Fondere «Le mie scadenze» e «Follow-up»** in un'unica voce *Da fare*, con
   un filtro fra «commerciali» e «personali». Elimina la duplicazione vera e la
   parentesi esplicativa.
2. **Fondere le due agende** in *Calendario*, con un filtro reparto.
3. **Unire «Lavori completati» dentro «Cantieri»** come filtro di stato: è lo
   stesso oggetto, con `closedAt` valorizzato.
4. Menu risultante: 11 voci per l'amministratore, 6–7 per gli altri.
5. Dare una **home a ogni ruolo**: oggi solo l'amministratore ha una dashboard;
   un commerciale atterra su `/lead`, che è un elenco, non un quadro della
   giornata.

---

## 6. Sezione Sviluppo — **6**

È la parte più preziosa del prodotto — nessun concorrente locale mette
l'ortofoto con i moduli disegnati sul tetto in un preventivo — ed è anche la più
fragile da mantenere.

**3.613 righe in tre componenti client**: `laboratorio.tsx` (1.480, 23 `useState`),
`editor-moduli.tsx` (1.154, 12 `useEffect`), `mappa-tetto.tsx` (979). Un solo
file di test in tutta `src/app` (92 moduli).

Ventitré stati in un componente significa che il numero di combinazioni possibili
supera quello che una persona può tenere a mente. Non è un difetto oggi — funziona
— è un debito che si paga alla prima modifica fatta da qualcuno che non l'ha
scritto.

*Come lo farei:* estrarre la macchina a stati dello studio in un modulo puro
(come è già `studio-tetto.ts` per i calcoli) e coprirla con test. Il disegno resta
nel componente; le regole no.

---

## 5. Documento PDF — **8**

Il pezzo più curato. Copy identico al cartaceo, sezioni condizionali
(niente pagine di pompa di calore se non se ne vende una), coerenza dei numeri
verificata sul PDF stampato, schede tecniche allegate automaticamente dal
catalogo, degradazione dignitosa quando manca lo studio (9 pagine invece di 14
vuote).

Restano: la nota che distingue risparmio in bolletta da vendita dell'energia
(pagina 11 mostra un risparmio superiore alla bolletta senza spiegarlo) e i
termini di pagamento come costante di codice invece che campo del preventivo.

---

# Parte III — Igiene

## 8. Ridondanze e codice morto — **5,5**

Trovati con verifica di importazione, non a impressione:

| Cosa | Stato | Rischio |
|---|---|---|
| `src/lib/pdf/html/preventivo-stampa.css` (24 KB) | copia di `preventivo.css`, **già divergente di 83 righe** | se qualcuno passa a questo percorso, esce un documento con la copertina vecchia |
| `render-documento-completo.ts` | importato da nessuno | è l'unico che usa il CSS di cui sopra |
| `design.ts` (227 righe) | importato da nessuno | dichiara «se un numero non è in questo file non deve comparire in un foglio di stile» — e nessun foglio di stile lo legge |
| `registro-pagine.ts` | usato solo dal proprio test | — |
| rotte `/economia` e `/metriche` | redirect alla dashboard | innocue, tenerle per i segnalibri |

**Quattro superfici diverse rendono lo stesso documento**:
`/pdf-render/preventivi/[id]`, `/pdf-render/interno/preventivi/[id]`,
`/pdf-render/demo/walter`, più il renderer orfano. Una è morta e già divergente.

`design.ts` è il caso peggiore: un documento che si dichiara autorità e non lo è
è più dannoso di uno assente, perché il prossimo che lo legge crede di aver
capito le regole.

*Da eliminare:* i primi quattro. Sono 700+ righe e 24 KB che non fanno nulla se
non poter divergere.

## 9. Collaudo — **7**

| Area | Moduli | File di test |
|---|---:|---:|
| `lib/domain` | 36 | **29** |
| `lib/auth` | 9 | 7 |
| `lib/pdf` | 19 | 9 |
| `lib/solar` | 16 | 5 |
| `lib/actions` | 20 | **3** |
| `lib/queries` | 18 | **2** |
| `app` | 92 | **1** |

Il dominio è coperto quasi per intero, contro PostgreSQL vero: è la scelta
giusta e va difesa. Il bordo — le server action che scrivono e le query che
leggono — è quasi scoperto: sono i punti dove un errore corrompe i dati invece
di sbagliare un conto.

**Il difetto di forma più serio non è la quantità ma la natura dei test
energetici**: sono ordinali, non calibrati. Verificano che il sole sia meglio a
sud, non *quanto*.

## 1. Fondamenta — **8,5**

Da tenere così. Permessi server-side su ogni azione senza eccezioni; denaro in
aritmetica intera con arrotondamento per riga come vuole la fatturazione
italiana; sconti composti moltiplicativamente («10% + 10% è 19%, non 20%»);
coda transazionale con ritentativi; niente cancellazioni; 25 migrazioni
versionate; 16 ADR che spiegano il *perché*.

`pricing.ts` in particolare è esemplare: nessun numero in virgola mobile tocca
mai un euro.

## 10. Esercizio e produzione — **7**

Limite di frequenza sull'intake, MFA, sessioni revocabili, backup verificato,
audit log. Le tre giornate di errori sul PDF in produzione (impacchettamento
Chromium, librerie condivise, a-capo nel segreto) hanno lasciato messaggi
d'errore leggibili e test di regressione: è il modo giusto di uscirne.

Resta da sistemare: **`.env.local` punta al database di produzione**. Ogni prova
in locale scrive sui dati veri. È il rischio operativo più alto del progetto in
questo momento, e costa mezz'ora risolverlo.

---

# Piano, in ordine di ritorno

| # | Intervento | Stato |
|---|---|---|
| ~~1~~ | ~~Database di sviluppo separato da produzione~~ | **Fatto il 13 agosto** — guardia sugli script che cancellano; resta da creare il secondo progetto Supabase |
| ~~2~~ | ~~Ritarare il modello di producibilità~~ | **Fatto il 13 agosto** — il difetto era la separabilità, non la taratura |
| 3 | Costi di esercizio nel piano a 25 anni | **Sospeso** — da discutere con il cliente |
| ~~4~~ | ~~Prezzo termico dedotto dalle righe~~ | **Fatto il 13 agosto** |
| ~~5~~ | ~~SCOP nel catalogo, prezzo gas in configurazione~~ | **Fatto il 13 agosto** — e il catalogo è diventato compilabile |
| ~~6~~ | ~~Avviso «il termico non entra nel piano»~~ | **Fatto il 13 agosto** |
| ~~7~~ | ~~Fondere «Le mie scadenze» e «Follow-up»~~ | **Fatto il 13 agosto** — menu da 16 a 15 voci |
| ~~8~~ | ~~Eliminare CSS duplicato e codice morto~~ | **Fatto il 13 agosto** — 383 righe e 24 KB |
| ~~9~~ | ~~Usare i dati di ombreggiamento di Google~~ | **Fatto il 13 agosto** — riferimento la falda migliore, non la media |
| 10 | Fondere agende e stati del ciclo di vita | **Fatto a metà il 13 agosto** — cantieri sì, agende no: vedi sotto |

I punti 2, 3 e 4 cambiano i numeri che mandiamo ai clienti. Verrebbero prima di
tutto il resto se non fosse per il punto 1, che è quello che può far perdere
dati.

---

## Cosa è emerso strada facendo

Tre cose che l'analisi non aveva visto e che sono uscite mettendoci le mani.

**Il modello di producibilità non riproduceva i propri casi di taratura.**
Sottostimava Riboldi del 23%, Ricci del 21%, Tarantola del 34%. La causa non era
la calibrazione ma la forma: esposizione e inclinazione moltiplicate come se
fossero indipendenti, quando su un tetto piano l'esposizione non conta nulla.

**Le colonne tecniche del catalogo non erano compilabili da nessuna
interfaccia.** Esistono dalla migrazione 0021 e su tutti e sei i prodotti erano
nulle: l'intero preventivo girava sui ripieghi che leggono la descrizione con
espressioni regolari.

**I test dell'app non giravano affatto.** `vitest` includeva solo
`src/**/*.test.ts` e in tutta `src/app` c'era un file solo. Ora ce ne sono due,
ed è la strada per coprire il resto.

## Cosa resta aperto, e perché

**Le due agende non si fondono con un riordino.** La pagella le aveva messe
insieme fra le ridondanze, ma da vicino non lo sono: `/agenda` è un elenco di
sopralluoghi ordinato per data di creazione — non è nemmeno un calendario — e
`/cantieri/agenda` è un calendario di ordini di lavoro per giorno, con permessi
diversi (`survey` contro `schedule`). Unirle vuol dire progettare una vista
temporale unica su due oggetti diversi: è una funzione, non una pulizia. Per
ora sono state rinominate «Sopralluoghi» e «Calendario cantieri», perché il
problema immediato era che due voci che cominciano con «Agenda» sembrano
doppioni.

**Il menu è a 14 voci, non alle 11 previste.** Le tre che mancano sono le due
agende più quella che sarebbe sparita fondendole.

**Il punto 3 — i costi di esercizio nel piano a 25 anni — resta sospeso** per
decisione commerciale, non tecnica. È l'unico punto del piano dove il cliente,
rifacendo i conti dopo dieci anni, ci può trovare in fallo.

**Due cose sono inerti finché non ci mette mano qualcuno:** il progetto Supabase
di sviluppo (senza, la guardia ferma gli script ma si lavora ancora sui dati
veri) e i dati tecnici dei sei prodotti a catalogo (senza, i numeri del
preventivo continuano a dipendere da come è scritta una descrizione).
