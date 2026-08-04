# Sprint 0 — Guida alle interviste operative

**Obiettivo:** ricostruire il processo AS-IS reale, non quello dichiarato.
**Durata:** 45–60 minuti per intervista, 5 interviste.
**Referente:** Federico Leporati.

---

## Metodo — leggere prima della prima intervista

Cinque regole che determinano se queste interviste producono dati o chiacchiere.

**1. Non chiedere "come funziona il processo". Chiedi di raccontare l'ultimo caso concreto.**
Alla domanda astratta le persone descrivono il processo *come dovrebbe essere*, in buona fede. Alla domanda "prendi l'ultimo preventivo che hai fatto e raccontami tutto quello che hai fatto, in ordine" descrivono quello che è successo davvero. La differenza fra le due risposte è esattamente il problema che il software deve risolvere.

**2. Dopo ogni passaggio, chiedi due cose: "quanto tempo ci hai messo?" e "e quando invece va storto?"**
Il tempo serve alla baseline. Le eccezioni sono dove si nasconde il lavoro vero: un processo che funziona nell'80% dei casi ma richiede tre telefonate nel restante 20% è un processo che costa moltissimo.

**3. Chiedi sempre dove si trova fisicamente il dato.**
"E quel numero dove lo scrivi?" — WhatsApp, un blocco, un Excel sul desktop, la memoria. Serve all'inventario dati (T2) e ti dirà quante fonti dovrai spegnere.

**4. Non promettere funzionalità durante l'intervista.**
La tentazione è fortissima ("tranquillo, il software lo farà in automatico"). Ogni promessa fatta in intervista diventa un'aspettativa che nessuno ha stimato. Rispondi: "me lo segno".

**5. Chi si lamenta di più è il tuo miglior alleato.**
Chi ha un problema sentito è chi userà il sistema per primo e lo difenderà con i colleghi. Chi dice che va tutto bene è il rischio di adozione.

> **Nota se il titolare sei tu:** fai comunque l'esercizio **per iscritto**. Rispondere a voce a se stessi non produce dati utilizzabili e salta esattamente i passaggi che dai per scontati perché li fai da anni.

---

## Intervista A — Titolare / Direzione

*Cosa sblocca: A2, A3, B2, B6, priorità.*

**Volumi (numeri, anche approssimativi)**
1. Quanti contatti nuovi arrivano in un mese? E in alta stagione?
2. Quanti preventivi si fanno in un mese? Quanti diventano contratti?
3. Quante commesse si chiudono in un anno, divise per fotovoltaico / elettrico / idraulico?
4. Qual è il valore medio di una commessa fotovoltaica? E di un intervento elettrico o idraulico?
5. Quante persone lavorano in azienda e chi fa cosa? Quanti sono sul campo?

**Dove fa male**
6. Nell'ultimo mese, quante volte ti hanno interrotto per chiederti un'informazione che era solo nella tua testa?
7. Qual è l'ultima cosa che è andata storta e che si poteva evitare? Raccontamela per intero.
8. Se domani mattina potessi sapere una sola cosa senza chiederla a nessuno, quale sarebbe?
9. Ti è mai capitato di scoprire a lavori finiti che una commessa aveva marginato molto meno del previsto? Quanto spesso? Come lo hai scoperto?

**Decisioni**
10. Chi approva uno sconto o un preventivo con margine basso? C'è una soglia scritta o si decide caso per caso?
11. La soglia è la stessa per fotovoltaico, elettrico e idraulico? *(→ B6)*
12. Se il sistema tra sei mesi facesse una cosa sola bene, quale deve essere?

---

## Intervista B — Commerciale

*Cosa sblocca: B4, B5, B7 (parte commerciale), B16, speed-to-lead.*

**Il flusso reale**
1. Prendi l'ultimo lead arrivato: dove è arrivato, chi l'ha visto per primo, quanto tempo è passato prima che qualcuno rispondesse?
2. Da dove arrivano i contatti, in ordine di quantità? E in ordine di qualità?
3. Come capisci se un contatto vale il tuo tempo? Quali domande fai per prime?
4. Quante volte succede che vai a fare un sopralluogo e scopri che non era il caso? Cosa avresti dovuto sapere prima?
5. **Il sopralluogo commerciale e quello tecnico sono la stessa visita o due?** *(→ B5, blocca il modello dati)*

**Il preventivo**
6. Dopo il sopralluogo, quanto tempo passa prima che il preventivo parta? Cosa lo rallenta?
7. Come lo costruisci: da zero, da un modello, copiando l'ultimo simile?
8. I prezzi dei materiali dove li prendi? Sono aggiornati? *(→ B11)*
9. Sai quanto margine sta facendo quel preventivo mentre lo stai scrivendo, o lo scopri dopo?

**Il follow-up**
10. Dopo aver inviato un preventivo, cosa fai? Chi ti ricorda di richiamare?
11. Quanti preventivi inviati negli ultimi tre mesi non hanno mai ricevuto una risposta né un tuo richiamo?
12. Quando perdi, sai perché? Lo scrivi da qualche parte?

**Strumenti**
13. Fammi vedere dove tieni le informazioni sui clienti in questo momento. *(chiedi di aprirlo davvero)*
14. Il sito e le landing sono sotto il nostro controllo? Chi le gestisce? *(→ B16)*

---

## Intervista C — Ufficio tecnico

*Cosa sblocca: B5, B9, B10, B7 (parte tecnica), validazione assorbimento ruolo.*

