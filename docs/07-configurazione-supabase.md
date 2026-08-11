# Configurazione di Supabase e Google

Guida passo passo, da seguire davanti al computer. Riferimento: [D-003](01-registro-decisioni.md)
e [D-009](01-registro-decisioni.md).

**Tempo:** 30–40 minuti, di cui buona parte di attesa.
**Cosa serve:** una carta per il piano Supabase, e un account Google Workspace di EcoSolare.

> **Le credenziali non vanno condivise con nessuno**, me compreso: si scrivono
> direttamente in `.env.local`, che non finisce mai nel repository.

---

## 1. Creare il progetto Supabase

1. Vai su **supabase.com** → *Start your project* → accedi con GitHub o email.
2. *New project*, e compila:

   | Campo | Valore | Perché |
   |---|---|---|
   | **Name** | `ecosolare-os` | — |
   | **Database Password** | genera e **salvala subito** | non è più recuperabile: si può solo sostituire |
   | **Region** | **Central EU (Frankfurt)** | i dati devono restare in UE (assunzione A4) |
   | **Plan** | **Pro** | il piano Free sospende il progetto dopo una settimana di inattività, e non ha backup con ripristino a un istante preciso |

3. Attendi due o tre minuti che il progetto venga creato.

> ⚠️ **Sulla password.** Se contiene caratteri come `@ : / ? # [ ] %`, va codificata
> quando la incolli nella stringa di connessione, altrimenti la connessione fallisce
> con un errore poco chiaro. Il modo semplice per evitarlo: **genera una password di
> sole lettere e numeri**, lunga (32 caratteri). Non perdi sicurezza e ti risparmi
> un'ora di diagnosi.

---

## 2. Copiare la stringa di connessione giusta

È il punto in cui si sbaglia più spesso.

1. Nel progetto: **Connect** (in alto) oppure *Project Settings → Database*.
2. Cerca la sezione **Connection string** e scegli **Transaction pooler**.
3. Copia la stringa. Deve avere questa forma:

```
postgresql://postgres.<ref-progetto>:<password>@aws-<n>-<regione>.pooler.supabase.com:6543/postgres
```

**Usa il pulsante di copia, non riscriverla a mano.** Il prefisso (`aws-0`, `aws-1`…)
e la regione dipendono da dove è ospitato il tuo progetto: se non corrispondono,
la connessione fallisce con `tenant or user not found`, che non lascia intuire
la causa.

**Controlla due cose:**

- la porta è **6543** — non 5432;
- l'host contiene **`pooler`**.

> **Perché il pooler e non la connessione diretta.** Su Vercel ogni richiesta è un
> processo a sé: con le connessioni dirette il database le esaurisce in fretta. Il
> codice è già predisposto (`prepare: false` in `src/db/index.ts`) perché il pooler
> in modalità transazione non supporta le istruzioni preparate. Con la stringa
> sbagliata le query funzionano in locale e falliscono in produzione, che è il modo
> peggiore di scoprire un problema.

---

## 3. Scrivere le credenziali in `.env.local`

Apri `.env.local` nella cartella del progetto. Ci sono già tutte le chiavi: vanno
sostituiti i valori.

```bash
# La stringa del Transaction pooler copiata al passo 2
DATABASE_URL=postgresql://postgres.xxx:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres

# Lascia quello che c'è
INTAKE_TOKEN=...
```

Serve inoltre la chiave della verifica in due passaggi:

```bash
# openssl rand -hex 32
MFA_SECRET_KEY=...
```

Cifra il segreto TOTP, così una copia del database non contiene anche il secondo
fattore di tutti. **Senza, amministratori e contabilità non riescono a entrare**,
perché per il loro ruolo la verifica è obbligatoria
([ADR-013](adr/013-verifica-in-due-passaggi.md)). Se la chiave si perde si entra
con i codici di recupero e si riconfigura l'app.

Il token di sessione, invece, è un valore casuale confrontato con il database e
non un token firmato: lì non c'è nessun segreto da configurare.

**Una riga da cancellare:** `DB_POOL_MAX=1` serviva al database locale, che accetta
una connessione sola. Con Supabase **va tolta** — il valore predefinito è più adatto.

