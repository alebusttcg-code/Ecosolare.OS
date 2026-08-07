# ADR-011 — Google Drive è uno specchio, non l'archivio

**Stato:** accettata · **Data:** 7 agosto 2026

## Contesto

Quando un lead diventa cliente — cioè alla firma del contratto — deve nascere
automaticamente una cartella su Google Drive dove finiscono i suoi documenti.
Le persone dell'azienda vivono già dentro Drive: chiedere loro di aprire il
gestionale per vedere un PDF significherebbe che continueranno a tenere una
copia parallela in Drive, fatta a mano, ed è quella copia che diventerebbe la
verità.

Le due strade possibili erano:

1. **Drive come archivio unico.** I file esistono solo lì, nel database resta l'id.
2. **Supabase Storage come archivio, Drive come copia.**

## Decisione

**Supabase Storage è l'archivio; Drive è una copia**, prodotta dopo, in coda.

- L'applicazione carica su Supabase Storage (bucket privato) e serve i file solo
  attraverso `/api/documenti/[id]`, che applica `guard` prima dei byte.
- Alla firma del contratto e a ogni caricamento viene scritto un evento
  nell'outbox (ADR-005), nella stessa transazione del fatto che lo giustifica.
- Un worker crea la cartella e copia il file. `document_files.drive_file_id`
  registra l'esito; nullo significa «non ancora copiato».

Struttura su Drive: `Drive condiviso / <Cliente> / <COM-anno-nnnn — titolo>`.

## Motivazione

**Nessuna operazione dell'utente deve dipendere da Drive.** Con Drive come
archivio unico, un guasto o una quota esaurita di Google impedirebbe di firmare
un contratto e di caricare un documento. Con lo specchio, un guasto ritarda una
copia: l'unica conseguenza è una cartella che si popola più tardi.

**Il controllo degli accessi resta nostro.** I permessi di questo sistema sono
per ruolo e per capacità (ADR-006), e non hanno corrispondenza nei permessi di
Drive. Se Drive fosse l'archivio, l'unico modo di far vedere un documento a una
persona sarebbe condividerglielo su Drive — e da quel momento la
condivisione sopravvive alla revoca del permesso nel gestionale, senza che
nessuno se ne accorga.

**Le quote API di Drive non diventano un limite operativo.** Un caricamento
massivo di foto di cantiere si scontrerebbe con i limiti per utente di Google
proprio nel momento di maggiore attività.

## Conseguenze

- **Due copie da pagare e due copie che possono divergere.** Se qualcuno
  modifica o cancella un file direttamente su Drive, il gestionale non se ne
  accorge: la copia su Drive è di sola lettura *per contratto*, non per
  imposizione tecnica. Va detto alle persone, perché la tentazione c'è.
- **Serve un Drive condiviso** e quindi Google Workspace: un service account non
  ha spazio proprio e non può possedere file in un «Il mio Drive».
- **La cartella compare con qualche minuto di ritardo** rispetto alla firma. È il
  prezzo dell'asincronia, e l'interfaccia non deve promettere il contrario.
- Un evento che fallisce dopo tutti i tentativi resta `fallito` nell'outbox:
  serve un modo per accorgersene, oggi assente. È il debito principale di
  questa decisione.

## Alternative scartate

**Drive come archivio unico** — scartata per i tre motivi sopra. Riconsiderabile
solo se si rinunciasse ai permessi per capacità, che è il cuore del sistema.

**Nessuna copia, solo la cartella creata vuota** — risolveva metà del problema
lasciando alle persone il lavoro manuale che il sistema esiste per togliere.
