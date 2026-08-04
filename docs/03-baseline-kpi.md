# Sprint 0 — Misura della baseline KPI

**Perché serve:** senza il "prima", il "dopo" non dimostra nulla e il ROI del progetto resta un'opinione. Questa è l'unica occasione per misurarlo: una volta che il sistema è in uso, il "prima" non è più ricostruibile.

**Sforzo:** 4–6 ore in totale. Non di più — la precisione al giorno è sufficiente, quella all'ora è inutile.

---

## Metodo

**1. Scegli il campione: 20–30 pratiche degli ultimi 6–12 mesi.**
Non solo quelle andate bene. La proporzione giusta è indicativamente:
- 10–15 vinte e concluse (servono per i dati di cantiere, ore e margine)
- 8–10 perse (servono per la conversione e i motivi di perdita)
- 3–5 problematiche o bloccate a lungo (servono per i giorni di blocco, che sono il KPI più azionabile)

Se prendi solo le pratiche riuscite, la baseline risulterà migliore della realtà e a fine progetto i miglioramenti sembreranno inferiori a quelli veri.

**2. Ricostruisci ogni riga da ciò che esiste:** WhatsApp, email, Google Calendar, fatture, bolle di consegna, rapportini cartacei.

**3. Accetta l'approssimazione.** "Circa 4 giorni" è un dato utilizzabile. Aspettare il dato esatto significa non finire mai.

**4. Dove un dato non è ricostruibile, scrivi `n/d`. Non stimarlo a sentimento.**

> **Il numero di `n/d` è esso stesso il risultato più importante di questo esercizio.**
> Se su 30 pratiche non riesci a dire quando è arrivato il contatto o quanto hai marginato, quello non è un buco nel foglio: è la dimostrazione quantificata del problema che il sistema deve risolvere, ed è il dato più convincente da mostrare fra sei mesi.

---

## Come compilare il foglio

Apri [`baseline-kpi-template.csv`](baseline-kpi-template.csv) in Google Sheets (*File → Importa → Carica*). Una riga per pratica.

| Colonna | Cosa scrivere | Dove cercarlo |
|---|---|---|
| `id` | Riferimento interno (numero preventivo, nome cliente abbreviato) | — |
| `linea` | `fv` / `elettrico` / `idraulico` | — |
| `fonte` | Come è arrivato: sito, passaparola, cliente esistente, campagna, telefono… | Memoria, email |
| `data_primo_contatto` | Quando è arrivata la richiesta | WhatsApp, email, registro chiamate |
| `data_prima_risposta` | Quando **qualcuno ha risposto davvero** al cliente | Stessa fonte |
| `data_appuntamento_fissato` | Quando è stato fissato | Calendar |
| `data_sopralluogo` | Quando è stato fatto | Calendar |
| `data_invio_preventivo` | Data di invio della **prima** versione | Email |
| `n_versioni_preventivo` | Quante versioni sono state prodotte | Cartelle, email |
| `n_richiami_dati_mancanti` | Quante volte si è ricontattato il cliente perché mancava un dato o un documento | Memoria, WhatsApp |
| `valore_preventivo` | Imponibile della versione inviata | Preventivo |
| `esito` | `vinto` / `perso` / `aperto` | — |
| `motivo_perdita` | Prezzo, tempi, concorrente, silenzio, non idoneo… | Memoria |
| `data_firma` | Firma o accettazione | Contratto |
| `data_inizio_cantiere` | Primo giorno di lavoro in campo | Rapportini, calendar |
| `data_fine_cantiere` | Ultimo giorno | Rapportini |
| `giorni_blocco` | Giorni in cui la commessa è stata ferma in attesa di qualcosa | Stima |
| `motivo_blocco` | Documenti, materiali, pratica, cliente, meteo, altro | — |
| `ore_previste` / `ore_effettive` | Ore di manodopera | Preventivo / rapportini |
| `costo_materiali_previsto` / `costo_materiali_reale` | Materiali | Preventivo / fatture fornitore |
| `data_fattura_saldo` / `data_incasso_saldo` | Fatturazione e incasso del saldo | Contabilità |
| `note` | Qualunque cosa sia andata storta | — |

---

## KPI che si ricavano dal foglio

Una volta compilato, questi sono i numeri della baseline. Sono gli stessi che il sistema calcolerà in automatico, così il confronto sarà diretto.

| KPI | Come si calcola dal foglio |
|---|---|
| **Speed-to-lead** (mediana) | mediana di `data_prima_risposta − data_primo_contatto` |
| Lead → appuntamento | % righe con `data_appuntamento_fissato` valorizzata |
| Appuntamento → sopralluogo | % righe con `data_sopralluogo` valorizzata |
| **Sopralluogo → preventivo** (mediana giorni) | mediana di `data_invio_preventivo − data_sopralluogo` |
| **Conversione** | `vinto` / (`vinto` + `perso`) |
| Conversione per fonte | stessa formula, raggruppata per `fonte` |
| Ticket medio | media di `valore_preventivo` sui `vinto`, per linea |
| Contratto → cantiere (mediana giorni) | mediana di `data_inizio_cantiere − data_firma` |
| Durata commessa | mediana di `data_fine_cantiere − data_firma` |
| **Giorni medi di blocco e motivo prevalente** | media di `giorni_blocco`, moda di `motivo_blocco` |
| Rilavorazione informativa | media di `n_richiami_dati_mancanti` |
| Scostamento ore | Σ`ore_effettive` / Σ`ore_previste` |
| Scostamento materiali | Σ`costo_materiali_reale` / Σ`costo_materiali_previsto` |
| **Tempo di incasso** (mediana giorni) | mediana di `data_incasso_saldo − data_fattura_saldo` |
| **Ricostruibilità** | % celle `n/d` sul totale — la misura di quanto oggi l'azienda *non sa* di sé |

Usa la **mediana**, non la media, per tutti i tempi: una pratica dimenticata per due mesi sposterebbe la media e nasconderebbe il comportamento normale.

---

## Cosa aspettarsi

Tre risultati sono frequenti in aziende con questo profilo, e vale la pena saperlo prima per non interpretarli come errori di compilazione:

- **Lo speed-to-lead sarà peggiore del previsto**, perché la percezione registra le risposte rapide e dimentica quelle lente.
- **Molte celle di `costo_materiali_reale` e `ore_effettive` risulteranno `n/d`.** È la prova che il margine reale oggi non è calcolabile, cioè la giustificazione economica dell'intera Fase 5.
- **I giorni di blocco supereranno le attese**, e il motivo prevalente sarà quasi certamente documenti o materiali. È la conferma che la funzione di *readiness* (§6.3 del blueprint) è la priorità giusta.
