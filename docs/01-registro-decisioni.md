# Registro delle decisioni — EcoSolare Operating System

Ogni decisione è datata e ha una motivazione. Le decisioni si **sostituiscono**, non si cancellano:
una decisione superata viene marcata `SUPERATA da D-xxx` e resta nel registro.

---

## D-001 — Single-tenant (risposta a B1)

**Data:** 4 agosto 2026 · **Decisore:** Federico Leporati · **Stato:** attiva

Il sistema serve esclusivamente EcoSolare. Non è previsto l'uso da parte di altre aziende.

**Conseguenze tecniche:**
- Nessuna colonna `tenant_id`, nessun isolamento multi-tenant, nessuna gestione di piani o sottoscrizioni.
- Le query e le policy restano semplici; risparmio stimato 15% sull'effort complessivo.
- Le configurazioni (listini, soglie, template, stati) restano **comunque configurabili da interfaccia**, non scritte nel codice: è ciò che rende il sistema modificabile senza sviluppatore, indipendentemente dal numero di aziende.

**Costo di un ripensamento futuro:** alto. Introdurre il multi-tenant dopo il go-live significa toccare ogni query, ogni policy e migrare tutti i dati esistenti. Stima indicativa: 25–40 giornate a seconda di quanti moduli sono già in produzione. Se l'ipotesi di rivendita dovesse tornare, va riaperta **prima** della Fase 3.

---

## D-002 — Budget e orizzonte temporale non definiti (risposta a B2)

**Data:** 4 agosto 2026 · **Stato:** attiva, da rivedere a fine Sprint 0

Non esiste oggi un budget né una scadenza definita.

**Conseguenza operativa:** si adotta un modello a impegni brevi e verificabili invece di un impegno unico su tutto il progetto.

- L'unico impegno da assumere ora è lo **Sprint 0** (2 settimane, audit + fondamenta tecniche).
- A fine di ogni fase c'è un punto di decisione: si prosegue, si sospende o si cambia priorità.
- Non viene assunta nessuna scadenza esterna finché la baseline dello Sprint 0 non è misurata.

**Rischio da presidiare:** in assenza di budget, la tentazione è aggiungere funzioni invece di rilasciare. Il presidio è il backlog congelato per fase (R2 del blueprint).

---

## D-003 — Google Workspace come ecosistema di riferimento (risposta a B12)

**Data:** 4 agosto 2026 · **Stato:** attiva

L'azienda usa Google Workspace. Ne discendono tre decisioni.

**D-003a — Login con Google (SSO) come metodo primario**
- Accesso con account Google limitato al dominio aziendale.
- Fallback email + password per chi non ha un account Workspace (tipicamente installatori o collaboratori esterni).
- **La verifica in due passaggi viene delegata a Google Workspace**, dove va attivata come obbligatoria per gli amministratori. Questo soddisfa il requisito MFA del brief senza costruire un secondo sistema di autenticazione, ed è più sicuro perché centralizzato.

**D-003b — Google Calendar: sincronizzazione a senso unico + lettura disponibilità**
- Il sistema **scrive** su Google Calendar gli appuntamenti che crea (sopralluoghi, cantieri, interventi).
- Il sistema **legge** le fasce occupate per calcolare la disponibilità delle persone.
- Il sistema **non** importa come proprie le voci create direttamente su Google.

*Motivo:* la sincronizzazione bidirezionale completa è una delle fonti di bug più costose in questa categoria di software (loop di aggiornamento, conflitti, cancellazioni fantasma). Il senso unico copre il 90% del valore con il 20% della complessità.
*Alternativa scartata:* sync bidirezionale — riconsiderabile in Fase 4 se emerge un bisogno reale.

**D-003c — I documenti NON vanno su Google Drive**
I documenti risiedono su object storage con metadati nel database. Drive resta eventualmente come copia di sola lettura per l'archivio, mai come sorgente.

