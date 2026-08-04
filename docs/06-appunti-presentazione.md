# Appunti per la presentazione in azienda

**Per:** Federico Leporati · **Quando:** 5 agosto 2026
**Durata consigliata:** 35–45 minuti, di cui almeno 15 di dimostrazione dal vivo.

---

## 0. La cosa più importante, prima di tutto il resto

**Non presentarlo come un software finito.** Presentalo come *fondamenta costruite
e verificate, che ora vanno tarate su come lavorate voi*.

Non è modestia: è strategia, ed è anche vero.

- Se lo presenti come finito, ogni cosa che non fa diventa un difetto.
- Se lo presenti come fondamenta da tarare, ogni loro obiezione diventa un
  contributo — e **le persone difendono ciò che hanno contribuito a costruire**.
  Il rischio numero uno di questo progetto non è tecnico, è che nessuno lo usi.

La frase da tenere in tasca:

> «Il motore è costruito e funziona. Quello che vi chiedo oggi non è un giudizio
> sul software: è di dirmi dove il vostro modo di lavorare è diverso da come
> l'ho immaginato io.»

---

## 1. Apertura (3 minuti)

Apri con il problema, non con il software. E non con il problema in generale:
con **il problema come lo vivono loro**.

> «Quando aumentano richieste, sopralluoghi e cantieri, la complessità non cresce
> in modo lineare: cresce più in fretta della struttura. Il risultato è
> un'azienda più impegnata, ma non necessariamente più redditizia.»

Poi le cinque frasi che descrivono cosa succede oggi. Falle scorrere e **guarda
chi annuisce**: quella persona è il tuo alleato per il resto della riunione.

1. I lead si raffreddano, perché chi risponde è chi vede il messaggio per primo.
2. I preventivi non vengono inseguiti, perché il follow-up vive nella memoria.
3. I cantieri partono incompleti, e si fermano.
4. Il margine reale si scopre a lavori finiti, quando non è più correggibile.
5. Il titolare è il collo di bottiglia, perché è l'unico che sa lo stato di tutto.

**Poi fermati e chiedi:** «Quale di queste cinque vi pesa di più?»
La risposta ti dice su cosa insistere nei prossimi trenta minuti — e ti dà il
numero uno della priorità reale, che non è detto coincida con la tua.

---

## 2. Il sistema in una frase

> «Un unico posto dove passa tutto il ciclo: dal primo contatto al margine
> incassato. Ogni dato si inserisce una volta sola e alimenta il passaggio
> successivo.»

Se serve una seconda frase:

> «Non è un CRM. Un CRM si ferma al preventivo. Questo arriva al cantiere e al
> margine, che è dove i soldi si perdono davvero.»

---

## 3. La dimostrazione dal vivo — l'ordine che funziona

Questa è la parte che convince. **Racconta una storia sola, dall'inizio alla
fine**, invece di fare il giro delle schermate.

La storia: *Marco Rossi chiede un preventivo per un impianto da 6 kW.*

### Preparazione (10 minuti prima, non davanti a loro)

```bash
npm run demo
npm run dev
```

Poi apri `http://localhost:3000`, incolla il cookie di sessione stampato dal
comando, e **prepara le schermate in schede separate** già caricate. Non
navigare a freddo davanti a loro: il primo caricamento di ogni pagina è lento.

> **Rete di sicurezza:** fai gli screenshot di tutte le schermate stasera e
> tienili in una cartella. Se il portatile fa i capricci, la presentazione
> continua. Non c'è nulla di peggio che perdere la stanza aspettando un
> caricamento.

### Le sei tappe, con cosa dire

**1. Cruscotto** — *«Questa è la prima schermata del mattino.»*
Indica i quattro numeri in alto. Soffermati su **"Senza prossima azione: 0"**:

> «Questo numero deve essere sempre zero. Non è un obiettivo, è una regola: il
> sistema non permette che un'opportunità aperta resti senza un prossimo passo
> con una data. Se un giorno vedete un numero diverso da zero, vuol dire che
> qualcosa si è rotto — e lo vedete subito, non fra tre settimane.»

