# Pagella completa EcoSolare OS — 18 agosto 2026

Terza passata, a cinque giorni dalla [pagella del 13 agosto](13-pagella-completa-13-agosto-2026.md)
(con addendum del 14) e dopo la settimana che l'ha seguita: il **motore fisico
autonomo**, la **fatturazione**, e una tornata di lavoro su **velocità**. Come le
altre volte non è un aggiornamento di stato, è una lettura nuova — riletti i
pezzi cambiati come se non li avessi mai visti, per non ereditare voti vecchi su
codice che nel frattempo è cambiato parecchio.

## Metodo, e cosa ho verificato con le mani

Non mi sono fidato dei documenti di avanzamento: ho ricontrollato nel codice.
Ho **misurato** lo stato di salute invece di dedurlo:

| Verifica | Esito (18 agosto) |
|---|---|
| `tsc --noEmit` | **pulito** |
| `eslint` | **pulito** — zero warning |
| `vitest run` | **808 test verdi su 808**, 88 file — erano 707 in 69 all'addendum del 14 |

Ho letto o riletto: lo schema (ora **53 tabelle**, +5 dal 13 agosto — le tre della
fatturazione e le due della cache Solar), le tre nuove tabelle
`invoices` / `invoice_lines` / `invoice_number_sequences`
([schema.ts:1947](../src/db/schema.ts)), il dominio IVA
([`fattura.ts`](../src/lib/domain/fattura.ts)), la numerazione senza buchi
([`numerazione.ts`](../src/lib/fatture/numerazione.ts)), le server action
fattura ([`fatture.ts`](../src/lib/actions/fatture.ts)), l'export CSV per il
commercialista, il PDF di cortesia, e l'intero motore fisico nuovo — ingest
PVGIS, climatologia, posizione solare, trasposizione, temperatura, perdite,
inverter, orchestratore ([`src/lib/solar/`](../src/lib/solar)). Ho **campionato**
— non letto riga per riga — le pagine cantiere e il laboratorio Sviluppo, che
dall'ultima volta non sono cambiati nella sostanza.

**Non ho misurato** (di nuovo, e lo dico): resa su mobile reale, accessibilità,
tempi di risposta sotto carico veri, comportamento con migliaia di righe in
elenco. Il lavoro sulla velocità l'ho verificato nel codice (co-locazione
regione, JOIN di sessione, layout in parallelo), **non** con un profiler in
produzione.

---

## Voto complessivo — **7,7** → **8,1**

Cinque giorni fa era 7,7. Il salto, più piccolo del precedente ma reale, ha un
motore solo: **quello che mancava dopo la firma ha cominciato a esistere**. Il
13 agosto scrivevo che a tenere il voto sotto l'8 non era la qualità di ciò che
c'era, ma «quello che manca dopo la firma — fattura, ore lavorate, ticket». La
**fattura ora c'è** come entità, con numerazione fiscale senza buchi, documento
di cortesia e registro esportabile per il commercialista. Il ciclo del denaro
non è chiuso — mancano ancora ore lavorate e post-vendita — ma non è più
troncato di netto alla firma.

Il secondo movente è il **motore fisico autonomo**: EcoSolare non dipende più da
un modello a tabella calibrata a mano, ha un motore che parte dai dati di
irraggiamento PVGIS e li porta a produzione oraria, validato contro PVGIS e
contro SolarEdge. È acceso con un interruttore prudente, non a forza — ma è
costruito, testato e validato, e questo è ciò che il settore misura.

Quello che tiene il voto sotto l'8,5 non è più un buco: sono **rifiniture che
toccano soldi** (concorrenza sui preventivi ancora scoperta) e le **due entità
del ciclo denaro ancora assenti** (ore, post-vendita).

