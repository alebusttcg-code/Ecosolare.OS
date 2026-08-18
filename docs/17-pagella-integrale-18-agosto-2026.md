# Pagella integrale EcoSolare OS — 18 agosto 2026

Scritta da zero, non come aggiornamento delle pagelle precedenti
([11](11-pagella-crm.md), [13](13-pagella-completa-13-agosto-2026.md),
[16](16-pagella-completa-18-agosto-2026.md)). L'obiettivo qui è diverso:
**passare in rassegna ogni aspetto del CRM, uno per uno**, con un voto per
ciascuno, senza raggruppare per comodità. Dove un pezzo è ottimo lo dico in una
riga; dove ha un difetto, lo cito con file e riga così che sia verificabile e
correggibile.

## Metodo, e cosa ho verificato con le mani

Ho **misurato** lo stato di salute, non l'ho dedotto:

| Verifica | Esito (18 agosto) |
|---|---|
| `tsc --noEmit` | **pulito** |
| `eslint` | **pulito**, zero warning |
| `vitest run` | **808 test verdi / 808**, 88 file |

Dimensione: **≈63.500 righe** TypeScript in **384 file**; **53 tabelle** nello
schema, **24 enum**, **29 migrazioni** versionate con RLS su ogni tabella;
**≈35 rotte**, **10 route handler**, **21 server action**, **21 query**, **78
moduli di dominio**, **17 componenti** condivisi. La base di test è **≈10.960
righe** in 88 file.

Ho letto in questa passata, per intero o quasi: `money`, `policy`, `session`,
`audit`, lo schema, `intake`, `dedup`, `pricing`, `quote-lifecycle`, `funnel`,
`indicatori-fv`, `riconciliazione`, `stato-pubblico`, `outbox`, il layout di
navigazione, e ho ricontrollato i punti aperti nel codice odierno. Ho
**campionato** il laboratorio Sviluppo (4.230 righe client), i gestori
Drive/Telegram e le pagine cantiere.

**Non ho misurato** (e preferisco dichiararlo): resa su mobile reale,
accessibilità (contrasto, tastiera, screen reader), tempi di risposta sotto
carico con un profiler, comportamento con migliaia di righe in elenco. I
giudizi su questi punti sono a occhio o assenti, mai spacciati per misurati.

---

## Voto complessivo — **8,2**

Il prodotto è, area per area, sopra la media di ciò che si trova in gestionali
di questa dimensione. Le fondamenta sono da manuale, il flusso commerciale è
curato in ogni passaggio, i motori di calcolo sono seri e — da poche settimane —
autonomi. A tenere il voto sotto l'8,5 restano tre cose precise, tutte
identificate qui sotto col loro settore: **la concorrenza sui preventivi ancora
scoperta** (§15), **il motore economico fermo su due assunzioni ottimiste**
(§21), e **due pezzi del ciclo del denaro ancora da costruire** (§30).

### Tabella dei voti — tutte le voci

| # | Aspetto | Voto |
|---|---|---:|
| **I** | **Fondamenta** | |
| 1 | Aritmetica monetaria | 9,5 |
| 2 | Modello dati e schema | 9 |
| 3 | Migrazioni e disciplina di schema | 8,5 |
| 4 | Autenticazione e sessione | 8,5 |
| 5 | Autorizzazione (matrice permessi) | 9,5 |
| 6 | Separazione dei costi (cost gating) | 9 |
| 7 | Audit log | 8,5 |
| 8 | Configurazioni con validità | 8,5 |
| **II** | **Flusso commerciale** | |
| 9 | Intake pubblico dei lead | 9 |
| 10 | Deduplica anagrafica | 9 |
| 11 | Prequalifica e questionari | 8 |
| 12 | Pipeline e stadi | 8 |
| 13 | Preventivo: aritmetica e margine | 9,5 |
| 14 | Ciclo di vita e immutabilità (ADR-008) | 9 |
| 15 | Concorrenza sui preventivi (D10) | 4 |
| 16 | Approvazioni e soglia di margine | 8,5 |
| 17 | Metriche e imbuto commerciale | 9 |
| **III** | **Motori di calcolo** | |
| 18 | Motore energetico classico | 8 |
| 19 | Motore fisico autonomo | 8,5 |
| 20 | Accumulo e autoconsumo | 7,5 |
| 21 | Motore economico (VAN/TIR/LCOE) | 6,5 |
| 22 | Motore termico (pompa di calore) | 7,5 |
| 23 | Indicatori e provenienza costanti | 8,5 |
| 24 | Documento PDF del preventivo | 8 |
| **IV** | **Dopo la firma** | |
| 25 | Cantieri: stati, pratiche, documenti | 7,5 |
| 26 | Operativo di campo (squadre, ordini) | 7 |
| 27 | Piani di pagamento e ricevute | 7,5 |
| 28 | Controllo bancario e riconciliazione | 9 |
| 29 | Fatturazione | 7,5 |
| 30 | Completezza del ciclo del denaro | 6,5 |
| **V** | **Esercizio e integrazioni** | |
| 31 | Coda degli effetti esterni (outbox) | 9 |
| 32 | Integrazione Google Drive | 8 |
| 33 | Integrazione Telegram | 8 |
| 34 | Storage e backup documenti | 8 |
| 35 | Pagina pubblica del cliente (ADR-014) | 9,5 |
| 36 | Sicurezza operativa | 8 |
| 37 | Performance | 7,5 |
| **VI** | **Uso e manutenibilità** | |
| 38 | Navigazione e modello mentale | 7 |
| 39 | Sezione Sviluppo (laboratorio tetto) | 6 |
| 40 | Componenti UI | 7,5 |
| 41 | Collaudo (copertura test) | 7,5 |
| 42 | Igiene del codice | 8 |