*Motivo:* è la decisione che protegge l'obiettivo numero uno del progetto. Su Drive i permessi non possono seguire gli stati documentali (richiesto → caricato → da verificare → approvato → scaduto), le scadenze non esistono, le versioni non sono collegate al requisito e — soprattutto — si ricrea esattamente il problema che il sistema deve eliminare: *documenti dispersi in cartelle*. Il file su Drive è un file; il documento nel sistema è un file **più** un requisito, uno stato, un responsabile, una scadenza e una storia.

---

## D-004 — Software contabile: decisione rinviata (risposta a B13)

**Data:** 4 agosto 2026 · **Stato:** in attesa, non bloccante fino alla Fase 5

**Perché non blocca:** l'integrazione contabile vive nella Fase 5. Il sistema è progettato con un confine esplicito (`AccountingAdapter`) e parte da export CSV/XLSX, che funziona con qualunque software e anche con uno studio esterno.

**L'unica dipendenza anticipata**, da chiarire prima della Fase 2: le **numerazioni**. Se preventivi, contratti e commesse devono seguire una numerazione allineata a quella del gestionale contabile, va saputo prima di generare i primi documenti reali, perché rinumerare a posteriori documenti già inviati ai clienti non è possibile.

**Default in assenza di risposta:** numerazione autonoma del sistema, formato `PRV-2026-0001`, `CTR-2026-0001`, `COM-2026-0001`, configurabile.

---

## D-005 — Modello dei ruoli: due livelli + capacità (risposta a B17, parte accessi)

**Data:** 4 agosto 2026 · **Stato:** ⛔ **SUPERATA da D-007** (4 agosto 2026) · **Supera a sua volta:** la matrice a 8 ruoli del brief §4 e del blueprint §11 v1

> Conservata per tracciabilità. Il modello a 2 ruoli è rimasto attivo per poche ore ed è stato
> sostituito da un modello a 4 ruoli funzionali. Le **capacità** introdotte qui (`can_view_costs`,
> `is_field_only`) sopravvivono in D-007: erano la parte buona di questa decisione.

Il committente ha indicato due sole autorità: **amministratore** e **utente**.

**Decisione adottata:** due ruoli, più un piccolo insieme di **capacità** attivabili sul singolo utente. Questo rispetta la scelta a due livelli e copre i due casi in cui "tutti vedono tutto" ha una conseguenza concreta, senza costruire una matrice a otto ruoli.

| | `admin` | `user` |
|---|---|---|
| Anagrafiche, opportunità, sopralluoghi, preventivi, documenti, commesse | ✅ | ✅ |
| Configurazioni, listini, soglie, template, automazioni | ✅ | ❌ |
| Gestione utenti e capacità | ✅ | ❌ |
| Audit log | ✅ | ❌ |
| Integrazioni e segreti | ✅ | ❌ |
| Costi di acquisto e margini | ✅ | dipende da `can_view_costs` |

**Capacità (flag sul singolo utente, non ruoli):**

- `can_view_costs` — se disattivo, l'utente vede i prezzi di vendita ma non i costi di acquisto né il margine in euro. **Default consigliato: disattivo.**
  *Motivo:* è l'unico dato la cui diffusione ha un effetto economico diretto — le condizioni ottenute dai fornitori. Non è una questione di fiducia interna: è che quel dato, una volta uscito, non rientra. Attivarlo per una persona è un click.
- `is_field_only` — l'utente accede solo alla vista di campo (lavori assegnati, checklist, foto, ore) e non al back-office. Serve dalla Fase 4, quando esiste la PWA tecnici. Non implementato nell'MVP.

**Conseguenze:**
- La matrice permessi di §11 del blueprint è sostituita da questa tabella. Risparmio stimato: 3–5 giornate di sviluppo e test, e una quantità significativa di complessità permanente.
- L'architettura resta invariata: il controllo passa comunque dal policy layer `can(user, action, resource)` (ADR-06). Aggiungere un terzo ruolo in futuro è configurazione, non riscrittura.
- **Rischio accettato:** un utente non-admin può vedere e modificare i dati di clienti e trattative di cui non si occupa. In un'azienda della dimensione ipotizzata è normale e spesso desiderabile. Diventa un problema se entrano collaboratori esterni, agenti a provvigione o stagionali: in quel caso va riaperta la decisione.

---