**2. Clienti → scheda Marco Rossi** — *«Tutto quello che sappiamo di lui, in un
posto solo.»*
Storico, opportunità, immobili, attività. Poi la frase che vale:

> «Se un tecnico non trova il cliente qui dentro, ricomincia a telefonare in
> giro. Per questo l'anagrafica la vedono tutti.»

**3. Opportunità → prequalifica e sopralluogo** — *«Qui si decide se vale la
pena muoversi.»*
Mostra il questionario di sopralluogo: **cambia "tipo di tetto" da falda a piano
e fai vedere che i campi cambiano**. È un effetto che si capisce all'istante.

Poi il pezzo forte: **premi "Completa sopralluogo" con dei campi vuoti.**

> «Non me lo fa chiudere. Mi dice quali dati mancano. Il motivo è semplice:
> tornare dal cliente perché manca una misura costa molto più che compilare un
> campo in più sul tetto. Ma attenzione — il salvataggio in bozza non blocca
> nulla: il lavoro fatto non si perde mai.»

**4. Preventivo** — *«E qui c'è la cosa che secondo me cambia di più.»*
Mostra le righe, poi il pannello **Marginalità** a destra.

> «Il margine si vede **mentre** si scrive il preventivo, non dopo. E se scende
> sotto la soglia che decidete voi, il preventivo non viene bloccato — parte una
> richiesta di approvazione alla direzione. La differenza è importante: non è il
> software che decide, è che la decisione diventa consapevole invece che
> accidentale.»

Poi il colpo di scena, se hai due minuti: **entra come Giulia** (il commerciale).

> «Stesso preventivo, stessa persona che lo scrive. Ma la colonna dei costi non
> c'è. Non è nascosta: non arriva proprio al suo browser. I prezzi che strappiamo
> ai fornitori restano dentro l'azienda.»

**5. La firma** — *«Adesso il cliente firma.»*
Premi "Registra la firma" e mostra cosa nasce.

> «Un clic. Contratto numerato, commessa aperta, distinta materiali presa dal
> preventivo, cinque attività assegnate, dieci documenti da raccogliere con i
> responsabili, quattro pratiche, piano pagamenti 30-40-30. Quanto tempo ci vuole
> oggi a fare tutto questo a mano?»

**Fai davvero la domanda e aspetta la risposta.** Verrà da chi apre le commesse
oggi, e sarà il numero più convincente di tutta la presentazione — perché lo
dicono loro, non tu.

**6. La commessa e il perché è ferma** — *«E questa è la schermata che secondo me
vi farà risparmiare di più.»*

> «La commessa dice: non pianificabile. E dice **perché**: mancano nove documenti,
> la pratica di connessione non è partita, il cliente non ha confermato la data.
> Per ognuno c'è chi deve agire e da quanti giorni è fermo.
>
> Oggi questa informazione esiste — ma è sparsa fra la testa di tre persone,
> WhatsApp e un raccoglitore. Il risultato è che si scopre la mattina del
> cantiere.»

Poi **spunta "verifica tecnica completata"** e fai vedere l'impedimento che
sparisce in tempo reale.

E il caricamento di un documento: carica un PDF, mostra che compare, e di':

> «Caricato non vuol dire approvato. Finché qualcuno non lo verifica resta un
> impedimento — perché la fotografia sbagliata allegata a una pratica costa più
> del tempo di controllarla.»

---

## 4. Punti di forza — cosa dire se ti chiedono «perché non un gestionale già pronto?»

È una domanda legittima e **va lasciata fare, non evitata**. Anzi: falla tu, ti
dà credibilità.

| Punto di forza | Perché conta per EcoSolare |
|---|---|
| **Copre il ciclo intero, non solo il commerciale** | I gestionali di vendita si fermano al preventivo. Il margine si perde dopo |
| **Le regole sono le vostre, non del software** | Stati, soglie, checklist, criteri di blocco: si cambiano da configurazione |
| **Il margine è protetto per costruzione** | Costo previsto e reale sono grandezze separate; i preventivi inviati si congelano |
| **I permessi sono seri** | Il commerciale non riceve i prezzi dei fornitori. Verificato, non dichiarato |
| **Tre linee di business, un cliente solo** | Fotovoltaico, elettrico e idraulico condividono anagrafica e storico |
| **Niente vincoli di fornitore** | Il codice è vostro. Nessun canone per utente che cresce con l'azienda |