---

# Parte I — Le fondamenta invisibili

## 1. Aritmetica monetaria — **9,5**

[`money.ts`](../src/lib/domain/money.ts) è il pezzo migliore del sistema. Nessun
`float` tocca mai un euro: tutto è intero in unità scalate — centesimi per gli
importi, **decimillesimi** per i prezzi (nel FV si ragiona in €/Watt, il quarto
decimale sposta centinaia di euro), millesimi per le quantità, punti base per le
percentuali. `dividiArrotondando` ([money.ts:44](../src/lib/domain/money.ts)) fa
l'arrotondamento commerciale *away from zero*, con la spiegazione del perché
`Math.round` sbaglierebbe di un centesimo dalla parte sbagliata sui negativi
(sconti, note di credito). Riusato ovunque, fatturazione inclusa. Mezzo punto in
meno solo perché non c'è un tipo nominale che impedisca di sommare per errore un
prezzo (scala 10.000) con un importo (scala 100): la disciplina è nelle teste e
nei commenti, non nel compilatore.

## 2. Modello dati e schema — **9**

**53 tabelle** in [`schema.ts`](../src/db/schema.ts), coese e senza campi
jolly. La granularità è quella giusta: `quote` e `quote_cost` sono la stessa
tabella ma due permessi diversi; costo stimato e costo reale sono colonne
distinte (ADR-008). Presenti ora anche le entità di campo di Fase 4 — `workers`,
`work_orders`, `work_order_assignments` — e le tre della fatturazione. 24 enum
tengono gli stati fuori dalle stringhe libere. L'unico neo è che alcune risorse
della matrice permessi (`time_entry`, `ticket`) non hanno ancora una tabella:
non è un difetto dello schema, è completezza funzionale (§30).

## 3. Migrazioni e disciplina di schema — **8,5**

