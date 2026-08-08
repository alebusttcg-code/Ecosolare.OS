# KPI — come li misuriamo

**Decisione:** [D-012](01-registro-decisioni.md) — non ricostruire il passato a mano.
I numeri partono **da quando usi questo software** per ogni lead.

---

## Baseline prospettica (percorso adottato)

### Cosa significa

Non c’è un foglio Excel del «prima». La baseline è **il primo periodo in cui tutti
i lead passano dal CRM** — tipicamente i primi **30 giorni** di uso reale.

Da lì confronti:
- mese 1 vs mese 2 vs mese 3…
- oppure trimestre su trimestre

Non dimostri «prima eravamo lenti, ora siamo veloci» con dati certi del passato.
Dimostri «**nel tempo miglioriamo**» e «**oggi sappiamo sempre** tempi, conversioni,
blocchi».

### Dove vedi i KPI

Apri **Metriche commerciali** nel menu (`/metriche`).

Calcola automaticamente, per i lead **entrati** nel periodo scelto:

| KPI | Cosa misura |
|-----|-------------|
| Speed-to-lead | Ore dalla richiesta alla prima risposta registrata |
| Imbuto | Quanti passano sopralluogo → preventivo → contratto |
| Conversione | Vinti / (vinti + persi) sulla stessa coorte |
| Tempi medi | Giorni tra le tappe (mediana) |
| Ticket medio | Valore medio dei contratti firmati |
| Per fonte / commerciale / linea | Stessi numeri, suddivisi |

Finché non ci sono lead nel periodo, la pagina è vuota: **è normale**.

---

## Cosa devi fare tu (3 regole)

### 1. Ogni nuovo contatto entra nel sistema

- Form sito → endpoint intake (quando attivo)
- Oppure **Lead → Nuovo lead** a mano

Se un lead resta su WhatsApp e non lo registri, **non esiste per le metriche**.

### 2. Usa il CRM nel flusso reale

Per ogni lead, nel gestionale:

- assegna responsabile e prossima azione
- registra sopralluogo, preventivo inviato, firma
- chiudi come **perso** con motivo (non lasciare zombie)

La **prima risposta** al cliente si registra completando la prima attività di
contatto (`chiamata`, `email`, `whatsapp`, ecc.): da lì parte lo speed-to-lead.

### 3. Guarda le metriche una volta al mese

Stesso giorno ogni mese (es. primo lunedì):

1. Apri `/metriche`
2. Seleziona «Ultimi 30 giorni» o «Mese corrente»
3. Annota 3 numeri in un posto tuo (Note, email a te stesso):
   - speed-to-lead (ore)
   - conversione
   - lead ricevuti

Dopo 90 giorni avrai già un mini «prima/dopo» interno al software.

---

## Quando consideriamo la baseline «chiusa»

| Milestone | Criterio |
|----------|----------|
| **T0** | Primo lead vero registrato in produzione (data da annotare) |
| **Baseline iniziale** | 30 giorni consecutivi con ≥ 80% dei lead entrati via sistema |
| **Primo confronto utile** | Dopo almeno **60–90 giorni** e **15+ lead** nella coorte |

Annota T0 qui quando parte:

```
T0 (primo lead in produzione): ___________
Baseline 30 gg completata:     ___________
```

---

## Prova locale (test manuali + /metriche)

### Percorso consigliato

1. **Lead → Nuovo lead** — compila e salva
2. **Attività** → completa «Primo contatto» (+ prossima azione) → registra lo **speed-to-lead**
3. Dalla scheda lead: **+ Nuovo preventivo** se vuoi vedere la sezione preventivi sul lead
4. **Metriche** → periodo **Ultimi 30 giorni**

Con un solo lead i numeri sono pochi: normale. L'imbuto cresce man mano che registri sopralluogo, invio preventivo, firma.

> **Preventivi e firme** elenca tutti i preventivi dell'azienda. La **scheda lead** mostra solo quelli di *quel* lead. Se apri un lead senza preventivo, la sezione resta vuota anche se in elenco generale ne vedi altri.

### Cosa guardare in /metriche

| Sezione | Significato |
|---------|-------------|
| Lead ricevuti | Quanti contatti entrati nel periodo |
| Speed-to-lead | Ore dalla richiesta alla prima risposta |
| Imbuto | Quanti passano a sopralluogo → preventivo → contratto |
| Conversione | Vinti / (vinti + persi) — serve lead chiusi |
| Coorte non matura | Avviso se molti lead sono ancora aperti (normale all'inizio) |

---

## Cosa fa il software (non devi calcolare nulla)

- `first_response_at` sul lead → speed-to-lead
- Date su sopralluogo, preventivo inviato, contratto → tempi e imbuto
- `lost_reason` → motivi di perdita
- Readiness commessa → giorni di blocco (lato cantiere, pagina Cantieri)

Il motore è in `src/lib/domain/funnel.ts` e la pagina legge `getCoorteCommerciale`.

---

## Percorso storico (non adottato)

Ricostruire 20–30 pratiche passate da WhatsApp/email resta **opzionale**. Strumenti
se servisse in futuro:

- [`baseline-kpi-template.csv`](baseline-kpi-template.csv) — template
- [`baseline-campione.md`](baseline-campione.md) — guida compilazione
- `npm run baseline` — calcolo da CSV

Non è richiesto per andare avanti.

---

## Cosa aspettarsi

- **Prime settimane:** pochi dati, metriche instabili — normale.
- **Conversione:** serve tempo (ciclo commerciale ~30–60 gg); non giudicare la
  coorte «ultimi 30 giorni» prima che i lead maturino (`calcolaMaturita` in
  `/metriche` avvisa quando la coorte è ancora giovane).
- **Il vero beneficio subito:** sapere **adesso** quanti lead sono aperti, chi
  risponde, cosa blocca i cantieri — anche senza confronto col passato.