## D-006 — Privacy: nessun consulente dedicato al momento (risposta a B17)

**Data:** 4 agosto 2026 · **Stato:** attiva, con azione richiesta prima del go-live

Non risulta un consulente privacy di riferimento.

**Cosa questo NON blocca:** lo sviluppo. Le misure tecniche (§14 del blueprint) si implementano comunque e sono la parte che richiede tempo.

**Cosa richiede comunque un'azione, e che si può fare senza consulente:**

1. **Titolare del trattamento** = EcoSolare come società, nella persona del legale rappresentante. Va scritto, non solo sottinteso.
2. **Accordi con i responsabili esterni (DPA):** Google Workspace, hosting/database, object storage, provider email, provider AI. Sono contratti standard che i fornitori mettono a disposizione e si accettano una volta. Senza questi, il trasferimento di dati personali a quei fornitori è privo di base contrattuale.
3. **Informativa privacy sul form del sito** e registrazione del consenso: data, testo in vigore, canale. Il sistema lo traccia automaticamente, ma il testo deve esistere.
4. **Registro dei trattamenti**: un documento, non un progetto.

**Raccomandazione:** far rivedere i punti 1–4 da un consulente **una volta sola**, prima del go-live. Costo contenuto, e copre il rischio maggiore, che non è tecnico ma documentale. Non è necessario per iniziare a costruire.