29 migrazioni versionate, generate da Drizzle, con RLS abilitata a mano su ogni
tabella e un test che **conta** le tabelle con RLS invece di elencarle (protegge
il futuro). Nessuna modifica manuale al DB. Un residuo, aperto da tre pagelle e
ancora presente: `drizzle/0011_survey_files_rls.sql` **non è nel journal** — lo
slot 0011 è occupato da un'altra migrazione — quindi non viene mai applicato. È
innocuo (l'istruzione sta altrove) ma un file che il sistema ignora andava
cancellato. Trenta secondi.

## 4. Autenticazione e sessione — **8,5**

Accesso a fattore singolo (email + password) **per scelta di prodotto**: la
verifica in due passaggi è esclusa e il codice morto rimosso ([ADR-013](adr/013-verifica-in-due-passaggi.md),
superata; [D-018](01-registro-decisioni.md)). La sessione vive in tabella
`sessions` ed è **revocabile**: `getCurrentUser` rilegge l'utente dal DB a ogni
richiesta ([session.ts:33](../src/lib/auth/session.ts)) unendo sessione e utente
in un **solo** JOIN (una revoca di ruolo o capacità ha effetto immediato, senza
aspettare la scadenza). `cache` di React deduplica la lettura fra layout e
pagina. Non arriva al 9 perché è single-factor — deliberato, ma resta una
superficie in meno di difesa rispetto a un secondo fattore opzionale.

## 5. Autorizzazione — la matrice permessi — **9,5**

[`policy.ts`](../src/lib/auth/policy.ts) è puro (niente DB, niente Next) e la
matrice è la trascrizione fedele della §11.2 del blueprint, verificata dai test.
È una **whitelist**: una risorsa nuova nasce negata. Quattro ruoli, cinque
azioni, ~27 risorse, più la capacità `is_field_only` che **sostituisce** la riga
del ruolo cantiere con una whitelist più stretta (l'installatore in campo).
`guard()` ([session.ts:57](../src/lib/auth/session.ts)) solleva invece di
restituire un booleano — un `if` dimenticato passa, un throw no — e registra ogni
diniego. La navigazione stessa è **proiezione della matrice**: ogni voce di menu
dichiara la sua risorsa e viene filtrata da `can()`
([layout.tsx:96](../src/app/(app)/layout.tsx)), così l'interfaccia non mostra mai
ciò che il permesso nega. È il modello di sicurezza fatto bene.

## 6. Separazione dei costi (cost gating) — **9**

Il principio «nessun costo d'acquisto nel payload servito» è realizzato con un
livello di matrice apposito (`cost-gated`): il commerciale vede margine % e
soglia, **mai** i prezzi d'acquisto ([policy.ts:152](../src/lib/auth/policy.ts)),
e la lettura del costo è consentita solo se `canViewCosts`. Il gating è nella
**query**, non nel componente — il buco «regge per fortuna» dell'audit è chiuso
alla fonte. Il mezzo punto in meno è che questa disciplina va ripetuta in ogni
query che tocca costi: è corretta dove l'ho vista, ma è una regola da non
dimenticare, non una barriera strutturale.

## 7. Audit log — **8,5**

[`audit.ts`](../src/lib/audit.ts) scrive **una riga per campo cambiato**, non un
blob per operazione: la domanda che ci si pone mesi dopo è «chi ha cambiato
questo valore, da cosa a cosa», e un JSON dell'intero oggetto non risponde.
Non solleva mai (un errore nel registro non deve far fallire l'operazione:
rumoroso nei log, silenzioso verso l'utente). Registra anche i **dinieghi** di
accesso — un pattern di dinieghi ripetuti è un segnale osservabile. Non al 9
perché non c'è ancora un'interfaccia di consultazione ricca dell'audit per
l'amministratore: il dato è scritto bene, la sua lettura è più grezza.

## 8. Configurazioni con validità — **8,5**

Niente valori normativi murati nel codice: aliquote, detrazioni, soglie, prezzi
energia, parametri fisici vivono in `app_settings` con `getSetting<T>` e un
fallback esplicito, così una chiave mancante non è mai un errore fatale
([settings.ts](../src/lib/settings.ts)). Le chiavi sono raggruppate per dominio
(`CHIAVI_MARGINE`, `CHIAVI_FISICA`, `CHIAVI_FATTURA`, `CHIAVI_SIMULAZIONE`) e
modificabili dall'interfaccia admin. Il limite: il supporto alla **validità
temporale** (un valore che vale «dal…») esiste come forma `{valore, validoDal}`
ma non è ancora sfruttato ovunque — oggi la maggior parte delle chiavi porta un
valore singolo, e la storicizzazione delle aliquote è più promessa che pratica.

---

# Parte II — Il flusso commerciale (lead → firma)

## 9. Intake pubblico dei lead — **9**

[`/api/intake`](../src/app/api/intake/route.ts) fa tutto ciò che un endpoint
pubblico deve fare, nell'ordine giusto. **Salva il grezzo prima di
interpretare** (non si perde mai un lead, anche se il parsing fallisce). È
**idempotente** per `externalId` (un doppio invio non crea due opportunità).
Applica i **rate limit prima di leggere il corpo** — globale, per indirizzo, e
uno più stretto per chi sbaglia il token — così un attacco non fa allocare JSON.
Confronta il token in **tempo costante** ([intake.ts:58](../src/app/api/intake/route.ts))
e registra nell'audit i tentativi ripetuti col token errato. La risposta **non
espone mai** dati di altri contatti. È 9 e non 10 solo perché la regola di
assegnazione del lead è dichiaratamente provvisoria (`scegliProprietario`:
proprietario configurato → primo commerciale → admin), in attesa delle vere
regole per zona/turno.

## 10. Deduplica anagrafica — **9**

[`dedup.ts`](../src/lib/domain/dedup.ts) **propone, non fonde mai**: una fusione
automatica sbagliata unisce lo storico di due clienti ed è un danno che si scopre
mesi dopo. Punteggio pesato (codice fiscale 100, telefono 95, email 90, nome+
comune solo 55 perché «Rossi a La Spezia» sono molte persone), soglia a 80 sopra
la quale si chiede conferma a un umano. Chi chiama restringe i candidati con una
query mirata — non si scorre l'anagrafica. Onesto e a prova di danno.

## 11. Prequalifica e questionari — **8**

Il motore di questionari ([`questionnaire.ts`](../src/lib/domain/questionnaire.ts))
è generico e testato; la prequalifica lead riporta i dati già noti dalla scheda e
li lascia correggere ([`prequalifica-lead.ts`](../src/lib/domain/prequalifica-lead.ts)),
arricchendo la definizione a runtime coi campi indirizzo per **evitare una
migrazione** solo per estendere un form. Pulito. Non oltre l'8 perché
`actions/questionnaires.ts` (460 righe) è tra i file grandi **senza test**: la
logica pura è coperta, la server action che la orchestra no.

## 12. Pipeline e stadi — **8**

Gli stadi dell'opportunità e le loro transizioni sono modellati con storia
(`opportunity_status_history`) e regole in [`pipeline.ts`](../src/lib/domain/pipeline.ts),
testate. Il modello mentale è coerente col funnel (§17). Il limite è lo stesso
del §11: `actions/opportunities.ts` (744 righe), che esegue le transizioni, è
scoperto dai test — la macchina a stati è giusta, ma il suo orchestratore non ha
rete.

## 13. Preventivo: aritmetica e margine — **9,5**

[`pricing.ts`](../src/lib/domain/pricing.ts) è puro e tutto intero. Due regole
determinano i numeri e sono documentate: **si arrotonda per riga poi si somma**
(così il totale coincide con la somma stampata, come vuole la fatturazione
italiana), e lo **sconto globale è ripartito sulle righe** (altrimenti il margine
per riga non è più confrontabile col costo). Gli sconti si compongono in modo
**moltiplicativo** (10%+10% = 19%, non 20%). Il costo non subisce lo sconto
commerciale — è esattamente il punto in cui il margine si assottiglia e deve
restare visibile. `marginePct` è `null` su imponibile zero, non 0 (un preventivo
vuoto non è «a margine nullo»). Impeccabile.

## 14. Ciclo di vita e immutabilità — **9**

[`quote-lifecycle.ts`](../src/lib/domain/quote-lifecycle.ts) protegge la regola
contrattuale di ADR-008: **una versione inviata non si modifica mai più**; se
serve un cambiamento, nasce la versione successiva. Solo `bozza` è modificabile;
da `inviato` in poi i numeri sono un fatto (il cliente ha in mano un PDF). Invio,
scadenza, registrazione dell'esito cliente (con motivo del rifiuto obbligatorio,
«senza non si capisce dove si perde») sono funzioni pure testate. Ottimo — il
voto è tenuto sotto solo dal difetto vicino, §15.

## 15. Concorrenza sui preventivi (D10) — **4**

Il buco più vecchio ancora aperto, ri-verificato oggi. `replaceQuoteLines`
controlla lo **stato** della versione ([quotes.ts:243](../src/lib/actions/quotes.ts))
ma non la sua **età**: due persone sulla stessa bozza si sovrascrivono in
silenzio, e chi salva per secondo vince senza sapere di aver cancellato il lavoro
dell'altro. `updatedAt` viene scritto ma non confrontato. Basta una colonna
intera `version` confrontata nella `where` (optimistic locking). È l'unico punto
del sistema dove del lavoro può sparire senza traccia e senza avviso: da qui il
voto basso, isolato.

## 16. Approvazioni e soglia di margine — **8,5**

Un preventivo sotto la soglia di margine **non viene bloccato**: richiede
l'approvazione della direzione (`puoInviare` con `richiedeApprovazione: true`).
La differenza conta — l'obiettivo è rendere consapevole la decisione di erodere
il margine, non impedirla. Tabella `approvals`, rotta `/approvazioni` gated su
`quote_approval`. Solido; non al 9 perché il percorso di approvazione è coperto
dai test di dominio (soglia) ma non end-to-end sull'azione.

## 17. Metriche e imbuto commerciale — **9**

[`funnel.ts`](../src/lib/domain/funnel.ts) è analitica fatta con serietà rara in
un gestionale. Si ragiona **per coorte, non per periodo** (seguire lo stesso
insieme di lead entrati in un periodo, non dividere contratti di agosto per lead
di agosto quando il ciclo dura 40 giorni). L'imbuto è **monotòno** (chi è più
avanti conta anche nelle tappe prima, così una tappa non registrata non produce
conversioni sopra il 100%). **Mediana, non media** (una pratica dimenticata non
sposta il caso tipico). `null` su denominatore zero ovunque. E la **maturità
della coorte** accanto alla conversione, per non leggere come «pessima» una
coorte solo troppo recente. Da manuale.

---

# Parte III — I motori di calcolo (i numeri venduti)

## 18. Motore energetico classico — **8**

[`produzione-fv.ts`](../src/lib/domain/produzione-fv.ts) usa una **tabella
bilineare** inclinazione × scostamento-da-sud con interpolazione, che risolve il
difetto storico (il modello separabile penalizzava fino al 28% un tetto a est).
La riga a 0° è costante (fisica, non taratura) e i test sono **calibrati** —
`fattoreOrientamento(30,180)=1,00`, est 0,86, nord 0,67 con tolleranza fissa. Il
fattore d'ombra confronta la falda con la migliore del tetto. Limite dichiarato
nel codice: un edificio ombreggiato **per intero** (dietro una collina) ha tutte
le falde basse insieme, quindi il rapporto resta 1 e l'ombra sparisce — l'unico
caso in cui la produzione può essere sovrastimata.

## 19. Motore fisico autonomo — **8,5**

Il grande lavoro delle ultime settimane ([ADR-016](adr/016-motore-fisico-autonomo.md),
[docs/15](15-motore-fisico-autonomo.md)). EcoSolare non dipende più da SolarEdge
(un rivale) né da una tabella tarata a mano: c'è una catena fisica completa —
ingest **PVGIS TMY** → climatologia giorno-tipo 12×24 → posizione solare NOAA →
trasposizione **Hay-Davies** → temperatura di cella NOCT → perdite → inverter →
**produzione oraria** ([`src/lib/solar/`](../src/lib/solar)). Validato: la curva
per orientamento combacia con PVGIS PVcalc entro un paio di punti, il livello
assoluto è tarato su PVGIS, lo scarto sui tre dossier SolarEdge sta in pochi
punti. È **gated**: l'interruttore `fisica.motore_producibilita_attivo`
([settings.ts:59](../src/lib/settings.ts)) è spento di default e, acceso,
ricalcola col motore e **congela** il valore al salvataggio. L'ultimo mezzo punto
lo darà l'accensione piena come strada normale, non opzionale.

## 20. Accumulo e autoconsumo — **7,5**

[`accumulo.ts`](../src/lib/domain/accumulo.ts) e i profili di carico
([`profili-carico.ts`](../src/lib/domain/profili-carico.ts)) modellano
l'autoconsumo per matching orario invece che con una frazione fissa: è la strada
giusta e la libreria di profili è testata. Non oltre il 7,5 perché il
dimensionamento della batteria resta un modello semplificato (cicli, degradazione
e stagionalità non entrano nella resa economica con lo stesso dettaglio del
fotovoltaico), e l'autoconsumo dipende dalla qualità del profilo scelto, che è
un'assunzione più che una misura.

## 21. Motore economico (VAN/TIR/LCOE) — **6,5**

La parte corretta è molto corretta: TIR per **bisezione** con `null` onesto
quando il tasso non esiste ([indicatori-fv.ts:105](../src/lib/domain/indicatori-fv.ts)),
LCOE che **attualizza anche l'energia** (un kWh fra vent'anni non vale quanto uno
oggi), degradazione come identità. Ma il voto è fermo da tre pagelle per **due
assunzioni ottimiste**, entrambe ancora nel codice: (1) il piano a 25 anni è
**senza opex** — nessun inverter, manutenzione, assicurazione — ottimista *per
decisione dichiarata* ([D-020](01-registro-decisioni.md)), col vincolo che non lo
si presenti mai come incluso; (2) l'**inflazione è applicata anche alla quota
ceduta** ([economia-fv.ts](../src/lib/domain/economia-fv.ts)), ma il ritiro
dedicato è un prezzo regolato, non segue l'inflazione al dettaglio: +3%/anno per
25 anni sulla quota immessa la sovrastima. È il settore con più margine di
miglioramento *di merito* rimasto.

