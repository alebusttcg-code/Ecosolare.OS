# Motore fisico autonomo di producibilità — design

**Data:** 14 agosto 2026 · **Stato:** design, in costruzione · **Decisione:** [ADR-016](adr/016-motore-fisico-autonomo.md)

Piano per sostituire l'attuale motore di producibilità — una formula calibrata
sui tre dossier SolarEdge — con un **motore fisico autonomo**, alimentato dalle
Solar API che già chiamiamo, capace di preventivare qualunque tetto con
accuratezza pari o superiore a SolarEdge Designer, **senza dipendere da SolarEdge
e senza chiamare nessuno a runtime**.

Nasce dall'analisi in [docs/14](14-solaredge-vs-motore.md): lì si è visto *come*
lavora SolarEdge; qui si progetta come lo facciamo noi, meglio e in casa.

---

## 1. Il principio

Due regole guidano ogni scelta che segue.

1. **SolarEdge è un rivale, non un'autorità.** Non ci si tara su di lui: ci si
   misura con lui. La fisica di riferimento è quella pubblica — **PVGIS** (Centro
   Comune di Ricerca UE), **pvlib**, i modelli **NREL SAM** — non un prodotto
   commerciale. I tre dossier consegnati servono a **validare**, mai a calibrare.

2. **Autonomia a due livelli, entrambi obbligatori.**
   - **(a) dagli strumenti umani:** nessuno apre più un Designer e ricopia numeri;
     il software preventiva da solo.
   - **(b) dalle dipendenze a runtime:** mentre fa un preventivo il motore **non
     chiama nessuno**. Le API di dati si toccano una volta sola, all'ingest di un
     sito nuovo; da lì i dati sono **nostri**, in database.

La chiave che rende possibile la (b): la climatologia di un sito e la geometria
di un tetto **non cambiano da un preventivo all'altro**. Si ingeriscono una volta
e si posseggono. Chiamare un'API a ogni iterazione del laboratorio sarebbe
fragile, costoso e concettualmente sbagliato — si ri-scaricherebbe un dato
statico.

---

## 2. La catena fisica

Ogni anello è un modulo di dominio puro e testabile. La produzione nasce da qui,
non da una costante.

| # | Anello | Cosa fa | Fonte / modello |
|---|---|---|---|
| 1 | **Climatologia** | Irraggiamento (GHI/DNI/DHI) e temperatura, orari o mensili-tipici, sul punto | **PVGIS** (TMY/`seriescalc`), ingerito e salvato per sito |
| 2 | **Trasposizione** | Da orizzontale al piano dei moduli, per falda (tilt+azimut) | Hay-Davies / Perez |
| 3 | **Temperatura di cella** | Derating termico dell'efficienza | Faiman / NOCT |
| 4 | **Ombra** | Ore di sole reali per falda, dal 3D del tetto | **Google Solar** (`sunshineQuantiles` + DSM), già in casa |
| 5 | **Perdite di sistema → PR** | Cablaggio, sporcamento, mismatch, degradazione | coefficienti espliciti, dichiarati |
| 6 | **Inverter + clipping** | Conversione CC→CA e troncamento sui picchi | curva d'efficienza + limite CA |
| 7 | **Bifacciale** | Guadagno del retro | fattore per tipo di modulo |
| → | **Produzione oraria** | Giorno-tipo mensile, kWh per (mese, ora) | uscita del motore |

Rispetto all'attuale `produzione-fv.ts` (resa annua da formula), cambia la
direzione: **dalla fisica del sito ai numeri**, non da una resa calibrata
distribuita con pesi fissi. Il `fattoreOmbra` odierno — rapporto fra le ore Google
della falda e quelle della falda migliore — diventa l'anello 4, ma **assoluto**:
ore di sole reali contro le ore teoriche del piano, così anche un edificio
ombreggiato *per intero* (oggi punto cieco) viene visto.

### Quello che ci fa stare meglio di SolarEdge

L'anello 4. SolarEdge modella l'ombra nel suo 3D interno; noi abbiamo l'ombra
**misurata** da foto aeree (Google). Su un tetto con un albero o un condominio di
fianco, un dato misurato batte un modello.

---

## 3. Il consumo e l'autoconsumo

È la metà che nessuna API solare dà, ed è dove l'autoconsumo si decide.

### Il modello di carico — già costruito

[`profili-carico.ts`](../src/lib/domain/profili-carico.ts) replica il metodo di
SolarEdge, che è anche quello che l'azienda già usa: **consumo annuo dalla
bolletta + un profilo di utenza** che lo distribuisce su mesi e fasce orarie. Un
profilo è forma statica (dodici pesi mensili + cinque fasce), quindi **zero
dipendenze a runtime**: la (b) sul consumo è risolta alla radice.

