# Stato di avanzamento

**Data:** 7 agosto 2026 · misurato sul codice, non stimato a memoria.

| | |
|---|---|
| Tabelle | 40 |
| Migrazioni versionate | 10 (di cui 2 ancora da consolidare in git: auth password, outbox/Drive) |
| Test automatici verdi | 317 |
| Schermate e rotte | 21 |
| Moduli di dominio puri e testati | 11 |
| Dipendenze aggiunte per la grafica | 0 |

---

## 1. In una riga

**Dal lead alla commessa pianificabile il percorso esiste; manca l’adozione
reale e il resto del ciclo operativo (cantiere → margine reale → post-vendita).**

Il fronte commerciale è solido. La Fase 3 (commessa, readiness, documenti) e
un pezzo di controllo amministrativo (OK e riconciliazione bancaria) sono già
nel codice. Auth con password, outbox e specchio Drive sono costruiti ma
ancora sul working tree, non chiusi in un commit.

---

## 2. Le fasi del blueprint

| Fase | Contenuto | Stato |
|---|---|---|
| **0 — Audit** | Interviste, mappatura AS-IS, baseline KPI | 🟡 **Baseline prospettica** (D-012): KPI da `/metriche`, non foglio storico. Interviste ancora da fare |
| **1 — Fondamenta** | Auth, ruoli, anagrafiche, intake, pipeline, attività | ✅ **Completa** (auth email+password in lavorazione: D-003a-bis) |
| **2 — Vendita** | Prequalifica, sopralluoghi, preventivi, follow-up, documenti, firma | 🟡 **~70%** |
| **3 — Commessa** | Apertura da contratto, materiali, readiness, documenti | 🟡 **~55%** — motore e schermate base; non ancora collaudata in uso |
| **4 — Cantieri** | Squadre, pianificazione, PWA tecnici, ore, fogli di lavoro | ❌ Non iniziata |
| **5 — Controllo economico** | Costi reali, consuntivi, margine reale, incassi | 🟡 **Avvio** — OK amministrativo e riconciliazione bancaria presenti; consuntivo/margine reale no |
| **6 — Post-vendita e AI** | Ticket, manutenzioni, recensioni, assistenti | ❌ Non iniziata |

### Dentro la Fase 2

| Fatto | Mancante |
|---|---|
| Prequalifica con questionario condizionale e punteggio | Appuntamenti e sincronizzazione calendario |
| Sopralluoghi con checklist versionate e chiusura bloccante | Sequenze di follow-up |
| Preventivi: versioni immutabili, motore del margine, approvazione sotto soglia | Generazione PDF e invio |
| Catalogo prodotti (tabella) | Firma elettronica con provider (oggi: registrazione firma nel gestionale) |
| Gate sui costi verificato a livello di payload | Interfaccia di gestione del catalogo |
| | Checklist documentale di *vendita* (quella di *commessa* esiste) |

**Tre di questi mancano per decisioni non prese, non per tempo di sviluppo:**
quali documenti servono davvero in vendita (B9), quale provider di firma (B15),
se WhatsApp passa dalla Cloud API (B14).

### Dentro la Fase 3 (da agosto 2026)

| Fatto | Mancante / da consolidare |
|---|---|
| Firma preventivo → apre commessa | Collaudo con utenti reali |
| Readiness: pianificabile vs bloccata, con motivi | Distinta materiali e fornitori “di produzione” |
| Checklist documentale di commessa + upload | Notifiche quando qualcosa sblocca/blocca |
| Copia su Drive via outbox (ADR-011), codice pronto | Credenziali Google, Drive condiviso, commit e deploy |
| Storage: disco in locale, Supabase in cloud | Bucket e variabili d’ambiente in produzione |

---

## 3. I 22 criteri di accettazione del brief

✅ soddisfatto e verificabile · 🟡 parziale · ❌ non ancora

| # | Criterio | |
|---|---|---|
| 1 | Ogni nuovo lead entra nel sistema | 🟡 meccanismo pronto, mai usato su lead veri |
| 2 | I duplicati vengono segnalati | ✅ |
| 3 | Ogni lead ha un responsabile | ✅ |
| 4 | Ogni opportunità ha una prossima azione | ✅ imposto in tre punti indipendenti |
| 5 | Il tempo di risposta è misurabile | 🟡 si misura in `/metriche`; baseline = primi 30 gg di uso (D-012) |
| 6 | I sopralluoghi hanno checklist complete | ✅ chiusura bloccante verificata |
| 7 | I preventivi sono versionati | ✅ |
| 8 | Il margine previsto è visibile | ✅ |
| 9 | I follow-up non dipendono dalla memoria | ❌ |
| 10 | I documenti mancanti sono identificabili | 🟡 in **commessa** sì (readiness); in **vendita** no |
| 11 | Una firma genera una commessa | ✅ nel gestionale; non ancora firma elettronica di terzi |
| 12 | Ogni commessa ha task e responsabilità | 🟡 aperti alla firma; workflow operativo incompleto |
| 13 | Cantieri pianificabili distinti da non pianificabili | ✅ motore readiness |
| 14 | Materiali e documenti bloccanti visibili | ✅ via readiness |
| 15 | Tecnici e squadre vedono ciò che serve | 🟡 permessi pronti, interfaccia di campo no |
| 16 | Ore e fogli di lavoro registrati | ❌ |
| 17 | Costi previsti e reali confrontabili | 🟡 previsto sì; reale solo pezzi (banca / OK amm.) |
| 18 | Il margine reale è calcolabile | ❌ richiede costi di cantiere end-to-end |
| 19 | I ticket sono tracciati | ❌ |
| 20 | La direzione ha dashboard affidabili | 🟡 metriche commerciali + pezzi amm.; non il quadro completo |
| 21 | Ogni automazione critica è verificabile | 🟡 outbox + cron predisposti; non ancora in produzione |
| 22 | Gli utenti vedono solo i dati autorizzati | ✅ verificato sul payload, non solo a schermo |

