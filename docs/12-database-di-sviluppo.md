# Il database di sviluppo

Fino al 12 agosto 2026 `.env.local` puntava al database dei clienti. Ogni prova
fatta dal portatile — una migrazione, un `npm run demo`, un caricamento di
prova — scriveva sui dati veri. Non per una svista di configurazione: per una
frase in un commento, «sviluppo e produzione usano lo stesso PostgreSQL
gestito», che voleva dire *lo stesso motore* ed è stata letta come *lo stesso
database*.

Questo documento dice come si separano e cosa succede se ci si dimentica.

---

## Perché non un PostgreSQL sul portatile

Perché l'ambiente locale deve somigliare alla produzione. Supabase in
*transaction pooler* non supporta i prepared statement, le sue estensioni non
sono quelle di un PostgreSQL vergine, e i limiti di connessione sono suoi: uno
sviluppo su PostgreSQL locale scopre questi problemi in produzione, che è il
momento peggiore.

Lo stesso motore, lo stesso servizio gestito, **due progetti diversi**.

---

## Creare il progetto di sviluppo

Il piano gratuito di Supabase consente due progetti, quindi non costa nulla.

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
   - nome: `ecosolare-sviluppo`
   - regione: la stessa della produzione (`eu-central-1`), così le latenze
     somigliano
   - salva la password del database in un gestore di password
2. **Project Settings → Database → Connection string → Transaction pooler**:
   copia la stringa.
3. Nel file `.env.local` del portatile:

   ```
   DATABASE_URL=<la stringa del progetto di sviluppo>
   AMBIENTE_DB=sviluppo
   ```

4. Porta lo schema e la configurazione di base:

   ```bash
   npm run db:migrate && npm run db:seed
   ```

5. Riempi con dati finti e crea un utente per entrare:

   ```bash
   npm run demo
   ```

Le altre variabili (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_STORAGE_BUCKET`) vanno cambiate insieme al database, altrimenti i file
caricati in sviluppo finiscono nell'archivio dei clienti. Sono nelle
impostazioni dello stesso progetto nuovo.

**`GOOGLE_DRIVE_ID` va lasciato vuoto in sviluppo**: senza, la coda accoda le
copie e non le esegue, che è quello che si vuole. Con l'identificativo di
produzione, ogni cliente finto genera una cartella vera nel Drive aziendale.

---

## Cosa protegge il sistema, e cosa no

`src/db/ambiente.ts` classifica il database in `sviluppo`, `produzione` o
`sconosciuto`. La dichiarazione `AMBIENTE_DB` vince su tutto; senza, si guarda
l'host.

**Un host che non riconosce vale produzione.** Il costo dei due errori non è lo
stesso: bloccare uno script su un database di prova costa dieci secondi e una
variabile d'ambiente, lasciarlo passare su quello vero costa i dati dei clienti.

### Si fermano da soli

| Comando | Perché |
|---|---|
| `npm run demo` | cancella e ricrea i propri record |
| `npm run prova:metriche` | crea decine di lead finti |
| `npm run prova:metriche:pulisci` | cancella per prefisso |

Il messaggio dice l'host — mai la stringa di connessione, che contiene la
password — e le due vie d'uscita.

### Non si fermano, di proposito

- **`npm run db:migrate`** — le migrazioni in produzione sono il modo giusto di
  far evolvere lo schema, non un incidente.
- **`npm run db:seed`** — inserisce solo configurazione di base con
  `onConflictDoNothing`: è idempotente e serve per popolare un ambiente nuovo.
- **`npm run amministratore`** — creare il primo utente in produzione è
  esattamente il suo mestiere.
- **l'applicazione** (`npm run dev`) — a volte si vuole davvero rigenerare un
  PDF su un preventivo reale. Stampa però un avviso in testa al terminale:

  ```
    ⚠  Questo processo scrive sul database di produzione: aws-1-eu-west-1.pooler.supabase.com
       Se è un database di prova, dichiaralo con AMBIENTE_DB=sviluppo.
  ```

La protezione sta su ciò che **distrugge**, non su ciò che configura. Metterla
anche dove non serve insegnerebbe a scavalcarla per abitudine, e a quel punto
non protegge più niente.

### Quando l'operazione in produzione è voluta

```bash
CONSENTI_SU_PRODUZIONE=1 npm run demo
```

Deve essere impossibile per sbaglio, non impossibile.

---

## Se hai già scritto in produzione

È successo, e si ripara. L'audit log (`audit_logs`) registra chi ha scritto
cosa; `inbound_submissions`, `contacts` e `opportunities` hanno tutte
`created_at`, quindi le righe di una sessione di prove si isolano per data.
Ricorda che eliminare, in questo sistema, vuol dire valorizzare `deleted_at`
(ADR-012): i file restano, e va bene così.