## 22. Motore termico (pompa di calore) — **7,5**

[`diagnostica-termico.ts`](../src/lib/domain/diagnostica-termico.ts) è maturato
molto: SCOP come proprietà del prodotto, prezzo gas con default configurabile e
override consapevole, `termicoEntraNelPiano`/`datiMancantiTermico` che rompono il
silenzio quando la pompa è a preventivo ma manca un dato, e `coerenzaPrezzoTermico`
(funzione pura testata) che accende un avviso se il prezzo scritto a mano diverge
dalla somma delle righe. Non oltre il 7,5 perché il modello termico resta più
semplice del fotovoltaico (fabbisogno stagionale, rendimento dell'esistente) e
poggia su più input manuali.

## 23. Indicatori e provenienza delle costanti — **8,5**

[`indicatori-fv.ts`](../src/lib/domain/indicatori-fv.ts) merita una lode a parte:
le costanti (CO₂ per kWh, CO₂ per albero, resa CC reale) sono **ricavate per
divisione dai tre dossier di riferimento** e la provenienza è scritta in tabella
nel commento — restano nel codice, non in `app_settings`, proprio *perché*
cambiarle romperebbe la confrontabilità con i preventivi già consegnati. È il
modo giusto di distinguere una costante di modello da una configurazione.

## 24. Documento PDF del preventivo — **8**

Copy identico al cartaceo, sezioni condizionali, schede tecniche allegate dal
catalogo, degradazione dignitosa quando manca lo studio. Un neo, aperto da tre
pagelle e ri-verificato: l'etichetta **«Sovradimensionamento CC/CA»**
([mappa-simulazione-pdf.ts:152](../src/lib/pdf/mappa-simulazione-pdf.ts)) mostra
il rapporto potenza-CC/CA; quando il campo rende meno dell'inverter (il caso
normale) il numero è sotto 100 — un *sotto*dimensionamento col nome opposto. Il
valore (`sovradimensionamentoPct`) è calcolato giusto in `indicatori-fv`; è solo
l'etichetta del PDF a mentire. Si chiami «rapporto CC/CA».

