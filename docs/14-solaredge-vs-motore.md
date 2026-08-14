# SolarEdge Designer vs motore EcoSolare — 14 agosto 2026

Analisi della **sola sezione «Report Designer»** dei tre preventivi consegnati
(Riboldi, Ricci, Tarantola): come SolarEdge Designer calcola la produzione e il
bilancio, e come lo fa invece il nostro motore. Sono gli stessi tre dossier su
cui il motore è tarato, quindi il confronto dice due cose: dove coincidiamo *per
costruzione*, e dove i due metodi divergono davvero.

Testo estratto dai PDF (Riboldi pagg. 11–15, Ricci 10–14, Tarantola 11–13). Non
ho letto le altre sezioni: solo il Report Designer, come richiesto.

---

## 1. Cosa dichiara SolarEdge, i tre casi a confronto

| | Riboldi | Ricci | Tarantola |
|---|---:|---:|---:|
| Località | Carignano | Sarzana | Ceparana |
| Falde | 1 | 1 | **2** (7° e 17°) |
| Azimut | 174° (S) | 203° (S-SO) | 239° (SO) |
| Inclinazione | 4° | 8° | 7° / 17° |
| Potenza CC | 6 kWp | 6 kWp | 4 kWp |
| Inverter CA | 5 kW | 5 kW | 3 kW |
| **Produzione annua** | **8.066 kWh** | **7.960 kWh** | **5.235 kWh** |
| **Resa specifica** | **1.344 kWh/kWp** | **1.327 kWh/kWp** | **1.309 kWh/kWp** |
| PR (Performance Ratio) | 92% | 89% | 89% |
| Potenza CC max ottenuta | 5,83 kW | 5,9 kW | 3,88 kW |
| Sovradim. CC/CA | 117% | 118% | 129% |
| Energia tagliata (clipping) | — | 0,03% | 0,1% |
| CO₂ evitata | 2,06 t | 2,04 t | 1,34 t |
| Alberi | 95 | 94 | 62 |
| Autoconsumo | 3.292 (41%) | 3.694 (46%) | 0 (0%) |
| Export | 4.774 (59%) | 4.265 (54%) | 5.235 (100%) |

Tre tetti quasi piani, tutti esposti fra sud e sud-ovest. **Nessuno a est, a
ovest o inclinato**: è la stessa osservazione delle pagelle, ora confermata dal
lato SolarEdge.

---

## 2. Come lavora SolarEdge Designer

È una **simulazione fisica oraria**, non una formula. Dai report si leggono in
controluce tutti i suoi ingredienti:

1. **Meteo TMY sul punto esatto.** Geolocalizza l'indirizzo e usa un anno
   meteorologico tipo (irraggiamento e temperatura ora per ora, 8.760 passi).
2. **Geometria 3D per falda.** Ogni falda ha il suo azimut e la sua inclinazione
   (Tarantola ne ha due, 7° e 17°, sommate): la resa nasce dall'incidenza del
   sole sul piano reale dei moduli, ora per ora.
3. **Ombreggiamento nel modello 3D.** Le ombre di ostacoli e falde entrano nel
   calcolo e si manifestano nel **PR**: 89–92% qui significa che, dopo la
   geometria, si perde ~10% per temperatura, cablaggio, inverter, sporcamento,
   mismatch. Un PR alto = tetto senza ombre rilevanti.
4. **Modello inverter con clipping.** Poiché il CC (6 kWp) eccede il CA (5 kW),
   ai picchi di mezzogiorno estivo una minima parte è troncata: SolarEdge la
   quantifica («Energia tagliata 0,03%»). Trascurabile qui, ma **misurata**.
5. **Moduli bifacciali** (Vitovolt «DG», doppio vetro): il guadagno bifacciale è
   dentro la resa.