**10 soddisfatti · 8 parziali · 4 non ancora.**

---

## 4. I cinque problemi economici del brief

| Problema | Stato |
|---|---|
| I lead si raffreddano perché la presa in carico dipende da chi vede il messaggio | 🟡 Ogni lead entra con responsabile e scadenza. Manca la **notifica immediata** (target 5 minuti) |
| I preventivi non vengono inseguiti | ❌ Le sequenze di follow-up non esistono |
| I cantieri partono incompleti | 🟡 La *readiness* c’è; non è ancora disciplina quotidiana di nessuno |
| Il margine reale non è noto finché non è tardi | 🟡 Margine **previsto** protetto. Margine **reale** ancora incompleto (Fasi 4–5) |
| Il titolare è il collo di bottiglia | 🟡 Pipeline, attività e commesse sono visibili. Cantieri e campo no |

---

## 5. Cosa non è misurabile in righe di codice, e conta di più

**L’audit operativo non è mai stato fatto.** Resta il punto più importante.
Ne discendono tre conseguenze concrete:

1. **Ogni soglia, template e stato è un’ipotesi.** Pipeline, checklist,
   soglia di margine, punteggi: derivati dal brief, non da come lavora
   EcoSolare. Configurabili ≠ giusti.
2. **La baseline KPI non esiste, e la finestra si chiude.** Una volta in uso,
   il “prima” non si ricostruisce. Senza baseline, fra sei mesi si potrà solo
   affermare un miglioramento, non dimostrarlo.
3. **Nessuno ha ancora usato il sistema su lavoro vero.** Il criterio MVP —
   *30 giorni, 100% dei nuovi lead nel sistema* — non è iniziato. Il rischio
   numero uno resta l’adozione.

**Domande ancora aperte:** B3, B9, B13, B14, B15, B18, A2, A3.
**Rischio sicurezza da presidiare:** dopo D-003a-bis non c’è MFA; va ripreso
prima di dati clienti reali in produzione.

---

## 6. Cosa è solido e non andrà rifatto

- **Motore del margine**: aritmetica intera, arrotondamento per riga.
- **Motore dei questionari**: condizionalità e obbligatorietà, prequalifica e sopralluoghi.
- **Readiness di commessa**: pianificabile vs bloccata, testata.
- **Riconciliazione bancaria**: motore di matching, testato.
- **Policy layer**: 4 ruoli × risorse, gate costi sul payload.
- **Outbox transazionale** (ADR-005) e **Drive come specchio** (ADR-011): direzione giusta per gli effetti esterni.
- **Migrazioni versionate e ripetibili**, RLS blindata.
- **Registro decisioni** (fino a D-011 nel ramo corrente) e ADR 001–011.

---

## 7. Checklist — primo uso interno (questa settimana)

Obiettivo: una persona entra, crea un utente, fa passare un lead finto fino
alla commessa, senza costruire altre funzioni.

### A. Chiudere il pezzo tecnico già fatto

- [x] Commit del lavoro auth + outbox + Drive + storage (`086bcef`)
- [x] `npm run check` verde sul commit
- [x] Migrazioni `0008` e `0009` applicate sul database di lavoro

### B. Ambiente

- [x] Progetto Supabase UE — `DATABASE_URL` già impostata (pooler, porta 6543)
- [ ] Pulire `.env.local`: togliere le chiavi Auth.js/Google (`AUTH_*`, `ALLOWED_EMAIL_DOMAIN`, `ADMIN_BOOTSTRAP_EMAIL`) non più usate
- [ ] Bucket Storage privato + variabili Supabase Storage (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`)
- [x] `npm run db:migrate` — fatto (40 tabelle, RLS ok, seed presente)
- [ ] `npm run amministratore` (password iniziale una sola volta; oggi: 0 utenti)
- [ ] (Opzionale ma utile) Drive condiviso + service account, altrimenti la coda Drive resta ferma senza bloccare il gestionale
- [ ] Deploy Vercel in `fra1` (o almeno ambiente condiviso raggiungibile)

### C. Prova end-to-end (30–45 minuti)

- [ ] Accedi → cambia password al primo accesso
- [ ] Crea un secondo utente (es. commerciale) da amministrazione
- [ ] Crea cliente + opportunità (o intake di test)
- [ ] Prequalifica / sopralluogo se serve al flusso
- [ ] Preventivo → invio stato “inviato” → registrazione firma → commessa aperta
- [ ] Carica un documento; verifica readiness e, se Drive è configurato, che la coda lo copi (`npm run outbox` in locale)

### D. In parallelo, non tecnici ma bloccanti a medio termine

- [ ] Una baseline KPI compilata *prima* che il sistema diventi abitudine (`docs/03`)
- [ ] Almeno le interviste chiave di Sprint 0 (`docs/02`), anche se brevi
- [ ] Decidere se i lead veri partono questa settimana o la prossima — e da quale canale

---

## 8. Il passo successivo che conta

Nell’ordine:

1. **Chiudere e collaudare** ciò che è già sul tavolo (sezione 7), prima di aprire Fase 4.
2. **Interviste + baseline** — sbloccano la validazione delle ipotesi.
3. **Lead veri nel sistema** — avvia il criterio di successo dell’MVP.

Un sistema al 40% adottato vale più di uno al 100% costruito e mai usato.
)