---

# Parte IV — Dopo la firma (il ciclo del denaro)

## 25. Cantieri: stati, pratiche, documenti — **7,5**

`projects` con storia di stato, `document_requirements`/`document_files` (con
soft-delete filtrato in lettura), `project_practices`, `project_materials`. La
struttura è completa e coerente col blueprint. Il voto è tenuto sotto dal fatto
che `actions/projects.ts` (368) e `queries/projects.ts` (332) sono tra i file
**senza test** accanto, e la logica di avanzamento cantiere è quella che, se
sbaglia uno stato, sposta scadenze e documenti attesi visibili al cliente.

## 26. Operativo di campo (squadre, ordini di lavoro) — **7**

Novità sostanziale dall'ultima pagella: `workers`, `work_orders`,
`work_order_assignments` **non sono più solo schema** — sono cablati in
[`actions/schedule.ts`](../src/lib/actions/schedule.ts) e
[`queries/schedule.ts`](../src/lib/queries/schedule.ts), con le pagine
`/cantieri/agenda`, `/cantieri/operai` e la capacità `is_field_only`
dell'installatore. Lo scope `assigned` della matrice, che l'audit descriveva come
«contratto senza join concreta», ora ha una join reale. È giovane (7): il flusso
esiste ma `schedule.ts` (723 righe, il terzo file più lungo) è **completamente
scoperto dai test**, e tocca assegnazioni e calendario.