E la contro-verità da dire comunque, perché ti fa guadagnare fiducia:

> «Un gestionale pronto lo accendete lunedì. Questo no. In cambio fa quello che
> serve a voi invece che quello che serve alla media dei clienti di qualcun
> altro. Se scoprissimo che il vostro processo è identico allo standard, il
> software pronto sarebbe la scelta giusta — e ve lo direi.»

---

## 5. Miglioramenti tangibili — con l'onestà che serve

**Distingui tre categorie.** Confonderle è il modo più rapido per perdere
credibilità fra sei mesi.

### A. Dimostrabili oggi, davanti a loro

| | |
|---|---|
| Apertura commessa | Da manuale a un clic, con dentro tutto |
| Margine del preventivo | Visibile mentre si scrive, non scoperto dopo |
| Sopralluoghi incompleti | Impossibile chiuderli, quindi niente ritorni dal cliente |
| Lead senza responsabile | Impossibili per costruzione |
| Perché un cantiere è fermo | Visibile con motivo, responsabile e giorni |
| Duplicati in anagrafica | Segnalati prima di crearli |

### B. Misurabili — ma **solo se facciamo la baseline adesso**

Speed-to-lead, conversione per fonte, giorni fra sopralluogo e preventivo,
giorni di blocco, scostamento fra ore previste ed effettive.

> «Questi li potremo dimostrare con i numeri. Ma solo se misuriamo il "prima"
> **adesso**: una volta che il sistema è in uso, il prima non è più
> ricostruibile. È una finestra che si chiude.»

Questa frase serve a ottenere la baseline. **È la richiesta più importante della
riunione** e va piazzata qui, non alla fine.

### C. Plausibili, ma non promettere numeri

Ore risparmiate a settimana, punti di conversione guadagnati, margine
recuperato. Sono l'obiettivo, non una promessa.

> «Non vi do percentuali che non posso ancora dimostrare. Vi do i numeri di
> partenza e fra tre mesi li rimettiamo sul tavolo.»

**Chi promette il 30% di conversione in più sta vendendo, non progettando.**

---

## 6. Cosa NON dire

- ❌ «È pronto» → **✅** «Le fondamenta sono costruite e verificate»
- ❌ «Fa tutto in automatico» → **✅** «Toglie il lavoro meccanico, le decisioni restano vostre»
- ❌ «Da lunedì lo usate» → **✅** «Prima taratura, poi una linea di business alla volta»
- ❌ Promettere una funzione durante la riunione. Rispondi **«me lo segno»** e segnatelo davvero. Ogni promessa fatta in una stanza diventa un'aspettativa che nessuno ha stimato.
- ❌ Mostrare il codice. Non interessa a nessuno e sposta la conversazione dal loro problema al tuo mestiere.

---

## 7. Le obiezioni che arriveranno, e le risposte

**«Quanto manca?»**
> «Il ciclo commerciale — dal lead al preventivo — c'è tutto. La commessa con
> documenti, materiali e pianificabilità c'è. Mancano il cantiere vero e proprio
> (ore, fogli di lavoro), il consuntivo economico e l'assistenza post-vendita.
> Su ventidue obiettivi che ci eravamo dati, dodici sono raggiunti.»

**«E se poi non lo usa nessuno?»**
> «È il rischio numero uno, più della tecnologia. Per questo non lo accendiamo
> tutto insieme: partiamo da una linea di business, con le persone che oggi
> soffrono di più il problema. E per questo vi chiedo le interviste: un sistema
> costruito addosso a come lavorate lo usate; uno costruito su come immagino io
> che lavoriate, no.»

**«Quanto costa mantenerlo?»**
> «Database e hosting circa 45–50 euro al mese. Il resto è tempo di sviluppo, che
> decidiamo fase per fase: a fine di ogni fase ci si ferma e si decide se
> proseguire.»