| # | Settore | 13 ago | 14 ago | 18 ago |
|---|---|---:|---:|---:|
| 1 | Fondamenta: dati, permessi, aritmetica, migrazioni | 9 | 9 | **9** |
| 2 | Motore energetico (produzione, ombra, accumulo) | 7,5 | 7,5 | **8,5** |
| 3 | Motore economico (cashflow, VAN, TIR, LCOE) | 6,5 | 6,5 | **6,5** |
| 4 | Preventivo: dati in ingresso e coerenza | 7 | 9 | **9** |
| 5 | Documento PDF | 8 | 8 | **8** |
| 6 | Sezione Sviluppo (laboratorio tetto) | 6 | 6 | **6** |
| 7 | Navigazione e modello mentale | 7 | 7 | **7** |
| 8 | Sicurezza ed esercizio | 6,5 | 8 | **8** |
| 9 | Collaudo | 7,5 | 7,5 | **8** |
| 10 | Igiene del codice | 8 | 8 | **8** |
| 11 | Completezza funzionale (ciclo del denaro) | 4 | 4 | **6,5** |
| 12 | Fatturazione | — | — | **7,5** _(nuovo)_ |

Ho aggiunto un dodicesimo settore, la **fatturazione**, perché è abbastanza
grande e abbastanza a sé da meritare un voto proprio invece di sparire dentro
«completezza».

---

# Parte I — I numeri che mandiamo al cliente

## 1. Fondamenta — **9**

Invariato, e verificato ancora. L'aritmetica monetaria a interi
([`money.ts`](../src/lib/domain/money.ts)) è ora **riusata anche dalla
fatturazione**: la composizione IVA arrotonda per riga con le stesse funzioni
(`dividiArrotondando` *away from zero*), non con un secondo arrotondamento
scritto a mano. Il policy layer è ancora una whitelist pura, `guard()` rilegge
l'utente a ogni richiesta, e la nuova risorsa `invoice` è nella matrice
([`policy.ts`](../src/lib/auth/policy.ts)) con i permessi giusti: commerciale in
sola lettura dello stato, amministrazione e contabilità in pieno, cantiere
niente. Le migrazioni restano versionate (**29 numerate**, RLS su ogni tabella,
il test dello schema le conta invece di elencarle).

Nulla da fare, se non non romperlo. Unica ombra, sempre la stessa, sotto Igiene:
una migrazione orfana (§10).

## 2. Motore energetico — **8,5** _(da 7,5)_

Il salto di questa passata. La pagella del 13 lodava la tabella bilineare
inclinazione × orientamento che aveva chiuso l'errore «costava vendite in
silenzio». Quella tabella c'è ancora ed è ancora la strada di default; ma
accanto è nato un **motore fisico completo e autonomo**, che è un'altra categoria
di strumento.

**Cosa fa, in ordine.** Prende l'anno tipo di irraggiamento da **PVGIS TMY**
([`pvgis.ts`](../src/lib/solar/clima/pvgis.ts)), lo riduce a una climatologia
giorno-tipo 12×24 ([`climatologia.ts`](../src/lib/solar/clima/climatologia.ts)),
calcola la **posizione solare** con l'algoritmo NOAA
([`posizione-solare.ts`](../src/lib/solar/fisica/posizione-solare.ts)), traspone
l'irraggiamento sul piano dei moduli con **Hay-Davies**
([`trasposizione.ts`](../src/lib/solar/fisica/trasposizione.ts)), corregge per
**temperatura di cella** (modello NOCT,
[`temperatura.ts`](../src/lib/solar/fisica/temperatura.ts)), applica le
**perdite** di impianto ([`perdite.ts`](../src/lib/solar/fisica/perdite.ts)) e
l'inverter, e arriva a **produzione oraria**. L'autoconsumo esce dal matching
con i profili di carico, non da una frazione fissa.

**Perché è importante.** SolarEdge è un rivale, e finora per il numero di
produzione ci si appoggiava a un modello a tabella tarato. Adesso il numero nasce
da fisica misurabile, con una **catena di validazione**: la curva per
orientamento combacia con PVGIS PVcalc entro un paio di punti, il livello
assoluto è tarato su PVGIS, e sui tre dossier SolarEdge lo scarto sta in pochi
punti percentuali. I test non sono ordinali: sono **calibrati** e falliscono con
un numero se qualcuno sposta un parametro.

**Il limite, dichiarato.** Il motore è **gated** — l'interruttore
`fisica.motore_producibilita_attivo` ([settings.ts:59](../src/lib/settings.ts))
è spento di default, e acceso ricalcola col motore e **congela** il valore al
salvataggio. È stato provato e validato in sviluppo; la scelta di non renderlo il
default ovunque di colpo è prudenza, non incompletezza. Finché resta spento in un
ambiente, lì la produzione è ancora quella della formula calibrata — buona, ma
non la stessa cosa. Il voto premia il motore costruito e validato; l'ultimo mezzo
punto verso il 9 lo darà l'accensione piena, quando sarà la strada normale e non
quella opzionale.

