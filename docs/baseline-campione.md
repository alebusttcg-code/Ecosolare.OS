# Baseline KPI — lista campione (percorso opzionale)

> **Non adottato** — vedi [D-012](01-registro-decisioni.md) e
> [03-baseline-kpi.md](03-baseline-kpi.md): i KPI si misurano da adesso con
> Dashboard → Performance commerciale, non ricostruendo il passato a mano.
>
> Questo file resta solo se in futuro volessi compilare un campione storico.

---

## Mix target (25 pratiche)

| Tipo | Obiettivo | Compilate | Mancano |
|------|-----------|-----------|---------|
| Vinte e concluse | 10–12 | | |
| Perse | 8–10 | | |
| Problematiche / bloccate a lungo | 3–5 | | |
| **Totale** | **25** | | |

Periodo: **ultimi 6–12 mesi**. Non prendere solo i successi.

---

## Lista pratiche da ricostruire

Compila la colonna «Cliente / riferimento» e segna l'esito atteso. Poi apri le fonti (WhatsApp, email, Calendar) per quella riga nel CSV.

| # | Cliente / riferimento | Linea (fv/elettrico/idraulico) | Esito atteso | Fonte lead | Note rapide |
|---|------------------------|----------------------------------|--------------|------------|-------------|
| 01 | | | vinto / perso / problematica | | |
| 02 | | | | | |
| 03 | | | | | |
| 04 | | | | | |
| 05 | | | | | |
| 06 | | | | | |
| 07 | | | | | |
| 08 | | | | | |
| 09 | | | | | |
| 10 | | | | | |
| 11 | | | | | |
| 12 | | | | | |
| 13 | | | | | |
| 14 | | | | | |
| 15 | | | | | |
| 16 | | | | | |
| 17 | | | | | |
| 18 | | | | | |
| 19 | | | | | |
| 20 | | | | | |
| 21 | | | | | |
| 22 | | | | | |
| 23 | | | | | |
| 24 | | | | | |
| 25 | | | | | |

---

## Ordine di compilazione (per riga)

Compila in questo ordine: se ti blocchi, passa alla riga successiva e metti `n/d`.

### Blocco A — commerciale (obbligatorio per tutte)

1. `id`, `linea`, `fonte`, `esito`
2. `data_primo_contatto`, `data_prima_risposta` → **speed-to-lead**
3. `data_appuntamento_fissato`, `data_sopralluogo`, `data_invio_preventivo`
4. `n_versioni_preventivo`, `n_richiami_dati_mancanti`, `valore_preventivo`
5. Se persa: `motivo_perdita`

### Blocco B — solo vinte / problematiche con cantiere

6. `data_firma`, `data_inizio_cantiere`, `data_fine_cantiere`
7. `giorni_blocco`, `motivo_blocco`
8. `ore_previste`, `ore_effettive`, `costo_materiali_previsto`, `costo_materiali_reale`
9. `data_fattura_saldo`, `data_incasso_saldo`

---

## Dove cercare ogni dato

| Dato | Prima fonte | Alternativa |
|------|-------------|-------------|
| Primo contatto | WhatsApp / email più vecchia | Modulo sito, chiamata persa |
| Prima risposta | Prima risposta **tua** al cliente | Non «visto», risposta vera |
| Appuntamento / sopralluogo | Google Calendar | WhatsApp «ci vediamo martedì» |
| Invio preventivo | Email con allegato PDF | Data file in cartella Drive |
| Firma | Contratto firmato / accettazione scritta | Email «ok procediamo» |
| Cantiere | Fogli di lavoro, foto cantiere | Calendar squadra |
| Materiali reali | Fatture fornitore | Bolle DDT |
| Incasso | Contabilità / estratto | Fattura + bonifico |

---

## Controllo avanzamento

Dopo ogni sessione (anche con pochissime righe compilate):

```bash
npm run baseline:stato
```

Quando hai almeno 15 righe con blocco A completo:

```bash
npm run baseline
```

Per salvare i risultati in `docs/03-baseline-kpi.md`:

```bash
npm run baseline -- --salva
```

---

## Valori ammessi

| Colonna | Valori |
|---------|--------|
| `linea` | `fv`, `elettrico`, `idraulico` (o `fotovoltaico` — normalizzato dallo script) |
| `esito` | `vinto`, `perso`, `aperto` |
| Date | `YYYY-MM-DD` oppure `n/d` |
| Numeri | cifre o `n/d` |