**«I nostri dati dove stanno?»**
> «In Unione Europea, a Francoforte. Nessuno accede senza essere stato abilitato,
> ogni modifica resta tracciata con chi l'ha fatta e quando. Prima di andare
> online servono quattro adempimenti formali che vi elenco a parte.»

**«E se ci lasci / se ti succede qualcosa?»**
> Non schivarla, è una domanda seria.
> «Il codice è vostro e sta su un repository vostro. Ogni decisione è scritta e
> motivata, ci sono duecento test automatici che dicono se qualcosa si rompe, e
> le modifiche al database sono versionate. Un altro sviluppatore ci mette giorni
> a entrare, non mesi.»

**«Perché non ChatGPT / un'AI che fa tutto?»**
> «L'AI arriva alla fine e fa tre mestieri: riassumere, precompilare, segnalare.
> Non decide. Un assistente che risponde su dati incompleti dà numeri
> verosimili e sbagliati — che in un sistema di controllo di gestione è il
> risultato peggiore possibile.»

---

## 8. Cosa chiedere prima di uscire dalla stanza

Non uscire senza queste tre cose. Scrivile alla lavagna se c'è.

**1. Cinque interviste, 45 minuti ciascuna** — titolare, commerciale, ufficio
tecnico, back-office, un installatore.
> «Non vi chiedo un'opinione sul software. Vi chiedo di raccontarmi come lavorate
> davvero, prendendo un caso concreto recente.»

Le due domande che valgono da sole metà del lavoro, dille ad alta voce così
capiscono che non è un questionario burocratico:
- All'ufficio tecnico: *«Cosa deve essere vero perché tu dica: questo cantiere si può fare?»*
- All'ufficio tecnico: *«Quali documenti servono davvero, dall'inizio alla fine?»*

**2. La baseline** — 20–30 pratiche recenti, ricostruite a mano. Mezza giornata.
> «Servono anche quelle andate male. Se misuriamo solo le riuscite, il punto di
> partenza risulta migliore del vero e fra sei mesi i miglioramenti sembreranno
> più piccoli di quelli reali.»

**3. Sei decisioni**, che non posso prendere io:
- Quale gestionale contabile usate, e se le numerazioni devono allinearsi
- Se WhatsApp verso i clienti passa da un numero aziendale ufficiale
- Se serve la firma elettronica e con quale fornitore
- Chi sarà l'amministratore del sistema
- Se documenti e pratiche li segue la stessa persona che fa fatture
- Se progettazione e coordinamento cantiere sono la stessa funzione

---

## 9. Come chiudere

> «Quello che avete visto oggi non è ancora vostro: è il modo in cui ho capito il
> vostro lavoro leggendo e ragionando. Le prossime due settimane servono a
> correggerlo dove ho sbagliato.
>
> Poi accendiamo una linea di business sola e la usiamo davvero per un mese.
> Se dopo quel mese il 100% dei contatti passa da qui, andiamo avanti. Se no,
> ci fermiamo e capiamo perché — perché un sistema costruito bene e non usato
> non vale niente.»

Ed è vero. È anche la frase che ti protegge se qualcosa non va: hai detto in
anticipo quale sarebbe stato il segnale.

---

## Promemoria pratici per stasera

- [ ] `npm run demo` e verifica che tutto si apra
- [ ] Screenshot di riserva di tutte le schermate
- [ ] Prova la sequenza della dimostrazione **almeno una volta a voce alta**, cronometrandola
- [ ] Prepara un foglio bianco per segnare le richieste che arriveranno («me lo segno» va onorato)
- [ ] Porta stampato l'elenco delle sei decisioni: consegnarlo su carta funziona meglio che dirlo
- [ ] Decidi in anticipo **quale linea di business** proporre per la partenza. Il fotovoltaico è il core: più volume, più valore, più dolore. Ma se l'elettrico ha cicli più corti, si impara più in fretta con meno rischio — valuta e arriva con una proposta, non con una domanda aperta