---

## 4. Creare le tabelle

Dal terminale, nella cartella del progetto:

```bash
npm run db:migrate
```

Applica le sette migrazioni in ordine. Deve terminare con `Migrazioni applicate.`

Poi i dati di configurazione — stati della pipeline, fonti, soglie, checklist:

```bash
npm run db:seed
```

> **Non eseguire `npm run demo`** su Supabase se non stai facendo una prova: quel
> comando **cancella e ricrea** i dati per popolare l'ambiente dimostrativo. Va bene
> ora che il database è vuoto, non quando ci saranno clienti veri.

### Verifica che sia andata bene

Su Supabase → **Table Editor**: devi vedere circa trenta tabelle (`users`, `contacts`,
`opportunities`, `projects`, `bank_statements`…).

**Controllo importante:** apri **Authentication → Policies** oppure guarda l'elenco
tabelle. Accanto a ogni tabella deve comparire **RLS enabled**. Se Supabase mostra
avvisi «RLS disabled in public», qualcosa non ha funzionato: fermati e scrivimi.

> **Perché conta.** Supabase pubblica automaticamente ogni tabella su un'API web, e
> la chiave pubblica del progetto è per definizione conoscibile. La migrazione
> `0004_blindatura_rls` attiva la protezione su tutte le tabelle: senza, chiunque
> conoscesse quella chiave potrebbe leggere anagrafiche e preventivi **scavalcando i
> permessi dell'applicazione**.

---

## 5. Creare il tuo utente

```bash
npm run amministratore
```

Chiede l'email che vuoi usare per entrare e stampa **una password generata**.
Annotala subito: nel database ne resta solo l'impronta, quindi non è recuperabile.
Se la perdi, rilancia lo stesso comando e ne genera un'altra.

L'email può essere qualunque indirizzo: non c'è nessun vincolo di dominio e nessun
collegamento con Google.

---

## 6. Primo accesso

```bash
npm run dev
```

Apri `http://localhost:3000`, inserisci email e password. Al primo ingresso il
sistema ti obbliga a sceglierne una nuova: quella generata la conosceva anche il
comando che l'ha creata, quindi finché non la cambi non identifica te.

Da quel momento **non esiste auto-registrazione**: chiunque altro va abilitato da te
in *Utenti*, dove il sistema genera anche la sua password iniziale e te la mostra
una volta sola perché tu gliela comunichi.

### Se qualcosa non funziona

| Sintomo | Causa quasi certa |
|---|---|
| `tenant or user not found` | l'host non corrisponde alla regione del progetto. **Non ricostruire la stringa a mano**: copiala dal pulsante di Supabase, perché il prefisso (`aws-0`, `aws-1`…) e la regione cambiano da progetto a progetto |
| `password authentication failed` | password del **database** con caratteri speciali non codificati, o sbagliata |
| `Connection terminated` / timeout | stai usando la porta 5432 invece di 6543 |
| `prepared statement ... already exists` | stringa di connessione diretta invece del pooler |
| «Email o password non corretti» | l'utente non esiste, è disattivato, oppure la password è sbagliata: il messaggio è volutamente lo stesso nei tre casi |
| «Troppi tentativi falliti» | cinque errori di fila. L'attesa raddoppia a ogni tentativo successivo, fino a mezz'ora. Un amministratore può sbloccare rigenerando la password |

---

## 7. Archivio dei documenti su Supabase Storage

Finché queste variabili mancano, i file caricati restano nella cartella
`.archivio/` sul disco. Va bene in sviluppo; **su Vercel il disco è temporaneo e
i documenti sparirebbero al deploy successivo.**

1. Su Supabase: *Storage* → **New bucket** → nome `documenti`, e **lascia
   «Public bucket» disattivato**. Sono documenti di clienti: un bucket pubblico
   li rende leggibili a chiunque indovini una chiave.
2. *Project Settings* → *API* → copia l'URL del progetto e la chiave
   **`service_role`**.

```bash
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role>
SUPABASE_STORAGE_BUCKET=documenti
```

