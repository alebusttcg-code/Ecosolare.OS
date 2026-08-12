# Audit tecnico e di prodotto — agosto 2026

Stato esaminato: `main` a `926f258`, 59 commit, ~43.700 righe fra `src/` e `scripts/`,
44 tabelle, 16 migrazioni, 410 test in 38 file.

Verifiche eseguite: `npm run lint` (0 errori, 1 avviso preesistente), `npm run typecheck`
(pulito), `npm run test` (410/410), `npm run build` (riuscita). Lettura integrale del
policy layer, dello schema, delle server action, delle rotte API, del middleware e dei
moduli outbox / Drive / Telegram / storage / solar.

Il documento è diviso in tre parti: **cosa è fatto bene** (da non rompere),
**cosa è rotto o fragile** (ordinato per gravità), **cosa manca** dal punto di vista di
chi manda avanti l'azienda.

---

## Parte 1 — Punti di forza

Questi non sono complimenti di cortesia: sono le proprietà su cui il resto si appoggia,
e vanno protette dalle modifiche future.

### 1.1 Il policy layer regge davvero

La regola «ogni endpoint inizia con `guard`» non è una buona intenzione: è vera.
Ho contato **55 server action esportate in 15 file, tutte con `guard` o `requireUser`**.
Le 8 rotte API o passano da `guard` (documenti, contabili, sopralluoghi, PDF, mappa) o
da un segreto condiviso confrontato in tempo costante (intake, manutenzione, webhook
Telegram). Le 5 pagine senza `guard` sono tutte e cinque semplici `redirect` verso
percorsi storici: non toccano dati.

`src/lib/auth/policy.ts` è puro, senza database e senza Next: è la ragione per cui i 36
test sulla matrice valgono qualcosa. La whitelist di `FIELD_ONLY_MATRIX` — dove *tutto
ciò che non è elencato è negato* — è la scelta giusta: una risorsa nuova nasce
inaccessibile e va abilitata di proposito.

### 1.2 `scope-query.ts` ha chiuso il buco che l'ADR-006 lasciava aperto

`scopeFor()` diceva *quale* filtro serve senza applicarlo, e questo era un contratto
affidato alla buona volontà di chi scriveva la query. Ora esistono
`assertCommessaInScope`, `assertDocumentoInScope`, `filtroContattoAssegnato`, usati sia
nelle pagine sia in `/api/documenti/[id]`. Il commento sul perché servano i letterali
`projects.id` invece di `${projects.id}` dentro le subquery documenta un bug vero e
sottile: senza, l'`exists` era sempre falso.

### 1.3 L'aritmetica monetaria è da manuale

`src/lib/domain/money.ts` lavora su interi in unità scalate — centesimi, decimillesimi,
millesimi, punti base — e la scelta di quattro decimali sui prezzi unitari è motivata dal
dominio (euro/Watt). `dividiArrotondando` implementa l'arrotondamento commerciale invece
di `Math.round`, con la spiegazione del perché su valori negativi il default sbaglierebbe
di un centesimo nella direzione sbagliata. Questa è la parte che, sbagliata, si scopre
davanti al cliente.

### 1.4 L'outbox è costruito bene

`for update skip locked`, deduplica su chiave univoca, attesa che raddoppia, resa dopo
12 tentativi con il motivo scritto in riga. Gli 11 test girano contro un PostgreSQL vero
(PGlite), non contro un finto: le proprietà che contano dipendono da vincoli e
transazioni, e un mock proverebbe soltanto il mock. Il test «non lascia mai un evento
bloccato in *in corso*» è quello che nessuno scrive e che salva le notti.

L'evoluzione fatta dopo — smaltire i tipi solo quando esiste il gestore, invece di
segnarli falliti — è corretta: con due integrazioni indipendenti (Drive e Telegram), la
mancanza di configurazione dell'una non deve bruciare gli eventi dell'altra.

### 1.5 I test dello schema sono generativi, non fotografie

