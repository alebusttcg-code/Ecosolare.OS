# ADR-012 — Nessun file viene mai cancellato

**Stato:** accettata · **Data:** 11 agosto 2026

## Contesto

Fino a oggi eliminare un documento, una contabile o una fotografia di
sopralluogo faceva tre cose irreversibili: cancellava il file dall'archivio,
cancellava la riga dal database e spostava la copia su Drive nel cestino, dove
Google la elimina dopo trenta giorni. Passato quel mese, il file non esisteva
più da nessuna parte.

Le tre categorie non sono equivalenti, ma nessuna è ricostruibile a costo zero:

- un **documento** del cliente va richiesto di nuovo, e chi lo aveva già mandato
  una volta lo interpreta come disorganizzazione;
- una **contabile** è la prova di un incasso, con obbligo di conservazione;
- una **fotografia di sopralluogo** si rifà solo tornando sul tetto.

A questo si aggiungeva un punto cieco: il point-in-time recovery di Supabase
copre PostgreSQL e **non** lo Storage. Il database si riavvolge, i file no.

## Decisione

**Nessun file viene mai cancellato fisicamente.**

1. `document_files`, `payment_receipts` e `survey_files` hanno `deleted_at` e
   `deleted_by`. Eliminare significa valorizzarli: la riga resta, il file resta
   in archivio, la copia su Drive va nel cestino di Drive per non restare
   visibile in una cartella dove non dovrebbe più stare.
2. **Il cestino non ha scadenza** e non esiste alcuna procedura di svuotamento
   automatico. Il ripristino è possibile a mesi di distanza.
3. Le fotografie di sopralluogo, che finora esistevano in **copia unica**,
   vengono copiate su Drive come tutto il resto, in
   `Sopralluoghi / <codice opportunità> — <cliente>`. Non nella cartella del
   cliente, perché il sopralluogo precede il contratto e quella cartella nasce
   alla firma.
4. `npm run backup:documenti` produce una **terza copia** sul computer di chi lo
   lancia: cartelle e nomi leggibili, `inventario.csv`, verifica del checksum,
   incrementale. `npm run backup:verifica` controlla l'integrità senza scrivere.

## Motivazione

Il costo è asimmetrico, e di parecchi ordini di grandezza. Tenere per sempre un
file che nessuno voleva costa qualche centesimo di spazio all'anno. Perdere una
bolletta che il cliente aveva mandato una volta sola costa una telefonata, una
settimana di attesa, e la fiducia di chi la sta fornendo per la seconda volta.

Un cestino con scadenza è un cestino che un giorno butterà via la cosa
sbagliata, e lo farà proprio quando nessuno stava guardando. Trenta giorni sono
un tempo che sembra lungo mentre si scrive il codice e diventa corto quando ci
si accorge dell'errore a bilancio chiuso.

Sulle tre copie: archivio (Supabase), specchio (Google Drive), export locale.
Sono tre fornitori diversi e tre credenziali diverse. Perderle tutte insieme
richiede un evento che nessun backup avrebbe comunque coperto.

## Conseguenze

- **Lo spazio cresce e non decresce mai.** Va tenuto d'occhio: la sezione
  Manutenzione mostra quanto occupa il cestino. Con documenti e foto compresse
  si parla di ordini di grandezza in cui il piano Pro di Supabase (100 GB) dura
  anni, ma non è infinito.
- **Ogni lettura di questi tre tipi di file va filtrata su `deleted_at`.** È il
  costo tipico del soft delete: una query dimenticata mostra file eliminati.
  Sono stati sistemati elenchi, schede e i tre endpoint che servono i byte.
- **I numeri di versione dei documenti non si riusano** neppure dopo
  l'eliminazione: riusarli farebbe fallire il ripristino contro l'indice univoco
  `(requisito, versione)`.
- **Il ripristino è riservato all'amministratore** (`update` su `settings`), con
  riga di audit. Chi ha eliminato per sbaglio chiede; non si ripristina da sé.
- **L'export locale va lanciato da una persona.** Non è automatico e non lo
  diventerà finché non esiste un secondo fornitore di object storage
  configurato: automatizzare una copia che finisce sullo stesso computer di
  sviluppo darebbe una falsa sensazione di sicurezza.

## Alternative scartate

**Cestino a 30 giorni con svuotamento automatico** — è la scelta convenzionale,
ed è convenzionale perché lo spazio costava. Qui non costa abbastanza da
giustificare il rischio.

**Copia automatica notturna su un secondo fornitore (Backblaze, S3)** — è la
soluzione tecnicamente migliore e resta il passo successivo. Richiede un account
e credenziali nuove: rimandata, non scartata.
