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

Non serve altro. L'accesso avviene con email e password, e il token di sessione è
un valore casuale confrontato con il database, non un token firmato: non c'è alcun
segreto di autenticazione da configurare.

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

**Serve un Drive condiviso, non una cartella del tuo Drive personale.** Un
service account non ha spazio proprio e non può possedere file in un «Il mio
Drive»: con una cartella personale ogni creazione fallisce con *storage quota
exceeded*.

1. **Google Cloud Console** → nuovo progetto (o quello esistente) → *APIs &
   Services* → abilita **Google Drive API**.
2. *Credentials* → **Create credentials** → *Service account*. Creato, apri la
   scheda *Keys* → **Add key** → *JSON*: scarica il file.
3. In **Google Drive** crea un *Drive condiviso* (menu a sinistra → *Drive
   condivisi* → *Nuovo*). Aprilo, **Gestisci membri**, aggiungi l'indirizzo del
   service account (`...@....iam.gserviceaccount.com`) come **Gestore dei
   contenuti**.
4. L'id del Drive condiviso è nell'URL: `drive.google.com/drive/folders/<id>`.

```bash
GOOGLE_DRIVE_ID=<id del Drive condiviso>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email dal file JSON>
GOOGLE_SERVICE_ACCOUNT_KEY="<private_key dal file JSON, con gli a capo come \n>"
```

### Far girare la coda

La cartella non nasce dentro la firma del contratto: nasce poco dopo, da una coda
([ADR-005](adr/005-outbox-transazionale.md)). Se Drive è lento o giù, la firma
funziona lo stesso e la cartella arriva quando Drive torna.

In locale la coda va smaltita a mano:

```bash
npm run outbox
```

In produzione ci pensa il cron in `vercel.json`, ogni cinque minuti. Serve:

```bash
MAINTENANCE_TOKEN=<openssl rand -hex 32>
```

e lo stesso valore va messo su Vercel anche come `CRON_SECRET`, che è ciò che
Vercel invia quando lancia il cron.

### Se qualcosa non va

| Sintomo | Causa quasi certa |
|---|---|
| `storage quota exceeded` | stai usando una cartella del Drive personale invece di un Drive condiviso |
| `File not found: <id>` | il service account non è membro del Drive condiviso, oppure lo è come semplice lettore |
| `invalid_grant` | la chiave privata ha perso gli a capo: devono essere scritti come `\n` |
| L'evento resta «in attesa» | nessuno chiama la coda: `npm run outbox` in locale, cron in produzione |
| La cartella non compare mai | guarda `last_error` nella tabella `outbox_events`: il motivo è scritto lì |

---

## 9. Cosa resta fuori, per ora

- **La verifica in due passaggi non c'è.** Era delegata a Google Workspace e con
  l'accesso a password è venuta meno ([D-003a-bis](01-registro-decisioni.md)).
- **Un evento che fallisce definitivamente non avvisa nessuno**: resta `fallito`
  in `outbox_events` e va cercato.
- **Vercel** — vedi [08-deploy-staging-vercel.md](08-deploy-staging-vercel.md) per il deploy staging in `fra1`.

---

## 10. Prima di inserire dati di clienti veri

Nel momento in cui entra la prima anagrafica reale, questo smette di essere un
ambiente di prova. Servono quattro adempimenti, tutti fattibili senza consulente
([D-006](01-registro-decisioni.md)):

1. **Titolare del trattamento** designato per iscritto — EcoSolare, nella persona del
   legale rappresentante.
2. **Accordi con i responsabili esterni**: Supabase, Google, e più avanti Vercel. Sono
   contratti standard che i fornitori mettono a disposizione e si accettano una volta.
3. **Informativa privacy** sul modulo del sito, con il consenso registrato.
4. **Registro dei trattamenti** — un documento, non un progetto.