`rls.test.ts` interroga `pg_class` e pretende che **ogni** tabella abbia RLS attiva. Non
elenca le tabelle: le conta. È la differenza fra un test che protegge e un test che
racconta il passato — e il commento spiega che il problema si era già verificato con la
migrazione `0004`. `migrations.test.ts` applica le migrazioni reali, quindi un errore in
una migrazione lo trova la CI e non la produzione.

### 1.6 Il middleware nasce da un problema osservato

Il commento in `src/middleware.ts` spiega che pagina e layout partono in parallelo e che
la dashboard interrogava il database mentre il layout stava già reindirizzando: su Vercel
`/` restava appesa 15–20 secondi. La soglia sul cookie risolve *quel* problema, e il
commento chiarisce che non è autorizzazione — il cookie dice «c'è una sessione», non «sei
autorizzato». Distinzione capita e scritta.

### 1.7 La separazione dominio / infrastruttura tiene

Funnel, readiness, pricing, riconciliazione, questionari, prequalifica, layout dei moduli
FV, orientamento, sezione DSM: logica pura, testata, senza database. È il motivo per cui
410 test girano in pochi secondi e per cui si può cambiare una regola di business senza
avere paura.

### 1.8 I commenti spiegano il perché

Con notevole costanza su 43.000 righe. `client.ts` di Drive spiega perché non si usa
`googleapis`; `uno-alla-volta.ts` spiega quale stallo evita; `supabase.ts` spiega perché
si codifica ogni segmento del percorso separatamente. Fra un anno questo vale più di
qualsiasi diagramma.

---

## Parte 2 — Difetti, in ordine di gravità

### Bloccanti prima di trattare dati di clienti veri

#### D1 · Nessun backup dei documenti — **risolto l'11 agosto 2026**

> Cestino senza scadenza al posto della cancellazione, copia su Drive estesa
> alle foto di sopralluogo, export locale verificato con `npm run backup:documenti`.
> Vedere [ADR-012](adr/012-nessuna-cancellazione-dei-file.md). Resta aperta la
> copia automatica su un secondo fornitore di object storage.


Il point-in-time recovery di Supabase copre PostgreSQL, **non lo Storage**. Se un file
viene cancellato — per errore, per un bug, per un `elimina` chiamato sulla chiave
sbagliata — è perso. E qui dentro finiscono documenti con obbligo di conservazione.

La copia su Drive attenua ma non è un backup: nasce dallo stesso sistema che potrebbe
cancellare, e `deleteDocumentFile` non ha un corrispettivo che la protegga.

*Come lo farei:* soft-delete anche sui file (`deleted_at` su `document_files`, rimozione
fisica differita di 30 giorni con un gestore in coda) e una copia notturna del bucket su
un secondo fornitore. Il `checksum` già salvato serve esattamente a verificarla.

#### D2 · Nessuno si accorge quando qualcosa si rompe — **risolto l'11 agosto 2026**

> Fascia in dashboard, avviso Telegram agli amministratori (uno al giorno al
> massimo), sezione *Impostazioni → Manutenzione e cestino* con il motivo di
> ogni fallimento e il pulsante per rimettere in coda.


Sei `console.error` in tutta la base di codice, nessun error tracking, nessun health
check, nessun avviso. Un evento outbox che finisce `fallito` **resta lì e nessuno lo
sa**: era già scritto come debito nell'ADR-011 e non è stato pagato. Concretamente: la
cartella Drive di un cliente non viene creata, la copia dei documenti non parte, e ve ne
accorgete quando qualcuno cerca la cartella e non la trova.

*Come lo farei:* una riga nella dashboard dell'amministratore che conta gli eventi
`fallito` e i più vecchi `in_attesa`, più un `/api/manutenzione/salute` che il cron già
esistente interroga. Un messaggio Telegram all'amministratore quando il conteggio è
diverso da zero — l'infrastruttura Telegram c'è già, è mezza giornata di lavoro.