## 27. Piani di pagamento e ricevute — **7,5**

`payment_milestones` e `payment_receipts` (con soft-delete) modellano le tranche
e le ricevute. Alimentano il controllo bancario (§28). Corretti; non oltre il 7,5
perché la parte «attiva» (generare le tranche da un contratto, riconoscere un
incasso) vive in azioni non coperte da test, e il legame tranche→fattura è appena
nato con la fatturazione (§29).

## 28. Controllo bancario e riconciliazione — **9**

[`riconciliazione.ts`](../src/lib/domain/riconciliazione.ts) è, con la banca,
l'altra sorpresa di questa lettura. Confronta gli **OK amministrativi** (ciò che
il cliente afferma) con l'**estratto conto** (ciò che è successo) e **non decide
mai da solo** che un pagamento manca: segnala ciò che non torna e lascia la
verifica a una persona. Abbinamento in **tre passate** (nome+importo → solo nome
→ solo importo), così un movimento certo non viene consumato da un abbinamento
debole; filtro delle parole-rumore delle causali bancarie; il **cognome è
condizione necessaria** (nelle causali il nome manca o è abbreviato, il cognome
quasi sempre c'è). Finestra temporale ampia di proposito. Le entrate senza OK
corrispondente vengono elencate a parte. Maturo e a prova di falso allarme.

## 29. Fatturazione — **7,5**

Il lavoro più grande delle ultime settimane. **Numerazione fiscale senza buchi**
(un contatore per sezionale e anno, avanzato dentro la transazione che emette,
con test di rollback che prova l'assenza di vuoti,
[`numerazione.ts`](../src/lib/fatture/numerazione.ts)); **IVA composta riga per
riga** con l'aritmetica intera, gestendo le negative della nota di credito
([`fattura.ts`](../src/lib/domain/fattura.ts)); **immutabilità** bozza→emessa,
correzione per storno e nota di credito ([`fatture.ts`](../src/lib/actions/fatture.ts));
**export CSV** per il commercialista nel formato italiano e **PDF di cortesia**
autonomo (HTML/CSS + Playwright, [ADR-015](adr/015-preventivo-html-css-playwright.md))
con ragione sociale e P.IVA da configurazione. È 7,5 e non di più per una ragione
dichiarata: lo scopo scelto è **A6 — entità + export**, non la trasmissione allo
**SdI**. Il documento è di *cortesia* (lo dice il PDF stesso); la fattura
elettronica, in Italia obbligatoria fra imprese, oggi vive ancora fuori.

## 30. Completezza del ciclo del denaro — **6,5**

Il settore che pesa più di ogni difetto di qualità, ma che è salito parecchio: la
**fattura ora esiste** e l'operativo di campo è cablato. Restano assenti come
tabelle, ri-verificato nello schema: **`time_entries` (ore lavorate)**,
**`tickets` (post-vendita)**, **`purchase_orders` (ordini a fornitore)**. Le ore
sono il buco più costoso — senza, il «margine reale» del cantiere è ancora metà
vero, e `time_entry` è già nella matrice permessi in attesa della tabella. Il
post-vendita (ticket) è dove nel FV si decide la reputazione. Non sono bug: sono
funzioni non ancora costruite, e la priorità ora è chiara — le ore.

---

# Parte V — Esercizio, integrazioni, robustezza

## 31. Coda degli effetti esterni (outbox) — **9**

[`outbox/index.ts`](../src/lib/outbox/index.ts) realizza ADR-005 da manuale:
`accoda` scrive l'evento **nella stessa transazione** del fatto che lo genera
(niente chiamate esterne dentro la transazione), con `dedupKey` e
`onConflictDoNothing` per l'idempotenza; l'elaborazione usa `for update skip
locked` (sicura da più istanze in parallelo), ritenta con backoff crescente e
manda in *dead-letter* dopo troppi tentativi, con `riprovaFalliti` per il
recupero senza toccare righe a mano. Ogni gestore è idempotente e solleva per
farsi ritentare. Robusto.

## 32. Integrazione Google Drive — **8**

Client e gestori separati ([`lib/drive/`](../src/lib/drive)), invocati **solo**
dalla coda (mai in transazione), nomi file testati
([`nomi.test.ts`](../src/lib/drive/nomi.test.ts)), cestino invece di
cancellazione. La struttura è quella giusta. Non oltre l'8 perché la logica dei
gestori (`gestori.ts`, `smaltisci.ts`) è coperta solo in parte dai test e dipende
da un servizio esterno che in locale nessuno smaltisce se non a mano
(`npm run outbox`).

## 33. Integrazione Telegram — **8**

Reminder e avvisi accodati ([`lib/telegram/`](../src/lib/telegram)), con la
logica temporale dei reminder testata ([`tempo.test.ts`](../src/lib/telegram/tempo.test.ts))
e un webhook per l'ingresso. Stesso schema pulito di Drive, stesso limite: i
gestori dipendono dalla coda e da un token esterno.

## 34. Storage e backup documenti — **8**

Astrazione storage ([`lib/storage/`](../src/lib/storage)): disco in sviluppo,
Supabase altrove. **Nessun file viene mai cancellato** (ADR-012): eliminare
valorizza `deleted_at`, e ogni lettura di `document_files`/`payment_receipts`/
`survey_files` filtra i cancellati. Esiste un backup verificato dei documenti
(`npm run backup:documenti`, `backup:verifica`). Solido; il mezzo punto oltre
l'8 arriverebbe con una verifica automatica periodica del backup, non solo a
comando.

## 35. Pagina pubblica del cliente (ADR-014) — **9,5**

[`stato-pubblico.ts`](../src/lib/queries/stato-pubblico.ts) è la privacy fatta
bene. La query è una **lista chiusa di campi**: niente importi, costi, note
interne, fornitori, stati di pagamento — «esce solo ciò che è elencato qui
sotto», perché il collegamento è la sola credenziale e può finire in mano a
chiunque. Il token è **hashato** (SHA-256), e `null` copre insieme «inesistente»,
«revocato» e «cancellato» — dall'esterno indistinguibili, così la pagina non
diventa un modo per sapere quali link sono esistiti. Mostra solo i documenti che
tocca al cliente procurare. Esemplare.

## 36. Sicurezza operativa — **8**

Molto è solido e verificato: rate limit sull'intake a finestra scorrevole,
sessioni revocabili, audit, soft-delete, **DB di sviluppo separato da
produzione** (`.env.local` ≠ `.env.produzione.local.bak`), cache dei
`buildingInsights` di Google Solar persistita (si paga un tetto una volta, non a
ogni click). Restano due code minori note: la cache DSM è ancora un `Map` di
processo e non c'è un tetto giornaliero per utente sulle chiamate Solar. Nessun
segreto nel codice. Il rischio-soldi residuo non è qui ma nel §15.

## 37. Performance — **7,5**

Interventi reali nell'ultima finestra: **co-locazione di regione** (funzioni
Vercel e database ora entrambi in Irlanda, `dub1`, prima un andata-e-ritorno
Francoforte↔Dublino su ogni query), sessione risolta con **un** JOIN invece di
due query, layout che carica i dati in **parallelo**. Si sente all'uso. Il voto è
7,5 e non di più perché **non l'ho misurato con un profiler** in produzione (lo
dichiaro verificato nel codice, non cronometrato) e perché le letture di elenco
non sono ancora paginate lato server: oggi i volumi sono piccoli, ma è un tetto
che arriverà.

