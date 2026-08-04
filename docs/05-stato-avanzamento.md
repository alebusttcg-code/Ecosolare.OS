# Stato di avanzamento

**Data:** 4 agosto 2026 · misurato sul codice, non stimato a memoria.

| | |
|---|---|
| Tabelle | 22 |
| Migrazioni versionate | 5 |
| Test automatici verdi | 160 |
| Schermate e rotte | 18 |
| Moduli di dominio puri e testati | 8 |
| Dipendenze aggiunte per la grafica | 0 |

---

## 1. In una riga

**È costruito il fronte commerciale della macchina — dal lead al preventivo
firmabile. Non è costruito il retro operativo — dalla commessa al margine reale.**

Il primo produce visibilità sui ricavi. Il secondo protegge il margine durante
l'esecuzione, ed è dove vivono tre dei cinque problemi economici che il brief
voleva risolvere.

---

## 2. Le fasi del blueprint

| Fase | Contenuto | Stato |
|---|---|---|
| **0 — Audit** | Interviste, mappatura AS-IS, baseline KPI | ⚠️ **Solo la parte tecnica.** Interviste e baseline **non svolte** |
| **1 — Fondamenta** | Auth, ruoli, anagrafiche, intake, pipeline, attività | ✅ **Completa** |
| **2 — Vendita** | Prequalifica, sopralluoghi, preventivi, follow-up, documenti, firma | 🟡 **~60%** |
| **3 — Commessa** | Apertura da contratto, materiali, fornitori, readiness | ❌ Non iniziata |
| **4 — Cantieri** | Squadre, pianificazione, PWA tecnici, ore, fogli di lavoro | ❌ Non iniziata |
| **5 — Controllo economico** | Costi reali, consuntivi, margine reale, incassi | ❌ Non iniziata |
| **6 — Post-vendita e AI** | Ticket, manutenzioni, recensioni, assistenti | ❌ Non iniziata |

### Dentro la Fase 2

| Fatto | Mancante |
|---|---|
| Prequalifica con questionario condizionale e punteggio | Appuntamenti e sincronizzazione calendario |
| Sopralluoghi con checklist versionate e chiusura bloccante | Sequenze di follow-up |
| Preventivi: versioni immutabili, motore del margine, approvazione sotto soglia | Checklist documentale |
| Catalogo prodotti (tabella) | Generazione PDF e invio |
| Gate sui costi verificato a livello di payload | Firma elettronica |
| | Interfaccia di gestione del catalogo |

**Tre di questi mancano per decisioni non prese, non per tempo di sviluppo:**
quali documenti servono davvero (B9), quale provider di firma (B15), se WhatsApp
passa dalla Cloud API (B14).

---

## 3. I 22 criteri di accettazione del brief

✅ soddisfatto e verificabile · 🟡 parziale · ❌ non ancora

| # | Criterio | |
|---|---|---|
| 1 | Ogni nuovo lead entra nel sistema | 🟡 meccanismo pronto, mai usato su lead veri |
| 2 | I duplicati vengono segnalati | ✅ |
| 3 | Ogni lead ha un responsabile | ✅ |
| 4 | Ogni opportunità ha una prossima azione | ✅ imposto in tre punti indipendenti |
| 5 | Il tempo di risposta è misurabile | 🟡 si misura, ma manca il termine di paragone |
| 6 | I sopralluoghi hanno checklist complete | ✅ chiusura bloccante verificata |
| 7 | I preventivi sono versionati | ✅ |
| 8 | Il margine previsto è visibile | ✅ |
| 9 | I follow-up non dipendono dalla memoria | ❌ |
| 10 | I documenti mancanti sono identificabili | ❌ |
| 11 | Una firma genera una commessa | ❌ |
| 12 | Ogni commessa ha task e responsabilità | ❌ |
| 13 | Cantieri pianificabili distinti da non pianificabili | ❌ |
| 14 | Materiali e documenti bloccanti visibili | ❌ |
| 15 | Tecnici e squadre vedono ciò che serve | 🟡 permessi pronti, interfaccia di campo no |
| 16 | Ore e fogli di lavoro registrati | ❌ |
| 17 | Costi previsti e reali confrontabili | ❌ |
| 18 | Il margine reale è calcolabile | ❌ |
| 19 | I ticket sono tracciati | ❌ |
| 20 | La direzione ha dashboard affidabili | 🟡 esiste, copre solo il commerciale |
| 21 | Ogni automazione critica è verificabile | ❌ nessuna automazione attiva |
| 22 | Gli utenti vedono solo i dati autorizzati | ✅ verificato sul payload, non solo a schermo |