#### D3 · Manca la verifica in due passaggi — **risolto l'11 agosto 2026**

> TOTP con `node:crypto`, provato contro i vettori dell'RFC 6238. Obbligatorio
> per amministratore e contabilità, segreto cifrato a riposo, dieci codici di
> recupero. Vedere [ADR-013](adr/013-verifica-in-due-passaggi.md).


Già segnalato quando è stato tolto Google: il blueprint §14 la richiede, e con l'accesso
a password non c'è. Con la matrice permessi attuale, una password di un amministratore
apre costi, margini e anagrafiche complete.

*Come lo farei:* TOTP (le librerie sono banali, o si implementa con `node:crypto` come è
stato fatto per scrypt), obbligatorio per `amministratore` e `contabilita`, facoltativo
per gli altri. Codici di recupero stampabili, perché il telefono si perde.

#### D4 · GDPR: mancano export e anonimizzazione

Il blueprint §14 le prescrive esplicitamente — «funzione di export dati per singolo
contatto e funzione di anonimizzazione» — e non esistono. Oggi c'è solo il soft delete,
che non è né l'una né l'altra cosa. Alla prima richiesta di un cliente si risponde a mano.

*Come lo farei:* due server action su `contact`, entrambe con audit: `esportaContatto`
(JSON + documenti in uno zip) e `anonimizzaContatto` (sostituisce nome, contatti e
indirizzo con segnaposto, lascia intatti gli importi, che hanno obbligo fiscale).

#### D5 · L'endpoint di intake non ha limiti — **risolto il 12 agosto 2026**

> Tre limiti a finestra scorrevole su tabella (`rate_limits`, un solo
> `INSERT … ON CONFLICT` atomico, quindi esatto anche con richieste simultanee):
> 20 all'ora per indirizzo, 200 all'ora complessive, 10 all'ora per chi manda un
> token sbagliato — e quel caso finisce nell'audit log. Risposta 429 con
> `Retry-After`. Il contatore complessivo esiste perché l'indirizzo si legge da
> un'intestazione HTTP, che il chiamante può scrivere come vuole: è il freno che
> regge anche quando il primo non regge.
>
> **Resta da verificare la seconda metà del punto**, che non è codice: se il
> modulo del sito chiama l'endpoint da JavaScript nel browser, il token è
> pubblico e va spostato dietro una funzione server del sito. Il limite riduce
> il danno di un token uscito, non lo annulla.


`/api/intake` è pubblico e protetto solo dal token condiviso. Non ha alcun rate limit:
chi conosce il token può creare lead all'infinito e riempire il database. E il token è
«condiviso con i form del sito»: **se quel form lo usa da JavaScript nel browser, il
token è pubblico**. Vale la pena verificarlo — è il tipo di dettaglio che si dà per
scontato e che non lo è.

*Come lo farei:* limite per IP (tabella con finestra scorrevole, o Upstash), e se il form
è client-side spostare la chiamata su una funzione server del sito, così il token non
lascia mai il server.

#### D6 · Il cron gira una volta al giorno — **mitigato l'11 agosto 2026**

> Lo smaltimento parte ora dopo ogni firma e ogni caricamento per **entrambe** le
> code (prima solo Drive), quindi non dipende più dal cron. Il piano resta Hobby:
> per lo smaltimento ogni 5 minuti servono il piano Pro o un pinger esterno,
> istruzioni in [07-configurazione-supabase.md](07-configurazione-supabase.md).


`vercel.json` ha `0 7 * * *` — una volta al giorno, per il limite del piano Hobby. Il
mitigante c'è (`after()` avvia lo smaltimento dopo firma e caricamento) ma copre solo
Drive: **la coda Telegram non è agganciata a `after()`**, quindi i reminder dei follow-up
dipendono interamente da quell'unica esecuzione. E se `after()` non parte — istanza che
muore, errore prima della risposta — la copia di un documento aspetta fino a 24 ore, e il
recupero degli eventi falliti pure.