Seminato dalle schermate consegnate: `FAMIGLIA_1_2` è completo (mensile +
giornaliero); i pesi mensili della pompa di calore ci sono
(`PESI_MENSILI_FULL_ELECTRIC_PDC`), il suo profilo giornaliero è **da catturare**
prima di renderlo usabile — non lo si inventa, falserebbe l'autoconsumo. La
libreria si estende una utenza alla volta.

### Il matching — già costruito

`autoconsumoDaMatching` confronta produzione e consumo **cella per cella** su una
griglia mese × ora: in ogni cella autoconsuma il minimo. È la stessa
conservazione di `bilanciaEnergia`, ma alla risoluzione dove l'autoconsumo esiste
davvero — non sull'anno, dove un surplus di mezzogiorno cancella per finta un
prelievo che avviene otto ore dopo. Sostituisce la frazione fissa 0,40.

L'accumulo ([`accumulo.ts`](../src/lib/domain/accumulo.ts)) si applica sopra,
com'è già.

### Sinergia col resto del preventivo

Il profilo lo può **suggerire il preventivo stesso**: se le righe contengono una
pompa di calore, il motore propone il profilo full-electric invece di farlo
scegliere a mano. SolarEdge lo fa selezionare; noi lo deduciamo da cosa vendiamo.

---

## 4. Architettura dei moduli

Confini netti fra ciò che è puro (testabile, senza rete) e ciò che tocca il mondo.

```
src/lib/solar/
  clima/               ← NUOVO: ingest PVGIS, cache per-sito, normalizzazione TMY
  fisica/              ← NUOVO: trasposizione, temperatura, perdite, inverter (puro)
  building-insights.ts ← esiste: geometria + ombra Google (da persistere per sito)
  griglia-dsm.ts       ← esiste: DSM 3D

src/lib/domain/
  produzione-oraria.ts ← NUOVO: orchestratore fisico → giorno-tipo mensile (puro)
  profili-carico.ts    ← FATTO: libreria profili + matching autoconsumo
  produzione-fv.ts     ← esiste: resta come ripiego finché il fisico non copre tutto
  economia-fv.ts       ← esiste: invariato, riceve un bilancio più preciso
```

**Puro vs infrastruttura:** trasposizione, temperatura, perdite, inverter,
profili e matching sono funzioni pure — nessuna rete, nessun database — così
girano in millisecondi nei test e si validano numero per numero. L'unica parte
che tocca la rete è l'**ingest** (PVGIS, Google), che scrive nella cache per-sito
e non viene mai chiamata durante un preventivo.

**Persistenza per-sito:** `sites` (o una tabella di cache dedicata) custodisce
climatologia e `buildingInsights` per coppia lat/lng arrotondata. Risolve in un
colpo autonomia (b), costi delle API a pagamento (Google) e il difetto **D11**
della pagella (cache DSM oggi solo in memoria di processo).

---

## 5. Fallback e onestà del numero

Coerente con la cultura del progetto: **degradare in modo esplicito, mai in
silenzio.**

- **Google non risponde** all'ingest → dato salvato del sito → chiamata live → in
  ultima istanza stima geometrica o inserimento manuale, **marcando** la stima
  come «senza ombra misurata, da verificare».
- **PVGIS non risponde** su un punto nuovo → punto di griglia più vicino già in
  cache, dichiarando la sostituzione.
- **A regime**, il preventivo non chiama niente: un'API giù non lo ferma.

**Il tetto onesto sulla precisione.** Anche con la fisica perfetta il numero ha
una barra d'errore inevitabile: il TMY è un anno *tipico* (l'anno reale varia
±5–10%), il consumo futuro non è noto, sporcamento e manutenzione si sanno a
posteriori. SolarEdge ha le stesse barre e le nasconde dietro un numero secco. La
nostra occasione è **dichiararle** — numero + incertezza + fonte dell'ombra — che
davanti al cliente è più forte, non più debole. «Precisione assoluta» qui
significa **fisica corretta e incertezza onesta**, non un decimale che finge
certezza.

---

## 6. Validazione — i tre dossier come banco di prova

Non per tararci: per **triangolare**. Sugli stessi tre tetti confrontiamo
**noi vs SolarEdge vs PVGIS**. Se la nostra fisica riproduce PVGIS in modo
indipendente, il numero regge davanti a chiunque abbia un SolarEdge in mano.