> La chiave `service_role` **scavalca RLS**: sta solo sul server, e non va mai
> messa in una variabile con prefisso `NEXT_PUBLIC_`. L'accesso ai file passa
> sempre da `/api/documenti/[id]`, che verifica i permessi prima di servire i byte.

**I backup del database non coprono lo Storage.** Il point-in-time recovery di
Supabase riguarda PostgreSQL: se un file viene cancellato dallo Storage, è perso.
La copia su Drive del punto seguente attenua il problema, ma non è un backup.

---

## 8. Cartella automatica su Google Drive

Alla firma di un contratto il sistema crea `<Cliente> / <codice commessa>` in un
Drive condiviso e vi copia i documenti caricati. L'archivio di riferimento resta
Supabase: Drive è una copia ([ADR-011](adr/011-drive-specchio-non-archivio.md)).

Un service account **non ha quota** su «Il mio Drive»: condividere la cartella
non basta, i file falliscono con *storage quota exceeded* (le cartelle vuote
possono invece comparire). Scegli una delle strade sotto.

1. **Google Cloud Console** → *APIs & Services* → abilita **Google Drive API**.

### Opzione A — Drive condiviso (Workspace, consigliata in azienda)

2. *Credentials* → **Service account** → *Keys* → JSON.
3. In Drive: *Drive condivisi* → *Nuovo* → aggiungi il service account come
   **Gestore dei contenuti**.
