# Deploy staging su Vercel

Guida operativa per la **Settimana 1** del piano fondamenta. Obiettivo: un ambiente
`staging` in regione `fra1`, collegato a Supabase, pronto per il collaudo E2E con dati
non reali (o pochi lead di prova).

**Prerequisito:** Supabase configurato come in [07-configurazione-supabase.md](07-configurazione-supabase.md).

**Tempo stimato:** 45–60 minuti.

---

## Checklist rapida

- [ ] Progetto Supabase `ecosolare-os` in **Frankfurt**
- [ ] `npm run db:migrate` e `npm run db:seed` eseguiti sul database remoto
- [ ] Bucket Storage `documenti` **privato**
- [ ] Progetto Vercel collegato al repository GitHub
- [ ] Regione Vercel: **Frankfurt (fra1)** — già in `vercel.json`
- [ ] Variabili d'ambiente impostate (vedi sotto)
- [ ] `npm run amministratore` eseguito **contro staging** (non locale)
- [ ] Primo login staging + cambio password
- [ ] Cron outbox attivo (`/api/manutenzione/outbox`)
- [ ] Collaudo E2E documentato in [09-collaudo-e2e.md](09-collaudo-e2e.md)

---

## 1. Preparare Supabase

Segui [07-configurazione-supabase.md](07-configurazione-supabase.md) fino al passo 5 incluso.

Verifica aggiuntive per staging:

1. **Storage → New bucket** → nome `documenti`, **Public bucket OFF**.
2. Copia `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).
3. Su Table Editor: tutte le tabelle con **RLS enabled**.

> Non eseguire `npm run demo` su staging dopo il seed iniziale.

---

## 2. Creare il progetto Vercel

1. [vercel.com](https://vercel.com) → *Add New Project* → importa il repository GitHub.
2. Framework: **Next.js** (auto-rilevato).
3. Root directory: `/` (default).
4. **Region:** Frankfurt (`fra1`) — confermato da `vercel.json`.

Non fare deploy ancora: servono le variabili.

---

## 3. Variabili d'ambiente su Vercel

In *Project Settings → Environment Variables*, per l'ambiente **Preview** (staging) e
opzionalmente **Production**:

| Variabile | Valore | Note |
|---|---|---|
| `DATABASE_URL` | Transaction pooler Supabase (`:6543`, host con `pooler`) | Copia dal pulsante Connect |
| `INTAKE_TOKEN` | `openssl rand -hex 32` | Stesso valore nei form del sito di staging |
| `MAINTENANCE_TOKEN` | `openssl rand -hex 32` | Protegge `/api/manutenzione/*` |
| `CRON_SECRET` | **Identico a `MAINTENANCE_TOKEN`** | Vercel lo invia al cron |
| `SUPABASE_URL` | URL progetto Supabase | |
| `SUPABASE_SERVICE_ROLE_KEY` | Chiave service_role | Mai in `NEXT_PUBLIC_*` |
| `SUPABASE_STORAGE_BUCKET` | `documenti` | |
| `GOOGLE_DRIVE_ID` | Id cartella/Drive condiviso | Opzionale in staging iniziale |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Email service account | |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Chiave privata con `\n` | |
| `TELEGRAM_BOT_TOKEN` | Token @BotFather | Opzionale; senza, no reminder FU |
| `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -hex 32` | Stesso secret in `setWebhook` |
| `TELEGRAM_BOT_USERNAME` | es. `EcoSolareOSBot` | Senza `@` |
| `APP_BASE_URL` | URL staging `https://….vercel.app` | Link nelle notifiche Telegram |

Dopo il deploy, registra il webhook Telegram (una volta):

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"$APP_BASE_URL/api/telegram/webhook\",\"secret_token\":\"$TELEGRAM_WEBHOOK_SECRET\"}"
```

**Non impostare** `DB_POOL_MAX=1` su Vercel (vale solo per PostgreSQL locale).

Genera i token in locale:

```bash
openssl rand -hex 32   # INTAKE_TOKEN
openssl rand -hex 32   # MAINTENANCE_TOKEN (= CRON_SECRET)
```

---

## 4. Primo deploy

1. Push del branch su GitHub (o *Deploy* da Vercel).
2. Attendi build verde.
3. Apri l'URL preview (es. `ecosolare-os-xxx.vercel.app`).

Se la build fallisce per `DATABASE_URL` mancante in fase di build: normale finché
le env non sono impostate; dopo averle aggiunte, *Redeploy*.

---

## 5. Creare l'amministratore su staging

Dal **tuo computer**, punta temporaneamente al database staging:

```bash
# In .env.local, DATABASE_URL deve essere quella di Supabase staging
npm run amministratore
```

Inserisci l'email operativa e **salva la password** stampata (non recuperabile).

Poi accedi all'URL Vercel, login, cambio password obbligatorio.

> Alternativa futura: script `amministratore` invocato da CI con secret — non necessario ora.

---

## 6. Verifiche post-deploy

| Controllo | Come |
|---|---|
| Login | Email + password su URL staging |
| Upload documento | Cantieri → commessa → carica PDF → ricarica pagina (file ancora lì) |
| Cron outbox | Vercel → Cron Jobs → ultima esecuzione OK (1×/giorno, 07:00 UTC; Hobby) |
| Intake | `curl -X POST …/api/intake` con header `x-intake-token` |
| Regione | Vercel → Settings → Functions → fra1 |

### Test intake (sostituisci URL e token)

```bash
curl -sS -X POST 'https://TUO-PROGETTO.vercel.app/api/intake' \
  -H 'Content-Type: application/json' \
  -H "x-intake-token: $INTAKE_TOKEN" \
  -d '{"nome":"Mario","cognome":"Rossi","telefono":"3331234567","email":"mario@example.com","linea":"fotovoltaico","messaggio":"Test staging"}'
```

Risposta attesa: `201` con id lead.

---

## 7. Cosa NON fare su staging

- Non inserire anagrafiche clienti reali finché non sono completati gli adempimenti
  GDPR ([07 §10](07-configurazione-supabase.md)).
- Non condividere `SUPABASE_SERVICE_ROLE_KEY` o `MAINTENANCE_TOKEN`.
- Non usare bucket Storage pubblico.

---

## 8. Prossimo passo

Esegui il [collaudo E2E](09-collaudo-e2e.md) sull'URL staging e registra esito + data.
Poi passa alla Settimana 2 (intake in produzione, notifiche lead, filtri).