| Caso | Azimut / tilt | SolarEdge | Obiettivo motore |
|---|---|---:|---:|
| Riboldi | 174° / 4° | 8.066 kWh · 1.344 kWh/kWp · PR 92% | entro ±3% di SolarEdge **e** di PVGIS |
| Ricci | 203° / 8° | 7.960 kWh · 1.327 kWh/kWp · PR 89% | idem, + autoconsumo 46% (oggi 40% fisso) |
| Tarantola | 239° / 7°+17° | 5.235 kWh · 1.309 kWh/kWp · PR 89% | idem, gestendo le **due falde** |

Criterio d'accettazione: produzione annua entro ±3% su tutti e tre, con lo scarto
che **non è più zero per costruzione** (come oggi) ma il residuo di due fisiche
indipendenti che concordano. E almeno un caso **fuori** dal quadrante sud/SO — un
tetto a est o a ovest — dove oggi non abbiamo riscontro: lì la validazione è
contro PVGIS, perché un SolarEdge di quel tetto non esiste in archivio.

---

## 7. Percorso, in ordine

Ogni tappa è utile da sola e verificabile; nessuna richiede la successiva per
dare valore.

| # | Tappa | Stato |
|---|---|---|
| 1 | Modello di carico: profili + matching mese×ora, puri e testati | **fatto** (`profili-carico.ts`, 13 test) |
| 2 | Ingest PVGIS + climatologia per-sito (client, riduzione giorno-tipo, cache) | **fatto** (`solar/clima/`, 9 test) — con adattatore DB (2b), 4 test su PGlite |
| 3 | Anelli fisici puri (posizione solare, trasposizione, temperatura, perdite, inverter) | **fatto** (`solar/fisica/`, 22 test) |
| 4a | Persistere la climatologia su DB (cache `climate_cache`, RLS, migrazione) | **fatto** (`archivio-db.ts` + migrazione 0025) |
| 4b | Persistere `buildingInsights` per-sito (chiude D11) | **fatto** (`building-insights-cache*.ts` + migrazione 0026, 8 test) — resta la cache DSM e il tetto giornaliero per utente |
| 5 | Orchestratore `produzione-oraria.ts` → giorno-tipo mensile | **fatto** (`domain/produzione-oraria.ts`, 7 test) |
| 5b | Porta d'ingresso `stima-energetica-sito.ts` (climatologia + produzione + autoconsumo, in una chiamata) | **fatto** (3 test) — è l'API che la tappa 7 innesta |
| 6 | Validazione triangolata sui 3 dossier + orientamenti est/ovest/nord vs PVGIS | **fatto** (`prova:pvgis`, `prova:orientamenti`) |
| 7a | Parametri fisici (perdite, albedo, bifacciale, NOCT, coeff. temperatura, inverter) dalla **configurazione** `app_settings`, con fallback ai default | **fatto** (`domain/parametri-fisici.ts` + `queries/parametri-fisici.ts`, 5 test, nessuna migrazione) |
| 7b | Innesto nello studio (`salvaStudioTetto`) **dietro interruttore**, con la formula come ripiego; la produzione fisica alimenta poi `simulazione-fv`/`economia-fv` | **fatto** (`produzione-studio-fisica.ts`, flag `fisica.motore_producibilita_attivo`, 6 test) — resta: specifiche modulo per-prodotto dal catalogo |
| 8 | Cattura profili di carico mancanti (pompa di calore, ecc.) | continuativo |

L'innesto (7b) va **dopo** i parametri reali (7a): è il punto in cui la fisica
comincia a muovere i numeri che vede il cliente, e finché l'assoluto poggia su
assunzioni (~+7% vs PVGIS) cambiarli sarebbe prematuro.

### Nota sulle tappe 3 e 5 — primo confronto col motore completo

Con `npm run prova:pvgis` il motore fisico gira sui tre dossier, **stessi
parametri per tutti** (bifacciale +6%, albedo 0,2, perdite standard), **nessuna
taratura per caso**:

| Sito | Motore | SolarEdge | Scarto | PR mot/SE | Clipping |
|---|---:|---:|---:|---:|---:|
| Tarantola | 5.170 kWh | 5.235 | **−1,2%** | 89% / 89% | 0,00% |
| Ricci | 8.363 kWh | 7.960 | +5,1% | 89% / 89% | 0,00% |
| Riboldi | 8.599 kWh | 8.066 | +6,6% | 89% / 92% | 0,00% |

**Cosa dice questo risultato.** La struttura fisica regge: il PR esce 89% su
tutti e tre (SolarEdge 89–92%), il clipping è trascurabile come nei dossier
(0,03–0,1%), Tarantola è centrato all'1%. Con zero taratura, tre tetti diversi
cadono in una banda di ~7 punti attorno a SolarEdge — è il residuo di due fisiche
indipendenti, non uno zero costruito a tavolino.