6. **Autoconsumo da profilo orario.** La ripartizione «verso la casa / alla
   rete» nasce dal confronto **orario** fra un profilo di carico e la produzione
   (Ricci p.14 ha la tabella mensile «All'abitazione / Alla rete»). È il motivo
   per cui Ricci autoconsuma il 46% pur producendo più di quanto consuma: conta
   *quando* produce e *quando* consuma, non solo il totale annuo.
7. **Profilo mensile** derivato dalla simulazione: molto piccato d'estate, basso
   d'inverno (Ricci: dicembre 2,4%, luglio 14,2% del totale).

In una riga: **SolarEdge parte dalla fisica del sito e arriva ai numeri.**
Funziona su qualunque tetto, perché non è tarato su nessuno.

---

## 3. Come lavora il nostro motore

Il percorso è inverso: **una resa annua da formula calibrata**, poi ripartita.

1. **Resa specifica annua** = `resaBaseDaLatitudine(lat) × fattoreOrientamento ×
   fattoreOmbra` ([produzione-fv.ts](../src/lib/domain/produzione-fv.ts)):
   - `resaBase = 3021 − lat·35`: una retta **ancorata proprio a questi tre
     dossier** (al punto ottimo implicano 1.476 / 1.429 / 1.432 kWh/kWp), con il
     premio bifacciale già dentro;
   - `fattoreOrientamento`: tabella bilineare inclinazione × scostamento-da-sud;
   - `fattoreOmbra`: rapporto fra le ore di sole Google della falda e quelle
     della **falda migliore** del tetto.
2. **Nessun PR esplicito.** Le perdite (temperatura, cablaggio, inverter,
   sporcamento) non si calcolano una per una: sono **inglobate nella costante di
   base**, che è stata tarata su impianti reali con PR ~90%.
3. **Nessun modello di clipping.** Il sovradimensionamento CC/CA si stampa come
   indicatore ([indicatori-fv.ts](../src/lib/domain/indicatori-fv.ts)) ma non si
   traduce in una perdita. Su questi impianti (clipping 0,03–0,1%) è
   irrilevante; su un array molto sovradimensionato non lo sarebbe.
4. **Profilo mensile fisso.** `PESI_MENSILI_FV_ITALIA` — dodici pesi **uguali
   per ogni sito**, indipendenti da latitudine ed esposizione.
5. **Autoconsumo come parametro.** `bilanciaEnergia` prende una **frazione di
   autoconsumo** in ingresso ([bilancio-energia.ts](../src/lib/domain/bilancio-energia.ts));
   il default è **0,40 fisso** ([parametri-simulazione.ts:17](../src/lib/queries/parametri-simulazione.ts)),
   poi eventualmente alzato dal modello di accumulo. Non c'è alcun match orario.
6. **CO₂ e alberi** da costanti (0,2559 kg/kWh, 21,7 kg/albero): riproducono
   SolarEdge quasi al grammo.

In una riga: **noi partiamo da una resa calibrata sui casi sud/SO e la
distribuiamo con profili fissi.** Preciso vicino ai punti di taratura, per
estrapolazione altrove.

---

## 4. Confronto, punto per punto

### 4.1 Resa annua — **coincidiamo, ma per costruzione**

| Resa specifica | SolarEdge | Nostro motore | Scarto |
|---|---:|---:|---:|
| Riboldi | 1.344 | ~1.344 | ~0% |
| Ricci | 1.327 | ~1.327 | ~0% |
| Tarantola | 1.309 | ~1.309 | ~0% |

Lo scarto è nullo perché **questi tre casi *sono* il set di taratura**. Non è una
validazione indipendente: è la definizione. La domanda vera è cosa succede su un
tetto a **est a 30°**, che qui non c'è — lì noi ci affidiamo alla tabella di
orientamento, SolarEdge alla fisica. La tabella è stata rivista il 13 agosto per
non sbagliare più di prima, ma resta senza un punto SolarEdge di riscontro fuori
dal quadrante sud/sud-ovest.

### 4.2 Performance Ratio — **noi non lo abbiamo**

SolarEdge dichiara un PR per impianto (89–92%). Noi non produciamo questo
numero: è annegato nella costante di base. Conseguenza pratica: **non possiamo
scrivere «PR 90%» sul preventivo**, e non distinguiamo un tetto ventilato e
fresco da uno caldo e addossato, che hanno PR diversi. Per questi tre casi è
irrilevante (PR simili); come metodo, è una leva che non abbiamo.

### 4.3 Profilo mensile — **la divergenza più netta sul «solito calcolo»**

I nostri pesi fissi contro il profilo che SolarEdge calcola per il sito:

| | Gen | Feb | Mar | Apr | Mag | Giu | Lug | Ago | Set | Ott | Nov | Dic |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Nostri pesi | 4,1 | 5,1 | 8,2 | 9,2 | 11,2 | 12,2 | 13,3 | 11,2 | 9,2 | 7,1 | 5,1 | 4,1 |
| SolarEdge (Ricci) | 3,2 | 4,1 | 8,9 | 10,3 | 12,5 | 13,8 | 14,2 | 12,5 | 8,9 | 5,9 | 3,2 | 2,4 |

*(valori in % della produzione annua)*

Il nostro profilo è **più piatto**: mette nei tre mesi invernali (nov+dic+gen)
il **13,3%**, SolarEdge l'**8,9%** — noi diamo all'inverno circa il 50% in più.
D'estate è l'opposto. Sul **totale annuo non cambia nulla** (i pesi sommano a 1),
ma cambia:
- la **stagionalità dell'autoconsumo** (d'inverno si consuma di più: sovrastimare
  la produzione invernale sovrastima un po' l'autoconsumo);