**8 soddisfatti · 4 parziali · 10 non ancora.**

---

## 4. I cinque problemi economici del brief

| Problema | Stato |
|---|---|
| I lead si raffreddano perché la presa in carico dipende da chi vede il messaggio | 🟡 Ogni lead entra con responsabile e scadenza. Manca la **notifica immediata**, che è ciò che rende davvero raggiungibile il target dei 5 minuti |
| I preventivi non vengono inseguiti | ❌ Le sequenze di follow-up non esistono |
| I cantieri partono incompleti | ❌ La funzione di *readiness* — quella che ho definito «la più importante del sistema» — non è costruita |
| Il margine reale non è noto finché non è tardi | 🟡 Il margine **previsto** è calcolato e protetto da approvazione. Il margine **reale** richiede le Fasi 4 e 5 |
| Il titolare è il collo di bottiglia | 🟡 Pipeline e attività sono visibili a tutti. Cantieri e commesse no |

---

## 5. Cosa non è misurabile in righe di codice, e conta di più

**L'audit operativo non è mai stato fatto.** È il punto più importante di questo
documento. Ne discendono tre conseguenze concrete:

1. **Ogni soglia, template e stato è una mia ipotesi.** Le 16 fasi della
   pipeline, i 30 campi della checklist di sopralluogo, i 25 della prequalifica,
   la soglia di margine al 20%, i punteggi: sono derivati dal brief, non da come
   lavora EcoSolare. Li ho resi tutti configurabili proprio per questo, ma
   configurabile non vuol dire giusto.
2. **La baseline KPI non esiste, e questa è una finestra che si chiude.** Una
   volta che il sistema è in uso, il "prima" non è più ricostruibile. Senza,
   fra sei mesi non si potrà dimostrare alcun miglioramento — solo affermarlo.
3. **Nessuno ha ancora usato il sistema.** Il criterio di successo dell'MVP —
   *per 30 giorni consecutivi il 100% dei lead entra nel sistema* — non è
   iniziato. Il rischio numero uno del progetto resta l'adozione, non la
   tecnologia, e su quello non è stato fatto nulla.

**Domande bloccanti ancora aperte:** B3 (è stata valutata l'alternativa a un
software su misura?), B9 (documenti reali), B13 (gestionale contabile), B14
(WhatsApp), B15 (firma), B18 (AI sui documenti), A2 e A3 (numero di utenti e
volumi reali).

---

## 6. Cosa è solido e non andrà rifatto

- **Motore del margine**: aritmetica interamente intera, 21 test, arrotondamento
  per riga come nella fatturazione italiana.
- **Motore dei questionari**: 23 test, condizionalità e obbligatorietà, usato da
  prequalifica e sopralluoghi.
- **Policy layer**: 36 test, 4 ruoli × 26 risorse, e il gate sui costi verificato
  ispezionando il payload servito al browser, non solo ciò che appare a schermo.
- **Migrazioni versionate e ripetibili**, verificate su PostgreSQL a ogni CI.
- **Registro delle decisioni** (D-001…D-009) e ADR (001…010): fra un anno si
  saprà perché ogni scelta è stata presa.

---

## 7. Il passo successivo che conta

Non è tecnico. Nell'ordine:

1. **Le cinque interviste e la baseline** (Sprint 0, materiali già pronti in
   `docs/02` e `docs/03`). Sbloccano la validazione di tutto ciò che ho ipotizzato.
2. **Database, GitHub e Vercel** — già preparati (D-009), rinviati per scelta.
3. **Mettere in uso reale ciò che esiste**, prima di costruire le fasi 3-6.
   Un sistema al 40% adottato vale più di uno al 100% costruito e mai usato.