**Nota separata:** se in Fase 4 si volesse registrare la posizione dei tecnici, quello sì richiede un passaggio formale (accordo sindacale o autorizzazione dell'Ispettorato del Lavoro) **prima** dell'implementazione. Vedi A13 del blueprint.

---

## D-007 — Modello dei ruoli: quattro ruoli funzionali + capacità

**Data:** 4 agosto 2026 · **Decisore:** Federico Leporati · **Stato:** attiva · **Supera:** D-005

Quattro ruoli, allineati alle aree funzionali dell'azienda invece che ai livelli gerarchici:

| Ruolo | Presidia |
|---|---|
| `amministratore` | Tutto, incluse configurazioni, utenti, integrazioni e audit |
| `contabilita` | Ciclo amministrativo: fatture, pagamenti, incassi, scadenze, documenti e pratiche |
| `commerciale` | Ciclo di vendita: lead, opportunità, sopralluoghi, preventivi, follow-up |
| `cantiere` | Ciclo operativo: verifica tecnica, materiali, pianificazione, esecuzione, fogli di lavoro |

**Perché quattro e non otto (brief) né due (D-005).** Otto ruoli descrivevano mansioni, non responsabilità di processo: in un'azienda di questa dimensione una persona ne ricopre tre o quattro, e la matrice diventa un costo di manutenzione senza beneficio. Due ruoli erano al di sotto della soglia in cui i permessi hanno un senso economico. Quattro corrispondono ai quattro tratti del ciclo *vendo → apro e amministro → costruisco → incasso*, che è come il lavoro è realmente organizzato.

### Assorbimenti rispetto ai ruoli del brief

| Ruolo del brief | Confluisce in | Nota |
|---|---|---|
| Amministratore | `amministratore` | — |
| Titolare / Direzione | `amministratore` | Non è un ruolo tecnico separato: la direzione ha bisogno di vedere tutto, che è la definizione di amministratore |
| Commerciale | `commerciale` | — |
| Back-office | `contabilita` | **Assorbimento da validare:** documenti, pratiche e scadenze finiscono in contabilità. In un'azienda di questa dimensione è tipicamente la stessa persona. Se invece sono due persone distinte con esigenze diverse, va aggiunto un quinto ruolo `backoffice` (costo: 2–3 giornate) |
| Amministrazione | `contabilita` | — |
| Ufficio tecnico | `cantiere` | **Assorbimento da validare:** la catena sopralluogo tecnico → progettazione → distinta materiali → esecuzione è continua e presidiata dalle stesse competenze |
| Responsabile cantieri | `cantiere` | — |
| Tecnico / Installatore | `cantiere` + `is_field_only` | Distinto dalla capacità, non da un ruolo: vedi sotto |

### Capacità (flag sul singolo utente)

Sopravvivono da D-005 e sono ciò che evita di moltiplicare i ruoli per ogni eccezione.

**`can_view_costs`** — visibilità di costi di acquisto e margine in euro.
Default per ruolo: `amministratore` ✅ · `contabilita` ✅ · `commerciale` ❌ · `cantiere` ❌.
Il commerciale vede prezzo di vendita, margine **percentuale** e l'indicatore sopra/sotto soglia — che è quanto gli serve per negoziare — ma non i prezzi di acquisto dei fornitori. Il responsabile cantieri che deve presidiare il budget di commessa lo ottiene con un click.

**`is_field_only`** — vista di campo soltanto (Fase 4, non nell'MVP).
Si applica sopra il ruolo `cantiere` e distingue l'installatore dal responsabile: accede solo ai lavori assegnati, checklist, foto, ore e fogli di lavoro; nessun importo. Non è (solo) una restrizione di sicurezza: su uno schermo da 6 pollici, mostrare l'intero gestionale a un installatore garantisce che non lo userà.

### Regole trasversali

1. **L'anagrafica è visibile a tutti i ruoli.** È il presupposto della "fonte unica di verità": se un tecnico non trova il cliente, ricomincia a chiedere per telefono. Scrittura riservata a `commerciale`, `contabilita`, `amministratore`.
2. **Approvazione dei preventivi sotto soglia: solo `amministratore`.** È l'unico workflow di approvazione dell'MVP e deve restare in direzione.
3. **Nessun silo interno al ruolo:** tutti i `commerciale` vedono tutte le opportunità, tutti i `cantiere` vedono tutti i cantieri. Con 1–3 persone per area il siloing crea più attrito di quanto protegga. Riapribile se entrano agenti a provvigione o collaboratori esterni.
4. **Un utente ha un solo ruolo.** I ruoli multipli sembrano flessibili e producono permessi imprevedibili. Chi fa due mestieri prende il ruolo più ampio fra i due, oppure `amministratore`.

**Costo rispetto a D-005:** +2–3 giornate su MVP (matrice più articolata e relativi test di autorizzazione). Rispetto alla matrice a 8 ruoli del brief resta un risparmio di 2–3 giornate e, soprattutto, di complessità permanente su ogni funzionalità futura.

**Da validare in Sprint 0:** i due assorbimenti marcati sopra (back-office → contabilità, ufficio tecnico → cantiere). Sono le uniche due scelte che potrebbero richiedere un quinto ruolo, e si verificano con due domande durante le interviste.

---

## D-008 — Avvio dello Sprint 0: referente nominato e scope MVP approvato

**Data:** 4 agosto 2026 · **Decisore:** Federico Leporati · **Stato:** attiva

- **Referente interno di progetto:** Federico Leporati (chiude A16).
- **Scope MVP approvato** come da §16 del blueprint, con la definizione di successo di §16.3: *per 30 giorni consecutivi, il 100% dei nuovi lead entra nel sistema e nessuna opportunità aperta resta senza prossima azione.*

**Conseguenza:** lo Sprint 0 è avviato. Le fondamenta tecniche (T7–T11) procedono senza attendere le interviste; l'audit (T1–T6) è sul percorso critico ed è presidiato dal referente.

**Attenzione sul ruolo di referente.** Federico è insieme committente, referente e — presumibilmente — una delle fonti da intervistare. È efficiente, ma introduce due rischi da presidiare consapevolmente:

1. **Il processo dato per scontato.** Chi conosce il processo da anni salta i passaggi che considera ovvi, e sono esattamente quelli che il software deve gestire. Mitigazione: l'esercizio delle interviste va fatto **per iscritto** anche su se stessi, e le altre quattro interviste vanno fatte davvero, non sostituite dall'opinione del referente su cosa farebbero i colleghi.
2. **Nessun contraddittorio sulle priorità.** Quando committente e referente coincidono, non c'è attrito che filtri le richieste. Mitigazione: il backlog congelato per fase (R2) e i punti di decisione a fine fase restano il presidio.

**Prima scadenza:** completamento di T1–T6 (5 interviste, materiali raccolti, baseline compilata) → produzione del blueprint v2 e stima puntuale del backlog di Fase 1.

---

## D-009 — Infrastruttura: Supabase (database e storage) + Vercel (applicazione)

**Data:** 4 agosto 2026 · **Decisore:** Federico Leporati · **Stato:** attiva

Il database su Supabase, l'applicazione su Vercel. Scelta condivisa: è la
combinazione con meno attrito per Next.js, non richiede gestione di server e ha
piani gratuiti o economici adeguati ai volumi previsti (A3).

### Vincoli da rispettare perché la scelta regga

**1. Regione UE su entrambi — obbligatorio (A4).**
Vercel per impostazione predefinita esegue negli Stati Uniti (`iad1`): va forzato
Francoforte (`fra1`), come da `vercel.json`. Supabase va creato in una regione UE
(Francoforte). Oltre alla conformità, tenerli nella stessa regione evita di
pagare un giro dell'Atlantico a ogni query.

**2. RLS attiva su ogni tabella — obbligatorio.**
Supabase espone automaticamente lo schema `public` tramite un'API REST, e la
chiave `anon` è pubblica per progettazione. Senza RLS, chiunque la conosca
leggerebbe e scriverebbe ogni tabella **aggirando il policy layer** (ADR-006).
La migrazione `0004_blindatura_rls` abilita RLS senza policy su tutte le tabelle:
per l'API pubblica significa "nega tutto", mentre l'applicazione continua a
funzionare perché si collega col ruolo proprietario, non soggetto a RLS.

*Conseguenza:* usare il client Supabase dal browser richiederebbe policy
esplicite. È una decisione da prendere consapevolmente, non da subire.

**3. Connection pooler, non connessione diretta.**
Su Vercel ogni richiesta è un processo separato: le connessioni dirette si
esauriscono. Va usata la stringa del **transaction pooler** (Supavisor, porta
6543), con `prepare: false` — il transaction mode non supporta i prepared
statement. Senza quella riga le query funzionano in locale e falliscono in
produzione, che è il modo peggiore di scoprire un problema. Già applicato in
`src/db/index.ts`.

**4. Piani a pagamento, non gratuiti.**
- **Vercel Hobby vieta l'uso commerciale**: per un gestionale aziendale serve Pro.
- **Supabase Free sospende il progetto** dopo una settimana di inattività: per un
  sistema in produzione serve Pro, che include anche backup giornalieri e PITR.

Costo indicativo di partenza: **~45–50 €/mese**. Va detto ora, non scoperto dopo.

### Cosa cambia rispetto al blueprint

**ADR-005 (outbox transazionale) resta valido, il worker no.** Il piano prevedeva
`pg-boss`, che richiede un processo persistente: su Vercel non esiste. Le opzioni
sono un **Vercel Cron** che ogni minuto chiama una rotta protetta e svuota la
coda degli eventi, oppure un worker separato altrove.

*Raccomandazione:* Vercel Cron, adeguato ai volumi previsti. Il prezzo è la
granularità: gli eventi vengono consegnati entro un minuto, non istantaneamente.
Per i solleciti e i follow-up è irrilevante; per la notifica di un nuovo lead è
accettabile e resta ben dentro il target di speed-to-lead. Da riaprire se
servisse una reattività al secondo.

Va aggiornato ADR-005 quando il worker verrà implementato (Fase 2, follow-up).

### Cosa questa scelta risolve gratuitamente

**Supabase Storage** copre il requisito di object storage per i documenti
(ADR-010 e §14: file fuori dal database, URL firmati a scadenza breve), nella
stessa regione UE e sotto lo stesso contratto. Un fornitore in meno da nominare
responsabile del trattamento (D-006).

### Nomine responsabili del trattamento

Vercel e Supabase vanno aggiunti all'elenco dei responsabili esterni con i
rispettivi DPA, insieme a Google (D-006 punto 2). Entrambi sono società
statunitensi con sottoscrizione al Data Privacy Framework: i dati restano nella
regione UE scelta, ma il titolare resta EcoSolare ed è comunque necessaria la
nomina.