- ogni grafico mensile che mostriamo, che avrà una gobba estiva più bassa del vero.

### 4.4 Autoconsumo — **il nostro è un parametro, il loro un calcolo**

| | Consumo | SolarEdge autoconsumo | Nostro con default 0,40 | Scarto |
|---|---:|---:|---:|---:|
| Riboldi | 8.000 | 3.292 (41%) | min(0,40·8.066, 8.000) = 3.226 (40%) | −66 kWh |
| Ricci | 6.500 | 3.694 (**46%**) | min(0,40·7.960, 6.500) = 3.184 (40%) | **−510 kWh** |
| Tarantola | 0 | 0 | 0 | 0 |

Su Riboldi il default azzecca (41% ≈ 40%). Su **Ricci no**: SolarEdge trova 46%
perché la simulazione oraria dice che quella casa consuma quando l'impianto
produce, e il nostro 40% fisso lo manca di **510 kWh**. Quei kWh sono la
differenza fra risparmiare 0,30 €/kWh (autoconsumo) e 0,10 €/kWh (immissione):
**~100 €/anno di risparmio in meno** nel nostro conto rispetto a SolarEdge, che
composti su 25 anni si sentono.

Il punto non è che 0,40 sia sbagliato — è ben tarato *in media* — ma che è **una
media applicata a ogni cliente**, mentre SolarEdge lo ricava caso per caso. Il
campo esiste per essere sovrascritto dallo studio; il rischio è che, lasciato al
default, appiattisca clienti che SolarEdge distinguerebbe.

### 4.5 Clipping, CO₂, alberi, CC/CA — **allineati**

- **Sovradimensionamento CC/CA**: SolarEdge usa CC_max/CA (5,83/5 = 117%); la
  nostra formula fa lo stesso. Coincide.
- **Clipping**: SolarEdge lo misura (0,03–0,1%), noi no. Qui irrilevante.
- **CO₂ e alberi**: riproduciamo SolarEdge quasi esattamente.

---

## 5. Cosa significa, in pratica

**Dove siamo solidi:** su tetti come questi tre — quasi piani, esposti fra sud e
sud-ovest, senza ombre importanti — il nostro motore riproduce SolarEdge sul
**totale annuo** entro l'1–2%, e su CO₂/alberi/CC-CA quasi esattamente. Per il
grosso del mercato residenziale ligure che l'azienda tratta, il numero grande —
la produzione annua — regge.

**Dove estrapoliamo, e SolarEdge no:**
1. **Fuori dal quadrante sud/SO** (tetti a est, a ovest, molto inclinati, a nord):
   nessuno dei tre dossier ci arriva, quindi la resa dipende interamente dalla
   tabella di orientamento, non da un riscontro SolarEdge.
2. **Profilo mensile**: fisso da noi, simulato da loro. Non tocca il totale, ma
   sposta la stagionalità e i grafici.
3. **Autoconsumo**: il nostro default 0,40 è una media; SolarEdge lo deriva
   orario. È la divergenza che pesa di più sull'**economia**, ed è concentrata
   nei casi dove produzione e consumo hanno profili molto diversi.
4. **PR e clipping**: non li produciamo. Irrilevante su impianti come questi,
   una lacuna su impianti molto ombreggiati o molto sovradimensionati.

**La differenza di fondo** resta questa: SolarEdge è un simulatore fisico che
non ha bisogno di taratura perché parte dal sito; il nostro è un modello
calibrato che è preciso *quanto* i casi su cui è stato tarato, e i casi sono tre,
tutti sud/sud-ovest e quasi piani. Finché vendiamo tetti così, i numeri
coincidono. Il giorno che il preventivo esce per un tetto a est, il confronto con
un SolarEdge in mano al cliente lo fa solo la tabella di orientamento — ed è lì
che vale la pena, prima o poi, procurarsi un quarto e un quinto dossier per
tararla su un'esposizione che oggi non abbiamo.