1. Quando ricevi un sopralluogo fatto da un commerciale, quante volte devi ricontattare il cliente perché manca un dato? Quali dati mancano più spesso?
2. Elenchiamo insieme tutto quello che serve **sapere** e **fotografare** in un sopralluogo fotovoltaico perché tu possa progettare senza richiamare nessuno. *(questa lista diventa la checklist del sistema — è il deliverable più prezioso dell'intera intervista)*
3. Quali di questi dati sono davvero bloccanti e quali sono un "bene averlo"?
4. **Quali documenti servono per una commessa fotovoltaica standard, dall'inizio alla fine?** Chi li raccoglie, chi li verifica, quali scadono? *(→ B9)*
5. Quali pratiche fai tu e quali passano a un consulente esterno? *(→ B10)*
6. Per ogni pratica: quanto tempo richiede, da cosa dipende, cosa la blocca più spesso?
7. **Cosa deve essere vero perché tu dica "questo cantiere si può fare"?** Elenca tutto, anche le cose ovvie. *(→ B7, è la funzione centrale del sistema)*
8. Quante volte un cantiere è partito e si è fermato? Per cosa?
9. *(validazione ruolo)* Il lavoro di progettazione e quello di coordinamento cantiere li fanno le stesse persone o sono funzioni separate?

---

## Intervista D — Back-office / Contabilità

*Cosa sblocca: A6, B8, B9, B13, validazione assorbimento ruolo.*

1. Raccontami cosa succede da quando un cliente firma a quando la commessa è aperta e operativa. Ogni passaggio.
2. Quanto tempo ti porta via aprire una commessa nuova? Cosa copi a mano da dove?
3. Come insegui i documenti mancanti? Come sai a chi hai già chiesto cosa?
4. Dove sono oggi i dati dei clienti e in che formato? Si possono esportare? *(→ B8)*
5. Che software si usa per fatture e contabilità? Fatturiamo noi o lo studio? *(→ B13)*
6. Le numerazioni di preventivi e contratti devono seguire quelle della contabilità? *(→ D-004, va saputo prima della Fase 2)*
7. Come si sa se un cliente ha pagato l'acconto? Chi lo controlla e quando?
8. Quanti solleciti fai in una settimana e come tieni traccia di quelli già fatti?
9. *(validazione ruolo)* Chi gestisce i documenti e le pratiche è la stessa persona che gestisce fatture e pagamenti?

---

## Intervista E — Installatore / Tecnico di campo

*Cosa sblocca: A13, B20, adozione della PWA (Fase 4).*

Questa è l'intervista che più spesso viene saltata ed è quella che decide se la Fase 4 verrà adottata o aggirata.

1. La mattina, come sai dove devi andare e cosa devi fare? Chi te lo dice e quando?
2. Quante volte in una settimana devi telefonare per avere un'informazione che avresti dovuto avere?
3. Quante volte arrivi sul posto e manca qualcosa — materiale, un documento, il cliente?
4. Come segni le ore oggi? E i materiali usati?
5. Il foglio di lavoro: su cosa lo scrivi, quando, e che fine fa?
6. Le foto di cantiere: le fai? Dove finiscono?
7. Se dovessi fare tutto questo dal telefono, cosa ti farebbe smettere di usarlo dopo due giorni?
8. Che telefono usi, è tuo o aziendale, e in cantiere prende? *(→ A8, R8)*
9. Quando trovi qualcosa da fare in più a casa del cliente — un quadro da adeguare, una richiesta — a chi lo dici oggi?

---

## Le due domande che decidono la struttura dei ruoli

Vanno poste esplicitamente, perché da esse dipende se servono 4 ruoli o 5 (§11.5 del blueprint, +2–3 giornate ciascuno).

1. **Documenti/pratiche e fatture/pagamenti sono presidiati dalla stessa persona?**
   Sì → `contabilita` assorbe il back-office (modello attuale). No → serve un ruolo `backoffice`.
2. **Progettazione e coordinamento cantiere sono la stessa funzione?**
   Sì → `cantiere` assorbe l'ufficio tecnico (modello attuale). No → serve un ruolo `tecnico`.

---

## Materiali da raccogliere (T5)

Da chiedere durante o subito dopo le interviste. Senza questi si costruisce su ipotesi.

- [ ] 3 preventivi reali recenti: uno vinto, uno perso, uno complesso
- [ ] Il contratto tipo attualmente usato
- [ ] Il listino materiali, in qualunque forma esista (anche un Excel disordinato)
- [ ] La checklist documenti per una pratica fotovoltaica, se esiste in forma scritta
- [ ] Un foglio di lavoro di cantiere compilato
- [ ] Export dell'anagrafica clienti dallo strumento attuale
- [ ] Testo dell'informativa privacy attualmente in uso sul sito, se esiste
- [ ] 2–3 esempi di comunicazione tipo inviata ai clienti (email o WhatsApp)

---

## Dopo ogni intervista — 15 minuti, subito

Fatto a freddo il giorno dopo, si perde il 40% del contenuto.

1. Trascrivi i **numeri** detti (tempi, quantità, importi) — vanno nella baseline.
2. Segna gli **strumenti** nominati e cosa contengono — vanno nell'inventario dati.
3. Segna i **punti di rottura**: dove il lavoro si ferma, si duplica o dipende da una persona sola.
4. Segna le **promesse implicite** che hai dovuto trattenerti dal fare: sono richieste di funzionalità, vanno nel backlog di una fase futura, non dell'MVP.
5. Segna cosa ti ha **sorpreso**. È lì che il processo reale diverge da quello che credevi.