---

# Parte VI — L'uso e la manutenibilità

## 38. Navigazione e modello mentale — **7**

Il menu è pulito, **proiezione della matrice permessi** (§5), con URL che
coincidono con le etichette. Due limiti, per scelta più che per svista: il
**ciclo di vita è spezzato in più voci** (Lead → Sviluppo → Sopralluoghi →
Preventivi → Clienti → Cantieri) — chi lavora pensa «la pratica dei Bianchi», non
sei voci — e **solo l'amministratore ha una home**: un commerciale o la
contabilità atterrano su un elenco, non sul quadro della giornata
([layout.tsx:54](../src/app/(app)/layout.tsx)). La **home per ruolo** resta
l'intervento di UX a ritorno più alto rimasto.

## 39. Sezione Sviluppo (laboratorio tetto) — **6**

La parte più preziosa del prodotto (l'ortofoto coi moduli disegnati sul tetto,
che nessun concorrente locale mette in un preventivo) e la più fragile da
mantenere: **4.230 righe** di codice client, con una macchina a stati non
estratta (decine di `useState`/`useEffect` in pochi componenti) e quasi zero
test sul lato app. Funziona; è debito che si paga alla prima modifica di chi non
l'ha scritto. La strada indicata da tre pagelle — estrarre la macchina a stati in
un modulo puro e coprirla — è giusta e ancora non percorsa, ed è comprensibile:
è lavoro senza gratificazione immediata su codice che gira.