**Perché non è ancora ±3% su tutti e tre, onestamente.** Lo scarto residuo è
**a livello di ingressi, non di modello**:
- *Coordinate approssimate.* Nello script uso il centro del comune, non
  l'indirizzo esatto. Su Riboldi il punto scelto ha GHI 1.550 kWh/m², ma il PR e
  la resa di SolarEdge implicano un sito da ~1.460: **il +6,6% è quasi tutto lì**.
  Il sistema vero geocodifica l'indirizzo esatto e questo scarto si stringe.
- *Bifacciale e perdite assunti.* +6% e perdite standard sono valori dichiarati,
  non i reali di quei moduli/quell'impianto; ogni punto di bifacciale sposta la
  resa di un punto.

La prossima leva d'accuratezza è quindi **geocodifica esatta + parametri reali
del modulo dal catalogo**, non una correzione del modello. E resta la validazione
mancante che conta di più: un tetto **a est o a ovest**, dove SolarEdge non
esiste in archivio e il riferimento è PVGIS.

### Nota sulla tappa 6 — la prova che regge fuori dal sud

`npm run prova:orientamenti` confronta la **curva di risposta all'orientamento**
del motore con PVGIS PVcalc (motore fisico indipendente), a Sarzana, 30°,
monofacciale. Conta la forma della curva — la resa normalizzata a sud:

| Esposizione | Motore (rel. sud) | PVGIS (rel. sud) | Δ |
|---|---:|---:|---:|
| Sud | 1,00 | 1,00 | — |
| Sud-Est / Sud-Ovest | 0,94 | 0,94 / 0,95 | ≤1 pt |
| **Est** | **0,80** | **0,79** | **+1,1 pt** |
| **Ovest** | **0,80** | **0,81** | **−1,0 pt** |
| Nord-Est | 0,64 | 0,63 | +1,9 pt |
| Nord | 0,58 | 0,56 | +1,6 pt |

**È il risultato che chiude il thread aperto dalla prima pagella.** Il vecchio
modello separabile penalizzava est/ovest a 0,58 (−28%); la tabella calibrata lo
rattoppava a ~0,86. Il motore fisico, senza nessun rattoppo, arriva a **0,80 su
est e ovest**, a un punto da PVGIS — cioè al valore «atteso ~0,80» che la pagella
indicava. La fisica ci arriva da sola, a ogni esposizione.

Sul **livello assoluto** il motore resta ~+7% sopra PVcalc, ma in modo **uniforme
a ogni orientamento**: un errore di trasposizione varierebbe con l'esposizione,
un offset costante è una differenza di *perdite* (le nostre ~13% contro il 14% di
PVGIS più i suoi modelli di temperatura/AOI/spettro). La struttura fisica è
giusta; il livello assoluto è questione dei parametri reali di perdita e modulo
(dal catalogo), non del modello — e non lo si tara su PVGIS, per lo stesso
principio per cui non lo si tara su SolarEdge.

### Nota sulla tappa 2

Fatto e verificato dal vivo (`npm run prova:pvgis`, triangolazione contro i tre
dossier): client PVGIS con validazione Zod, riduzione pura del TMY a
climatologia giorno-tipo mensile (GHI/DNI/DHI/temperatura, 12×24), orchestratore
`getClimatologia` con **store iniettabile** — la logica di cache è pura e testata
con un archivio in memoria. Il **2b** è ora chiuso:
[`archivio-db.ts`](../src/lib/solar/clima/archivio-db.ts) implementa l'interfaccia
sulla tabella `climate_cache` (chiave-griglia, RLS attiva, migrazione versionata
`0025`), provato contro PostgreSQL vero via PGlite — incluso il giro completo
«scarica una volta, poi rispondi dal database». L'adattatore è tenuto **fuori**
da `index.ts`: chi importa i moduli puri non si trascina dietro la connessione.

L'ordine mette per prime le parti **pure e autonome** (carico, fisica), che si
validano senza toccare la rete, e lascia l'ingest e l'innesto — dove stanno le
dipendenze e i rischi — a valle, quando la fisica è già dimostrata giusta.

---

## 8. Cosa resta deciso altrove

- **Costi di gestione del cliente:** esclusi dal piano ([D-020](01-registro-decisioni.md)).
  Il motore fisico non li reintroduce.
- **Immutabilità economica** (ADR-008): la produzione più precisa alimenta gli
  stessi importi calcolati server-side; nessun numero economico nasce dal client.