4. `GOOGLE_DRIVE_ID` = id del Drive (dall'URL).

```bash
GOOGLE_DRIVE_ID=<id del Drive condiviso>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email dal file JSON>
GOOGLE_SERVICE_ACCOUNT_KEY="<private_key, a capo come \n>"
```

### Opzione B — Cartella in «Il mio Drive» (es. EcoSolare OS su Gmail)

Serve OAuth dell’utente **proprietario** della cartella (non basta il service
account).

2. *Credentials* → **OAuth client ID** → tipo **Desktop app**. Nelle URI di
   reindirizzamento autorizza `http://127.0.0.1:53682/callback`.
3. In `.env.local`:

```bash
GOOGLE_DRIVE_ID=<id della cartella EcoSolare OS>
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
```

4. Poi in locale:

```bash
npm run drive:autorizza
```

Copia il `GOOGLE_OAUTH_REFRESH_TOKEN` stampato in `.env.local` e su Vercel.
Verifica con `npm run drive:verifica`, poi `npm run outbox`.

### Far girare la coda

La cartella non nasce dentro la firma del contratto: nasce poco dopo, da una coda
([ADR-005](adr/005-outbox-transazionale.md)). Se Drive è lento o giù, la firma
funziona lo stesso e la cartella arriva quando Drive torna.

In locale la coda va smaltita a mano:

```bash
npm run outbox
```

In produzione lo smaltimento parte da solo **dopo ogni firma e ogni
caricamento** (`after()`, a risposta già inviata all'utente): è il meccanismo
principale, e non dipende da alcun cron.

Il cron in `vercel.json` gira **una volta al giorno alle 07:00 UTC** ed è la rete
di sicurezza: rimette in coda le operazioni fallite, recupera i file rimasti
senza copia e manda l'avviso se qualcosa si è fermato. Una volta al giorno
perché **il piano Hobby di Vercel non accetta frequenze maggiori**: mettere
`*/5` in `vercel.json` fa fallire il deploy.

> L'orario non è casuale. I promemoria di follow-up partono solo dalle 08:00
> italiane in poi: alle 07:00 UTC a Roma sono le 09:00 d'estate e le 08:00
> d'inverno. Anticipare il cron significa non far partire i promemoria.

**Per avere lo smaltimento ogni cinque minuti senza passare al piano Pro**,
basta un pinger esterno gratuito:

1. Su [cron-job.org](https://cron-job.org): registrati → *Create cronjob*.
2. URL: `https://<il-tuo-dominio>/api/manutenzione/outbox`
3. Frequenza: ogni 5 minuti.
4. In *Advanced* → *Headers*: `x-maintenance-token: <MAINTENANCE_TOKEN>`

L'endpoint risponde sia a GET sia a POST ed è sicuro da chiamare in parallelo:
gli eventi si prendono con `skip locked`, quindi due esecuzioni sovrapposte non
elaborano mai la stessa riga.

Serve in ogni caso:

```bash
MAINTENANCE_TOKEN=<openssl rand -hex 32>
```

e lo stesso valore va messo su Vercel anche come `CRON_SECRET`, che è ciò che
Vercel invia quando lancia il cron.

### Se qualcosa non va

| Sintomo | Causa quasi certa |
|---|---|
| `storage quota exceeded` | cartella di Il mio Drive con solo service account: usa OAuth (`drive:autorizza`) o un Drive condiviso |
| `File not found: <id>` | il service account non è membro del Drive condiviso, oppure lo è come semplice lettore |
| `invalid_grant` | la chiave privata ha perso gli a capo: devono essere scritti come `\n` |
| L'evento resta «in attesa» | nessuno chiama la coda: `npm run outbox` in locale, cron o pinger in produzione |
| La cartella non compare mai | guarda `last_error` nella tabella `outbox_events`: il motivo è scritto lì |

---

## 9. Copia di sicurezza dei documenti

Nessun file viene mai cancellato dal sistema
([ADR-012](adr/012-nessuna-cancellazione-dei-file.md)): eliminare mette nel
cestino, e **il cestino non ha scadenza**. Si ripristina da *Impostazioni →
Manutenzione e cestino*, anche a mesi di distanza.

Sopra a questo, ogni file esiste in **due copie automatiche** — l'archivio su
Supabase e lo specchio su Google Drive — che sono due fornitori e due account
diversi. La terza copia la fai tu, e sta su un disco che possiedi:

```bash
npm run backup:documenti -- ~/Backup-EcoSolare
```

Scarica tutti i file (compresi quelli nel cestino) in cartelle e con nomi
leggibili, verifica ognuno contro il checksum registrato al caricamento e scrive
un `inventario.csv` apribile con qualunque foglio di calcolo. È **incrementale**:
rilanciarlo ogni sera costa pochi secondi, perché ciò che è già lì e integro non
viene riscaricato.

Per controllare l'integrità senza scrivere niente:

```bash
npm run backup:verifica
```

Segnala due situazioni, entrambe da prendere sul serio:

| Segnalazione | Significato |
|---|---|
| `File mancanti dall'archivio` | il database elenca il file ma nello Storage non c'è. Se hai una copia precedente di questo backup, **non cancellarla**: quei file sono lì |
| `File alterati` | il contenuto non corrisponde al checksum del caricamento. La copia locale precedente **non** viene sovrascritta |

Consiglio pratico: un disco esterno e il comando lanciato il venerdì. Basta
finché non si attiva una copia automatica verso un secondo fornitore di object
storage, che è il passo successivo previsto.

---

## 10. Cosa resta fuori, per ora

- **La verifica in due passaggi non c'è.** Era delegata a Google Workspace e con
  l'accesso a password è venuta meno ([D-003a-bis](01-registro-decisioni.md)).
- **La verifica dell'integrità dell'archivio è manuale**: `npm run backup:verifica`
  va lanciato da una persona, nessuno lo fa al posto tuo.
- **La copia locale non è automatica**: finché non c'è un secondo fornitore di
  object storage configurato, il comando di backup lo lanci tu.
- **Vercel** — vedi [08-deploy-staging-vercel.md](08-deploy-staging-vercel.md) per il deploy staging in `fra1`.

---

## 11. Prima di inserire dati di clienti veri

Nel momento in cui entra la prima anagrafica reale, questo smette di essere un
ambiente di prova. Servono quattro adempimenti, tutti fattibili senza consulente
([D-006](01-registro-decisioni.md)):

1. **Titolare del trattamento** designato per iscritto — EcoSolare, nella persona del
   legale rappresentante.
2. **Accordi con i responsabili esterni**: Supabase, Google, e più avanti Vercel. Sono
   contratti standard che i fornitori mettono a disposizione e si accettano una volta.
3. **Informativa privacy** sul modulo del sito, con il consenso registrato.
4. **Registro dei trattamenti** — un documento, non un progetto.