## 3. Motore economico — **6,5** _(invariato)_

Non l'ho toccato in questa finestra e non è cambiato. Resta corretto dov'era
corretto (degradazione come identità, TIR per bisezione con `null` onesto, LCOE
che attualizza l'energia, bolletta che non va sotto zero con l'eccedenza a parte).
E restano i **due difetti di merito** già scritti, entrambi ancora nel codice:

1. **Piano a 25 anni senza opex — per scelta dichiarata** ([D-020](01-registro-decisioni.md)):
   nessun costo di inverter/manutenzione/assicurazione. Numeri ottimisti per
   decisione, non sbagliati di nascosto, col vincolo scritto che il modello non
   presenti mai l'opex come incluso.
2. **Inflazione applicata anche alla parte ceduta** ([`economia-fv.ts`](../src/lib/domain/economia-fv.ts)):
   il ricavo da cessione cresce con l'inflazione al dettaglio, ma il ritiro
   dedicato è un prezzo regolato. Sovrastima la quota immessa su 25 anni.

È l'unico settore fermo da due pagelle: candidato naturale al prossimo intervento
di merito, ora che la fattura non è più la priorità numero uno.

## 4. Preventivo: dati in ingresso — **9** _(invariato)_

Chiuso il 14 agosto e ancora chiuso. SCOP come proprietà del prodotto, prezzo
gas con default configurabile e override consapevole, `termicoEntraNelPiano` che
rompe il silenzio quando la pompa di calore è a preventivo ma manca un dato, e la
coerenza del prezzo termico come funzione pura testata
([`coerenzaPrezzoTermico`](../src/lib/domain/diagnostica-termico.ts)) con avviso
di divergenza. Niente di regredito.

## 5. Documento PDF — **8** _(invariato)_

Ancora curato, e ancora con lo stesso neo di due pagelle fa: l'etichetta
**«Sovradimensionamento CC/CA»** ([mappa-simulazione-pdf.ts:152](../src/lib/pdf/mappa-simulazione-pdf.ts))
mostra il rapporto potenza-CC / potenza-CA; quando il campo rende meno
dell'inverter (il caso normale) il numero è sotto 100 — un *sotto*dimensionamento
chiamato col nome opposto. Valore giusto, nome sbagliato. È una modifica da
mezz'ora che continua a non essere fatta.

---

# Parte II — L'uso

## 6. Sezione Sviluppo — **6** _(invariato)_

