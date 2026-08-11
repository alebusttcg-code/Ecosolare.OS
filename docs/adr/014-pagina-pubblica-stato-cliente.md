# ADR-014 — Pagina di stato per il cliente, senza account

**Stato:** accettata · **Data:** 11 agosto 2026

## Contesto

Dopo la firma il cliente non ha nessun modo di sapere a che punto è il suo
impianto, quindi telefona. Ogni telefonata costa dieci minuti a una persona che
dovrebbe vendere, e la risposta è quasi sempre la stessa: *stiamo aspettando un
documento tuo*. È il costo nascosto più grande del ciclo, perché non compare da
nessuna parte e consuma proprio le persone più costose.

## Decisione

**Una pagina pubblica per commessa, raggiungibile con un collegamento firmato,
senza account e senza password.**

- Il token è di 32 byte; nel database resta solo la sua impronta SHA-256, come
  per le sessioni. Si vede una volta sola, al momento della generazione.
- Revocabile, e **senza scadenza**: una commessa dura mesi, e un collegamento
  scaduto è una telefonata in più, non in meno.
- La pagina è `noindex`, `force-dynamic`, e conta le aperture — così si sa se il
  cliente lo sta usando davvero.
- Mostra: fase corrente su cinque, cosa sta succedendo, **i documenti che
  aspettiamo da lui**, la data di installazione se fissata, il nome del referente.
- Non mostra: nessun importo, nessun costo, nessuno stato di pagamento, nessuna
  nota interna, nessun fornitore.

Gli stati interni (diciotto) sono tradotti in cinque fasi da un modulo puro,
`src/lib/domain/stato-cliente.ts`, provato contro l'elenco reale degli stati.

## Motivazione

**Il collegamento è la credenziale**, quindi il contenuto va scelto pensando che
possa leggerlo chiunque: è la ragione per cui la query è una lista chiusa di
campi e non un `select()`. Un giorno quel link finirà in una chat di gruppo.

**Cinque fasi e non diciotto.** Gli stati interni sono scritti per chi lavora e
dicono cosa stiamo facendo noi; al cliente serve sapere a che punto è il *suo*
impianto e se deve fare qualcosa. Diciotto pallini in fila comunicano soltanto
lentezza.

**I documenti mancanti vengono prima di tutto il resto**, anche della fase: sono
l'unica riga su cui il cliente può agire, ed è il motivo per cui i lavori sono
fermi nella maggior parte dei casi.

## Conseguenze

- **Chi ha il collegamento vede la pagina.** Non sappiamo chi sia davvero: se il
  cliente lo inoltra, l'ha condiviso lui. Per questo non c'è dentro niente di
  economico, e la pagina lo dice in fondo.
- **Sola lettura.** Il cliente non può caricare documenti da qui: sarebbe la
  funzione più utile e apre una superficie di abuso su un endpoint pubblico. È
  il passo successivo naturale, e va progettato a parte.
- **Nessun invio automatico.** Il collegamento si genera e si manda a mano. Un
  invio automatico all'apertura della commessa richiede l'email del cliente
  verificata e un modello di messaggio: entrambi mancano.
- Una traduzione dimenticata farebbe dire al cliente una cosa falsa proprio
  quando l'impianto è quasi finito: il test verifica che **ogni** stato interno
  esistente sia mappato, e che la progressione non torni mai indietro.

## Alternative scartate

**Portale con account per il cliente** — richiede registrazione, password
dimenticate, assistenza. Per una pagina che si consulta cinque volte in tre mesi
è sproporzionato, e l'attrito ridurrebbe l'uso proprio a zero.

**Aggiornamenti solo via email a ogni cambio di stato** — utile, ma diciotto
email in tre mesi diventano rumore. Meglio una pagina che si consulta quando si
vuole; le notifiche si aggiungono sopra, per i pochi eventi che contano.