*Come lo farei:* il piano Pro di Vercel costa meno di un'ora di lavoro perso e sblocca il
cron ogni 5 minuti. In alternativa, un pinger esterno gratuito (cron-job.org) che chiama
lo stesso endpoint con il token.

### Gravi, non bloccanti

#### D7 · La regola sui costi regge per fortuna, non per costruzione — **risolto l'11 agosto 2026**

> `getProjectDetail` ora conosce la capacità e filtra in query, come i
> preventivi. Verificato aprendo la scheda come utente senza capacità: gli
> importi non compaiono nel payload. In più, chi non può leggere i costi non
> può nemmeno scriverli, e il costo reale entra nell'audit.


È la regola che il progetto dichiara non negoziabile: *nessun costo di acquisto nel
payload servito a chi non ha `can_view_costs`*.

Sui preventivi è rispettata alla lettera: `getQuoteVersion(id, mostraCosti)` e
`getCatalogo(mostraCosti)` filtrano nella query, con tanto di commento che cita la §11.4
regola 7.

Sulle commesse **no**: `getProjectDetail` fa `db.select().from(projectMaterials)` senza
argomenti, quindi restituisce sempre `estimatedUnitCost` e `actualUnitCost`. Oggi non c'è
fuga perché `VocePianificabilita` è definita nello stesso file server e i costi vengono
solo renderizzati condizionalmente — ma `dati.materiali` è già passato come prop in due
punti, e basta che quel componente diventi client (o ne nasca uno nuovo) perché i costi
finiscano nel payload RSC senza che nessuno se ne accorga.

*Come lo farei:* `getProjectDetail(utente, id)` conosce già l'utente. Aggiungere il
gating lì, come nei preventivi, e togliere `select()` senza colonne esplicite.

#### D8 · `accodaCopieDriveMancanti` può non convergere — **risolto l'11 agosto 2026**

> Aggiunto `order by uploaded_at`, esclusi i cestinati, e la scansione completa
> ora gira solo dal cron invece che a ogni caricamento.


```
.from(documentFiles).where(isNull(documentFiles.driveFileId)).limit(100)
```

Nessun `order by`. Con più di 100 documenti non copiati, PostgreSQL è libero di
restituire sempre lo stesso insieme, e gli altri non partono mai. Lo scenario non è
teorico: basta un periodo con Drive mal configurato e un caricamento massivo di foto di
cantiere.

C'è anche un costo nascosto: la funzione gira a **ogni** caricamento e a ogni firma, e
scansiona due tabelle intere. Con un documento permanentemente non copiabile — file
sparito dall'archivio — quella scansione resta per sempre.

*Come lo farei:* `orderBy(asc(documentFiles.uploadedAt))`, e limitare il recupero al solo
cron: dopo un caricamento basta accodare *quel* documento, non ripassare tutti.

#### D9 · Nessun test sulle server action — **avviato l'11 agosto 2026**

> Firma del contratto (10 test) e righe/invio del preventivo (9 test) girano
> ora contro PostgreSQL vero, con `src/db/fixture.ts` come impianto riusabile.
> Restano scoperte `schedule.ts`, `banca.ts` e `opportunities.ts`.


410 test, e coprono i moduli puri e lo schema. Ma **il livello dove vive la logica di
scrittura — `quotes.ts` 754 righe, `schedule.ts` 723, `opportunities.ts` 737, `banca.ts`
504 — non ha un solo test**. Sono anche i file più lunghi del progetto e quelli che
toccano soldi e stati.

L'infrastruttura per farlo c'è già ed è dimostrata da `outbox.test.ts`: PGlite, database
vero, `db` iniettabile. Il salto da fare è rendere le action testabili nello stesso modo
(oggi chiamano `getDb()` e `guard()` direttamente).

*Come lo farei:* comincerei da tre casi che, se sbagliati, costano davvero:
firma del contratto (crea contratto + commessa + materiali + pagamenti in una
transazione), riconciliazione bancaria, transizione di stato del preventivo.

