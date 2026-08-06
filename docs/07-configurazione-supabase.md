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

# Lascia quello che c'è già: è stato generato in modo sicuro
AUTH_SECRET=...

# Dal passo 5
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# La tua email aziendale: al primo accesso ti crea come amministratore
ADMIN_BOOTSTRAP_EMAIL=federico@ecosolare.it

# Lascia quello che c'è
INTAKE_TOKEN=...
```

**Una riga da cancellare:** `DB_POOL_MAX=1` serviva al database locale, che accetta
una connessione sola. Con Supabase **va tolta** — il valore predefinito è più adatto.

Se vuoi limitare il dominio di accesso, aggiungi anche:

```bash
ALLOWED_EMAIL_DOMAIN=ecosolare.it
```

Così solo gli account di quel dominio possono accedere. Consigliato in produzione.

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

## 5. Credenziali Google per l'accesso

1. Vai su **console.cloud.google.com**, accedi con l'account Workspace di EcoSolare.
2. Crea un progetto, per esempio `EcoSolare OS`.
3. **APIs & Services → OAuth consent screen**:
   - tipo **Internal** (se avete Workspace) — così solo il vostro dominio può accedere;
   - nome applicazione: `EcoSolare OS`, email di assistenza: la tua.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - tipo **Web application**;
   - **Authorized redirect URIs**, aggiungi:
     ```
     http://localhost:3000/api/auth/callback/google
     ```
   - quando andremo online aggiungerai anche quello di Vercel, senza toccare il resto.
5. Copia **Client ID** e **Client secret** in `.env.local`.

---

## 6. Primo accesso

```bash
npm run dev
```

Apri `http://localhost:3000` e accedi con Google.

Il primo accesso ti crea come **amministratore**, e solo perché il database è vuoto
e la tua email combacia con `ADMIN_BOOTSTRAP_EMAIL`. Da quel momento **non esiste
auto-registrazione**: chiunque altro deve essere abilitato da te in *Utenti*, anche
se ha un account Google del dominio.

### Se qualcosa non funziona

| Sintomo | Causa quasi certa |
|---|---|
| `tenant or user not found` | l'host non corrisponde alla regione del progetto. **Non ricostruire la stringa a mano**: copiala dal pulsante di Supabase, perché il prefisso (`aws-0`, `aws-1`…) e la regione cambiano da progetto a progetto |
| `password authentication failed` | password con caratteri speciali non codificati, o password sbagliata |
| `Connection terminated` / timeout | stai usando la porta 5432 invece di 6543 |
| `prepared statement ... already exists` | stringa di connessione diretta invece del pooler |
| Accesso rifiutato dopo il login Google | email diversa da `ADMIN_BOOTSTRAP_EMAIL`, oppure ci sono già utenti nel database |
| `redirect_uri_mismatch` | l'URI su Google Cloud non combacia esattamente, barra finale compresa |

---

## 7. Cosa resta fuori, per ora

- **I documenti caricati restano sul disco locale** (`.archivio/`). Su Vercel il disco
  è temporaneo: prima di andare online serve attivare **Supabase Storage**, che è già
  previsto e si aggancia senza riscrivere nulla.
- **Vercel** non è ancora configurato: se ne parla quando il funzionamento in locale
  contro Supabase è verificato.

---

## 8. Prima di inserire dati di clienti veri

Nel momento in cui entra la prima anagrafica reale, questo smette di essere un
ambiente di prova. Servono quattro adempimenti, tutti fattibili senza consulente
([D-006](01-registro-decisioni.md)):

1. **Titolare del trattamento** designato per iscritto — EcoSolare, nella persona del
   legale rappresentante.
2. **Accordi con i responsabili esterni**: Supabase, Google, e più avanti Vercel. Sono
   contratti standard che i fornitori mettono a disposizione e si accettano una volta.
3. **Informativa privacy** sul modulo del sito, con il consenso registrato.
4. **Registro dei trattamenti** — un documento, non un progetto.
