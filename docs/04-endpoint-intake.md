# Endpoint di intake lead

Da usare per collegare i form del sito, le landing page e gli strumenti che
inviano lead (Typeform, Google Forms via Zapier/Make, campagne).

```
POST /api/intake
Content-Type: application/json
x-intake-token: <valore di INTAKE_TOKEN>
```

Se `INTAKE_TOKEN` non è configurato, l'endpoint risponde **503**: meglio disattivo
che aperto a chiunque.

---

## Corpo della richiesta

Non serve riconfigurare i form perché parlino la lingua del gestionale: è il
gestionale che si adatta ai nomi di campo più comuni.

| Dato | Nomi accettati |
|---|---|
| Nome | `nome`, `name`, `first_name`, `firstname`, `firstName` |
| Cognome | `cognome`, `surname`, `last_name`, `lastname`, `lastName` |
| Nome completo | `nome_completo`, `full_name`, `fullname`, `nominativo` |
| Email | `email`, `e-mail`, `mail`, `indirizzo_email` |
| Telefono | `telefono`, `phone`, `tel`, `cellulare`, `mobile`, `numero` |
| Messaggio | `messaggio`, `message`, `note`, `richiesta`, `descrizione` |
| Comune | `comune`, `citta`, `city`, `localita` |
| Indirizzo | `indirizzo`, `address`, `via` |
| Servizio | `linea`, `servizio`, `service`, `tipo_intervento` |
| Fonte | `fonte`, `source`, `origine` |
| ID esterno | `id`, `external_id`, `submission_id`, `entry_id`, `lead_id` |

I campi non riconosciuti (`utm_*`, campi personalizzati) non causano errori e
restano comunque salvati nel payload grezzo.

**Requisiti minimi:** un nominativo e almeno un recapito valido (email o telefono
normalizzabile). Senza recapito il lead non è contattabile, quindi non è un lead.

### Esempio

```bash
curl -X POST https://<dominio>/api/intake \
  -H "Content-Type: application/json" \
  -H "x-intake-token: $INTAKE_TOKEN" \
  -d '{
    "nome": "Mario",
    "cognome": "Rossi",
    "telefono": "333 123 4567",
    "email": "mario.rossi@example.it",
    "comune": "La Spezia",
    "messaggio": "Vorrei un preventivo per un impianto fotovoltaico con accumulo",
    "fonte": "sito",
    "submission_id": "form-2026-0042"
  }'
```

---

## Risposte

| Codice | Esito | Significato |
|---|---|---|
| **201** | `creato` | Contatto e opportunità creati, prima azione assegnata |
| **200** | `gia_ricevuto` | Stesso `submission_id` già ricevuto: nulla di nuovo creato |
| **202** | `ricevuto_non_interpretabile` | Payload salvato ma non trasformabile in lead (manca nominativo o recapito) |
| **202** | `ricevuto_non_assegnato` | Nessun utente attivo a cui assegnarlo |
| **401** | — | Token mancante o errato |
| **429** | — | Troppe richieste: vedere *Limiti di frequenza* |
| **503** | — | `INTAKE_TOKEN` non configurato |

La risposta **non restituisce mai dati di contatto**: conferma solo la ricezione.

### Perché 202 e non 400 sui payload non interpretabili

Un 4xx innesca i rinvii automatici di alcuni strumenti e, soprattutto, suggerisce
che il dato sia stato rifiutato. **Non lo è mai:** il payload grezzo viene salvato
in `inbound_submissions` *prima* di qualunque interpretazione, con il motivo del
mancato trattamento. Nessun lead si perde — è esattamente il problema che il
sistema deve eliminare.

---

## Comportamenti da conoscere

**Idempotenza.** Se il form invia `submission_id` (o uno degli altri nomi per
l'ID esterno), un secondo invio identico restituisce 200 senza creare nulla. **Si
raccomanda vivamente di popolarlo:** senza, due click sul pulsante di invio
generano due opportunità.

**Riconoscimento del cliente esistente.** Se il telefono, l'email o il codice
fiscale coincidono *esattamente* con un contatto già in archivio, la nuova
richiesta viene collegata a quel contatto invece di creare una seconda anagrafica.
Non è una fusione automatica — due record esistenti non vengono mai uniti — ma il
riconoscimento di un identificativo univoco. Le somiglianze deboli (stesso nome e
comune) creano un contatto nuovo e vengono **segnalate** per revisione umana.

**Assegnazione.** Regola provvisoria in attesa dell'audit (B4): si usa la
configurazione `intake.proprietario_default_email`, altrimenti il primo
commerciale attivo, altrimenti un amministratore. Le regole reali — per zona,
turno o linea di business — vanno definite con l'azienda.

**Linea di business.** Dedotta dal testo del messaggio e dal campo servizio;
in assenza di indizi si assume fotovoltaico, che è il core business. Sempre
correggibile dal commerciale.

---

## Limiti di frequenza

Il token da solo non basta. È condiviso con integrazioni che non controlliamo, e
se una di quelle lo espone nessuno se ne accorge: i limiti servono perché un
token uscito costi volume, non il database.

| Contatore | Soglia | Che cosa ferma |
|---|---|---|
| Per indirizzo | 20 all'ora | Un singolo mittente che apre il rubinetto |
| Complessivo | 200 all'ora | Lo stesso, distribuito su molti indirizzi |
| Token errato | 10 all'ora per indirizzo | Chi il token lo sta cercando |

Oltre la soglia si riceve **429** con l'intestazione `Retry-After` in secondi e
un corpo `{"errore": "…", "riprovaTra": <secondi>}`. Il client corretto aspetta e
riprova: non è un rifiuto definitivo.

Tre cose che vale la pena sapere:

- **Le soglie sono larghe di proposito.** Il primo obbligo dell'endpoint è non
  perdere un lead: un modulo che ritenta tre volte non è un attacco. Duecento
  lead in un'ora sarebbero un record aziendale storico.
- **Il contatore complessivo non dipende da nessuna intestazione.** L'indirizzo
  del chiamante si legge da `x-forwarded-for` e simili, che il client può
  scrivere come vuole: serve a *distribuire* il limite, non a garantirlo.
- **La finestra è scorrevole.** Una finestra fissa lascerebbe passare il doppio
  della soglia a cavallo fra due intervalli, che è il momento che un attaccante
  sceglie.

I tentativi con token errato che superano la soglia finiscono nell'audit log: è
il solo modo per accorgersi che qualcuno sta cercando il segreto.

---

## Cosa manca ancora

- **Dove vive il token.** Il limite di frequenza c'è (sopra), ma protegge dal
  volume, non dalla fuga del segreto: se il modulo del sito chiama l'endpoint
  da JavaScript nel browser, il token è leggibile da chiunque apra il sorgente
  della pagina. Va verificato integrazione per integrazione, e dove serve la
  chiamata va spostata su una funzione server del sito.
- **Notifica immediata al proprietario.** Oggi il lead compare fra le attività;
  l'avviso in tempo reale (email o WhatsApp) arriva con il motore di automazione
  della Fase 2, che è ciò che rende davvero raggiungibile il target di
  speed-to-lead.