#### D10 · Nessun controllo di concorrenza sui preventivi

`replaceQuoteLines` verifica lo stato della versione ma non la sua età: due persone che
modificano la stessa bozza si sovrascrivono a vicenda, in silenzio, e chi salva per
secondo vince senza sapere di aver cancellato il lavoro dell'altro. Con 1–3 commerciali
è raro ma non impossibile — e quando capita non lascia traccia.

*Come lo farei:* colonna `version` (intero) su `quote_versions`, incrementata a ogni
salvataggio, confrontata nella `where`. Zero righe aggiornate ⇒ «qualcun altro ha
modificato questo preventivo, ricarica».

#### D11 · Le chiamate a Google Solar non hanno un tetto

`buildingInsightsNelRaggio` fa **più chiamate a pagamento per ogni singolo click** (sonda
punti successivi finché non trova l'edificio). La cache DSM è dichiarata «process-local»:
su Vercel ogni invocazione può essere un processo nuovo, quindi in pratica non c'è. Non
esiste alcun limite per utente o per giorno.

Un commerciale che gioca col laboratorio Sviluppo per un pomeriggio genera una bolletta
Google che nessuno vede finché non arriva.

*Come lo farei:* salvare `buildingInsights` sul sito (`sites`) o su una tabella di cache
con la coppia lat/lng arrotondata — lo stesso tetto viene interrogato più volte durante
una trattativa — e un contatore giornaliero per utente in `app_settings`.

#### D12 · Le query della scheda commessa sono nove, in fila

`getProjectDetail` esegue nove query sequenziali tramite `unoAllaVolta`, che esiste perché
con `max: 1` le `Promise.all` mandavano in stallo la navigazione. Il rimedio è corretto,
ma cura il sintomo: il problema è il pool da una connessione.

Oggi si traduce in qualche centinaio di millisecondi. Con dieci volte i dati, la scheda
commessa diventa la pagina lenta di cui tutti si lamentano.

*Come lo farei:* verificare se `DB_POOL_MAX` è ancora forzato a 1 in produzione: con il
transaction pooler di Supabase un valore di 3–5 per istanza è normale, e rimette in gioco
il parallelismo.

### Minori

- **`drizzle/0011_survey_files_rls.sql` non è nel journal** e non viene mai applicata. È
  innocua (la stessa istruzione sta già in `0010`), ma un file di migrazione che il
  sistema ignora è esattamente il genere di cosa che tradisce quando si guarda in fretta.
  Va cancellato.
- **Nessun test end-to-end.** `docs/09-collaudo-e2e.md` descrive un collaudo manuale. Il
  percorso lead → preventivo → firma → cantiere è il cuore del prodotto e nessuno lo
  ripercorre automaticamente.
- **1 avviso di lint preesistente** in `src/lib/domain/upload.ts:102` (direttiva
  `eslint-disable` inutile). Trenta secondi.
- **Nessuna paginazione** sugli elenchi principali. Con 50 clienti non si vede; con 2.000
  sì.

---

## Parte 3 — Cosa manca, ragionando da chi manda avanti l'azienda

Il sistema copre bene **lead → preventivo → firma → cantiere**. Il buco è tutto **dopo la
firma e dopo il collaudo**, cioè dove stanno i soldi veri e i clienti che tornano.

### M1 · La fattura non esiste

Il policy layer ha la risorsa `invoice`, ci sono i piani di pagamento, le contabili, gli
estratti conto e la riconciliazione bancaria — **ma non esiste una tabella `invoices`**.
Il sistema sa che il cliente deve 12.000 € e sa che sono arrivati 12.000 €, e non sa se è
stata emessa la fattura.

In Italia la fattura elettronica verso lo SDI è obbligatoria. Finché il gestionale non la
conosce, esiste un secondo sistema (il commercialista, o un gestionale di fatturazione) e
i due divergono: è la premessa di ogni «ma questa l'avevamo fatturata?».

*Come lo farei, in ordine:* prima la tabella `invoices` (numero, data, imponibile, IVA,
milestone collegata, stato) alimentata dalle milestone — così almeno il gestionale *sa*.
Poi l'export XML per lo SDI, che è un formato documentato. L'invio vero lo farei tramite
un intermediario accreditato (Aruba, Fatture in Cloud): non ha senso costruirlo.

### M2 · Le ore lavorate non si registrano

`time_entry` è nella matrice permessi con `write` per il ruolo cantiere. **La tabella non
esiste.**

È il difetto che svuota l'ADR-008. Tutto l'impianto «costo stimato contro costo reale» è
costruito con cura sui materiali, e la manodopera — la voce più variabile, quella che
decide se un cantiere ha guadagnato o perso — non viene misurata. Il margine reale che il
sistema mostra oggi non è il margine reale.

*Come lo farei:* `time_entries` (work order, operaio, data, ore, tipo). L'inserimento
dalla vista di campo, che esiste già: il capo squadra a fine giornata mette le ore della
squadra, non serve altro. Il costo orario sta su `workers`, visibile solo con
`canViewCosts`. Da lì il consuntivo diventa vero.

### M3 · Il post-vendita non c'è

`ticket` è nella matrice, la tabella non esiste. Nel fotovoltaico il post-vendita è dove
si decide la reputazione: un inverter in blocco, una stringa che non produce, la pratica
GSE che non arriva. Oggi tutto questo vive su WhatsApp e nella testa di qualcuno.

*Come lo farei:* `tickets` collegati alla commessa, con stato, priorità e responsabile.
Il valore non è il ticket in sé, è che la scheda cliente mostri lo storico: chi arriva al
telefono trova subito cosa è già successo su quell'impianto.

### M4 · Nessuna manutenzione programmata, nessuna garanzia

Nessuna traccia delle scadenze di garanzia (moduli 25 anni, inverter 10, installazione 2)
né dei contratti di manutenzione. Sono **ricavo ricorrente** e sono il motivo per cui un
cliente richiama voi invece del concorrente.

*Come lo farei:* alla chiusura del cantiere il sistema genera le scadenze di garanzia dai
prodotti installati e, se il cliente ha un contratto O&M, gli appuntamenti di
manutenzione. Da lì esce da sola una lista «impianti da visitare quest'anno», che è
lavoro venduto senza cercarlo.

### M5 · Detrazioni fiscali e forme di pagamento

Nel residenziale italiano la prima domanda del cliente è sulla detrazione. Il sistema non
ne sa nulla: né percentuale applicata, né documentazione ENEA collegata, né eventuale
finanziamento o leasing.

*Come lo farei:* configurazione con validità temporale — il progetto ha già la regola
giusta, «niente valori normativi nel codice» — e sul preventivo il calcolo del netto dopo
detrazione, che è il numero che il cliente guarda davvero.

### M6 · Ordini a fornitore

Ci sono `suppliers`, `projectMaterials` con `quantityOrdered` e `expectedAt`: le
fondamenta ci sono. Manca l'ordine come entità: un ordine copre più commesse, ha un suo
numero, una conferma, un documento di trasporto. Oggi «materiale ordinato» è una spunta
che qualcuno mette a mano, e la readiness ci si fida.

*Come lo farei:* `purchase_orders` + righe collegate ai `project_materials`. Beneficio
immediato: quando il fornitore comunica un ritardo, si vede subito **quali cantieri
slittano**, che è la domanda che si fa ogni lunedì mattina.

### M7 · Sicurezza in cantiere

POS, DUVRI, verifica DURC dei fornitori, formazione e idoneità degli operai: obblighi di
legge, oggi non tracciati. `workers` ha nome, cognome e telefono.

*Come lo farei:* documenti con scadenza sull'operaio, e la loro validità come condizione
di pianificabilità — la `readiness` esiste già ed è il posto naturale. Un operaio con
formazione scaduta non deve poter essere assegnato a un work order.

### M8 · Il cliente non vede niente — **risolto l'11 agosto 2026**

> Pagina pubblica per commessa con collegamento firmato e revocabile: fase
> corrente, documenti attesi dal cliente, data di installazione, referente.
> Nessun dato economico. Vedere [ADR-014](adr/014-pagina-pubblica-stato-cliente.md).


Nessuna comunicazione automatica, nessun portale. Il cliente firma e poi chiama per
sapere a che punto è: è il costo nascosto più grande di tutti, perché consuma le persone
che dovrebbero vendere.

*Come lo farei — e lo metterei prima di metà di quanto sopra:* una pagina pubblica con
link firmato, senza login, che mostra lo stato della commessa e i documenti che mancano.
La struttura c'è già: `document_requirements` sa esattamente cosa manca e chi deve
fornirlo. Con un'email o un WhatsApp al cambio di stato, si tolgono la maggior parte
delle telefonate.

### M9 · Le pratiche sono meno strutturate del loro peso reale

`project_practices` ha stato, date di invio e approvazione, numero di riferimento: meglio
di quanto temessi. Manca però la **scadenza attesa** e quindi il sollecito: la richiesta
di connessione al distributore è il collo di bottiglia numero uno del fotovoltaico, e
oggi nessuno avvisa che sono passati 45 giorni senza risposta.

*Come lo farei:* `dueAt` sulla pratica, alimentato da una configurazione per tipo, e
l'avviso nella stessa coda Telegram che già funziona per i follow-up.

---

## Priorità consigliata

Se dovessi scegliere l'ordine, ragionerei così: prima ciò che evita un danno, poi ciò che
fa guadagnare, poi ciò che rende il codice più solido.

| # | Intervento | Perché prima | Sforzo |
|---|---|---|---|
| ~~1~~ | ~~Avvisi sugli eventi falliti (D2)~~ | Fatto l'11 agosto 2026 | — |
| ~~2~~ | ~~Backup dello Storage + soft delete sui file (D1)~~ | Fatto l'11 agosto 2026 | — |
| ~~3~~ | ~~Cron ogni 5 minuti (D6)~~ | Mitigato l'11 agosto 2026 | — |
| ~~4~~ | ~~Rate limit intake (D5)~~ | Fatto il 12 agosto 2026 — resta da verificare dove vive il token | — |
| 5 | Registrazione ore (M2) | Senza, il margine mostrato non è vero | 3–4 giorni |
| ~~6~~ | ~~Gating costi in `getProjectDetail` (D7)~~ | Fatto l'11 agosto 2026 | — |
| ~~7~~ | ~~Pagina pubblica di stato per il cliente (M8)~~ | Fatto l'11 agosto 2026 | — |
| ~~8~~ | ~~Test sulle server action critiche (D9)~~ | Avviato l'11 agosto 2026 | continuativo |
| 9 | Fatture, almeno come entità (M1) | Chiude il ciclo del denaro | 1 settimana |
| ~~10~~ | ~~MFA (D3)~~ | Fatto l'11 agosto 2026 | — |

Le stime sono di lavoro effettivo, non di calendario.

---

## Una nota sul metodo

La qualità di questo codice è sopra la media di ciò che si trova in gestionali di questa
dimensione: le regole dichiarate nel `CLAUDE.md` sono davvero rispettate, e questo è raro.
Il rischio adesso non è tecnico, è di distribuzione dell'attenzione: il laboratorio
Sviluppo — editor moduli, mappa tetto, DSM — sono da solo 2.800 righe, più di tutte le
server action che gestiscono i soldi messe insieme. È la parte più divertente da
costruire e non è quella che decide se l'azienda guadagna.

Le ore lavorate e la fattura sono meno affascinanti del posizionamento 3D dei moduli, e
valgono di più.