## 40. Componenti UI — **7,5**

Solo **17 componenti** condivisi: la base è volutamente snella, il che è una
qualità (meno astrazione prematura). Sono coesi e riusati. Non oltre il 7,5
perché la resa su mobile reale e l'accessibilità (contrasto, tastiera, screen
reader) **non sono state misurate** — sono lo spazio bianco di questa pagella —
e in un gestionale usato tutto il giorno l'accessibilità non è un lusso.

## 41. Collaudo (copertura test) — **7,5**

**808 test in 88 file**, ~11.000 righe: crescita reale e nei posti giusti. Ma la
distribuzione racconta il limite: **36 file su 88 coprono il dominio puro**
(motori, money, funnel, dedup, riconciliazione — eccellenti e calibrati), mentre
i grandi **server action che toccano soldi e stato sono scoperti** —
`quotes.ts` (845), `opportunities.ts` (744), `schedule.ts` (723), `banca.ts`
(514) non hanno un test accanto. Hanno test solo `catalogo`, `schede-tecniche`,
`fatture` (più `firma-contratto`/`preventivo-righe`). E **nessun end-to-end**: il
percorso lead → preventivo → firma → cantiere → fattura, il cuore del prodotto,
non è ripercorso da nessun test. Il dominio è da 9; l'orchestrazione tira giù la
media.

## 42. Igiene del codice — **8**

Lint pulito, zero warning, `tsc` pulito, tipi che tengono, commenti che spiegano
il **perché** e non il cosa. Codice nuovo (fatturazione, motore fisico) ordinato.
Lingua coerente (codice in inglese, interfaccia e commenti in italiano). Resta il
solito residuo di §3 (la migrazione orfana) e la macchina a stati del laboratorio
(§39) come debito localizzato. Niente codice morto diffuso.

---

# Piano, in ordine di ritorno

| # | Intervento | Perché | Sforzo |
|---|---|---|---|
| 1 | **Optimistic locking sui preventivi** (D10, §15) | L'unico punto dove del lavoro sparisce senza traccia fra due persone | mezza giornata |
| 2 | **Ore lavorate** (`time_entries`, §30) | Senza, il «margine reale» del cantiere è metà vero | 3–4 giorni |
| 3 | **Accendere il motore fisico** come default (§19) | È costruito e validato: tenerlo opzionale lascia valore sul tavolo | 1–2 giorni + validazione |
| 4 | **Test sui grandi action** — quotes, opportunities, schedule, banca (§41) | I file più lunghi che toccano soldi e stato, oggi scoperti | continuativo |
| 5 | **Home per ruolo** (§38) | Commerciale e contabilità atterrano su un elenco, non sulla giornata | 1–2 giorni |
| 6 | **Inflazione solo sulla quota autoconsumata** (§21) | Il difetto economico di merito rimasto | mezza giornata |
| 7 | **Trasmissione SdI** dopo A6 (§29) | Trasforma la fattura di cortesia in fattura vera | 1–2 settimane |
| 8 | **End-to-end** lead → … → fattura (§41) | Il cuore del prodotto, mai ripercorso in automatico | continuativo |
| — | Cancellare `0011_survey_files_rls.sql` (§3); rinominare «Sovradimensionamento CC/CA» → «rapporto CC/CA» (§24) | Residui minori, aperti da tre pagelle | mezz'ora |

---

## Una nota, la stessa e ancora vera

Il rischio del progetto non è tecnico: la qualità, area per area, è alta e in
molti punti notevole — l'intake, il funnel, la riconciliazione, la pagina
pubblica, l'outbox sono codice che si trova raramente in gestionali di questa
dimensione. Il rischio è di **distribuzione dell'attenzione**: il laboratorio
Sviluppo (4.230 righe, affascinante) e il motore fisico (splendido) hanno avuto
più cura dei grandi orchestratori di soldi, che sono meno divertenti e più
decisivi. Il prossimo passo lo dice la classifica: prima **non farsi male** (il
lock sui preventivi), poi **misurare il lavoro** (le ore), poi **fatturarlo
davvero** (lo SdI). In quest'ordine.