Non cambiata dall'ultima volta e per lo stesso motivo: è la parte più preziosa
(l'ortofoto coi moduli sul tetto) e la più fragile da mantenere — `laboratorio.tsx`
con la sua ventina di `useState`, macchina a stati non estratta, quasi zero test
sul lato app. È debito comprensibile su codice che gira, ma resta debito. La
strada indicata (estrarre la macchina a stati in un modulo puro e coprirla) è
ancora quella, ed è ancora non percorsa.

## 7. Navigazione e modello mentale — **7** _(invariato)_

Il riordino di menu del 13 agosto tiene. Le due cose ancora aperte sono le
stesse: il **ciclo di vita spezzato in più voci** (Lead → Preventivi → Clienti →
Cantieri) e **solo l'amministratore ha una home** — un commerciale atterra su un
elenco, non sul quadro della sua giornata. Con la fatturazione a bordo, l'utente
«contabilità» adesso ha una ragione in più di avere un suo punto d'ingresso.
L'intervento a ritorno più alto rimasto qui è ancora la **home per ruolo**.

---

# Parte III — Dove il rischio è di soldi e di dati

## 8. Sicurezza ed esercizio — **8** _(invariato, con lavoro sulla velocità)_

Tiene l'8 del 14 agosto. Solido e verificato: permessi server-side su ogni
endpoint (inclusi i nuovi di fattura, che iniziano con `guard('...','invoice')`),
sessioni revocabili, audit, soft-delete, DB di sviluppo separato da produzione,
la cache dei `buildingInsights` di Google Solar persistita (una volta per tetto,
non a ogni click).

**Novità di questa finestra — la velocità.** Il login e le pagine erano lenti a
tratti. La causa principale era **geografica**: funzioni Vercel a Francoforte e
database a Dublino, un viaggio di andata e ritorno su ogni query. Spostata la
regione (`dub1`) le funzioni stanno **accanto** al database; in più la sessione
si risolve con un JOIN invece di due query, e il layout carica i suoi dati in
parallelo. È il tipo di intervento che si sente all'uso ma che qui **non ho
misurato con un profiler** in produzione: lo dichiaro verificato nel codice, non
cronometrato.

**Cosa resta aperto (rischio soldi, non eleganza):**

**🟠 Nessun controllo di concorrenza sui preventivi (D10).** Verificato ancora
oggi: `replaceQuoteLines` controlla lo *stato* della versione
([quotes.ts:243](../src/lib/actions/quotes.ts)) ma non la sua *età*. Due persone
sulla stessa bozza si sovrascrivono in silenzio, e chi salva per secondo vince
senza sapere di aver cancellato il lavoro dell'altro. Basta una colonna intera
confrontata nella `where`. È il singolo rischio-soldi più vecchio ancora in
piedi.

## 9. Collaudo — **8** _(da 7,5)_

**808 test in 88 file**, contro 707 in 69 al 14 agosto: la crescita è tutta nei
posti giusti, cioè intorno ai soldi nuovi.

- **La fatturazione nasce con i test**, non dopo: la composizione IVA con le
  negative della nota di credito ([`fattura.ts`](../src/lib/domain/fattura.ts)),
  la **numerazione senza buchi** con la prova di rollback in transazione
  ([`numerazione.ts`](../src/lib/fatture/numerazione.ts)), l'export CSV
  all'italiana (`;`, decimali con virgola, BOM), lo snapshot cliente.
- **Il motore fisico è validato**, non solo scritto: orientamenti contro PVGIS
  PVcalc, livello assoluto tarato, confronto coi dossier SolarEdge.

Cosa resta scoperto, e perché non arriva al 9: **nessun end-to-end** — il
percorso lead → preventivo → firma → cantiere → **fattura** è oggi più lungo di
prima e nessuno lo ripercorre automaticamente. E i file lunghi che toccano stati
e soldi (`schedule.ts`, `opportunities.ts`) restano quasi tutti scoperti.

## 10. Igiene del codice — **8** _(invariato)_

Il lint è pulito, il nuovo codice di fatturazione è ordinato e i tipi tengono.
Resta **lo stesso residuo di due pagelle fa**, e l'ho ri-verificato: il file
`drizzle/0011_survey_files_rls.sql` **non è nel journal** delle migrazioni (conteggio
0), quindi non viene mai applicato — è innocuo perché la stessa istruzione sta
altrove, ma un file di migrazione che il sistema ignora andava cancellato e non lo
è stato. Trenta secondi di lavoro, aperto da troppo.

## 11. Completezza funzionale — **6,5** _(da 4)_

Il settore che teneva giù tutto sale, e sale per una ragione sola: **la fattura
esiste**. Al 13 agosto scrivevo «`invoices` non esiste come tabella»; oggi c'è,
con le sue righe e il suo contatore di numerazione
([schema.ts:1947](../src/db/schema.ts)). Il ciclo del denaro non è più troncato
alla firma.

Ma resta a metà, e il voto lo dice. Ho ri-verificato nello schema: **`time_entries`,
`tickets`, `purchase_orders` non esistono ancora**.

- **Le ore lavorate non si registrano.** È la voce che decide se un cantiere ha
  guadagnato o perso: senza, il «margine reale» che il sistema mostra è ancora
  metà vero. Questo resta il buco più costoso.
- **Il post-vendita non c'è** (ticket): nel mondo dell'installato è dove si
  decide la reputazione, e oggi vive fuori dal gestionale.
- **Ordini a fornitore e manutenzione programmata**: ancora assenti come entità.

Non sono bug: sono funzioni non ancora costruite. Ma la classifica di priorità è
cambiata — chiusa la fattura, il prossimo pezzo che sposta davvero l'ago sono le
**ore lavorate**.

## 12. Fatturazione — **7,5** _(nuovo)_

La aggiungo come settore perché è il lavoro più grosso della settimana e regge
bene una lettura ravvicinata.

**Cosa c'è, e perché è fatto bene.**
- **Numerazione fiscale senza buchi**, il requisito che rende una fattura una
  fattura: un contatore per sezionale e anno, avanzato *dentro* la transazione
  che emette il documento, con un test che prova via rollback che due emissioni
  concorrenti non lasciano un vuoto ([`numerazione.ts`](../src/lib/fatture/numerazione.ts)).
- **IVA composta riga per riga** con l'aritmetica a interi del resto del sistema,
  gestendo le negative della **nota di credito** ([`fattura.ts`](../src/lib/domain/fattura.ts)).
- **Immutabilità**: una bozza si modifica, una emessa no; si corregge con storno
  e nota di credito, non riscrivendo ([`fatture.ts`](../src/lib/actions/fatture.ts)).
- **Export CSV per il commercialista** nel formato italiano corretto, e **PDF di
  cortesia** autonomo (HTML/CSS + Playwright, [ADR-015](adr/015-preventivo-html-css-playwright.md)),
  con ragione sociale e P.IVA in intestazione.
- Aliquota, sezionale e dati azienda sono **configurazioni**, non costanti nel
  codice — coerente col principio del progetto.

**Perché 7,5 e non di più, dichiarato.** Lo scopo scelto è **A6: entità +
export**, non la trasmissione allo SdI. Quindi il documento è di **cortesia** —
lo dice il PDF stesso — e la fattura elettronica vera, in Italia obbligatoria fra
imprese, **oggi vive ancora fuori**. È la scelta giusta come primo passo (prima
l'entità e i numeri esatti, poi il canale), ma finché la trasmissione non c'è, il
gestionale conosce la fattura senza ancora *emetterla* nel senso fiscale pieno.
Il mezzo punto oltre il 7,5 sta lì.

**Un accoppiamento da tenere d'occhio:** le impostazioni azienda (ragione
sociale, P.IVA) vivono in `app_settings` e vanno compilate per ambiente — sono
compilate in produzione e sviluppo, ma è un dato che, se resta vuoto, degrada in
silenzio al nome del marchio. Non è un difetto, è una cosa da ricordare a ogni
nuovo ambiente.

---

# Piano, in ordine di ritorno

| # | Intervento | Perché | Sforzo |
|---|---|---|---|
| 1 | Controllo di concorrenza sui preventivi (D10) | Lavoro cancellato in silenzio fra due commerciali — il rischio-soldi più vecchio ancora aperto | mezza giornata |
| 2 | Accendere il motore fisico come default | È costruito e validato: tenerlo opzionale è lasciare valore sul tavolo | 1–2 giorni + validazione |
| 3 | Registrazione ore lavorate (`time_entries`) | Senza, il «margine reale» del cantiere è ancora metà vero | 3–4 giorni |
| 4 | Trasmissione SdI della fattura (dopo A6) | Trasforma la fattura di cortesia in fattura vera | 1–2 settimane |
| 5 | End-to-end lead → preventivo → firma → cantiere → fattura | Il cuore del prodotto, oggi più lungo e mai ripercorso in automatico | continuativo |
| 6 | Inflazione sulla sola quota autoconsumata (§3) | Il difetto economico di merito rimasto | mezza giornata |
| 7 | Home per ruolo (non solo admin) | Commerciale e contabilità atterrano su un elenco, non sulla giornata | 1–2 giorni |
| — | Cancellare `0011_survey_files_rls.sql`; rinominare «Sovradimensionamento CC/CA» in «rapporto CC/CA» | Residui minori, aperti da tre pagelle | mezz'ora |

---

## Una nota, la stessa e ancora vera

Il rischio del progetto non è mai stato tecnico: la qualità è sopra la media di
ciò che si trova in gestionali di questa dimensione. È di **distribuzione
dell'attenzione**. La settimana appena passata è la prova che si può spostare
bene: fra il motore fisico (affascinante) e la fatturazione (indispensabile e
noiosa), è stata costruita *anche* la seconda. Il prossimo passo è nello stesso
spirito — le **ore lavorate**, meno divertenti del posizionamento 3D dei moduli e
del tracciamento solare, e più decisive per sapere se un cantiere ha guadagnato.

**Voto complessivo: 7,7 → 8,1.** Per la prima volta a muovere l'ago non è più
quello che manca dopo la firma — quello ha cominciato a esistere — ma le
rifiniture che toccano i soldi e i due pezzi di ciclo ancora da costruire.
