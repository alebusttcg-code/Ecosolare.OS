# ADR-013 — Verifica in due passaggi con TOTP, obbligatoria dove serve

**Stato:** superata · **Data:** 11 agosto 2026 · **Superata il:** 11 agosto 2026

> **Superata:** l’accesso torna a email + password senza secondo fattore
> (frizione operativa). Vedi D-018 revocata nel registro decisioni. Le colonne
> `totp_*` restano nello schema inutilizzate.
>
> **Esclusa in via definitiva (13 agosto 2026).** Il secondo fattore non
> tornerà: rimosso il codice che era rimasto orfano dopo la supersessione —
> la pagina `/due-passaggi`, le server action `*Mfa`, i moduli `auth/totp`,
> `auth/mfa`, `auth/cifratura` e la variabile `MFA_SECRET_KEY`. Le colonne
> `totp_*` restano nello schema (rimuoverle richiede una migrazione dedicata e
> non porta valore): sono inerti, nessuno le legge più.

## Contesto

Il blueprint §14 richiede la verifica in due passaggi. Con il login Google la
delegavamo a Workspace ([D-003a](../01-registro-decisioni.md)); passando a email
e password è sparita, e da allora una sola password apriva costi, margini e
anagrafiche complete.

## Decisione

**TOTP (RFC 6238)**, implementato con `node:crypto`, obbligatorio per
`amministratore` e `contabilita`, disponibile a tutti gli altri.

1. **Nessuna dipendenza.** L'algoritmo è un HMAC-SHA1 su un contatore: quindici
   righe. Il modulo è puro e provato contro i vettori ufficiali dell'RFC.
2. **Il segreto è cifrato a riposo** con AES-256-GCM e una chiave che sta
   nell'ambiente (`MFA_SECRET_KEY`), non nel database.
3. **Un codice non si accetta due volte**: si conserva l'ultimo passo temporale
   consumato.
4. **Dieci codici di recupero**, mostrati una volta, conservati come impronte
   SHA-256 e usa e getta.
5. **Nessuno stato «mezzo autenticato»**: se il secondo fattore è attivo, la
   sessione non si apre finché non arrivano password e codice *insieme*.

## Motivazione

**Cifrare il segreto** è ciò che rende l'MFA un secondo fattore anche davanti a
una copia del database. A differenza di una password non può essere conservato
come impronta — per verificare un codice va ricalcolato — quindi in chiaro
sarebbe sufficiente un dump per generare i codici di chiunque.

**Obbligatoria solo per due ruoli.** Imporla all'installatore che entra dal
telefono in cantiere, con la rete che va e viene, produce persone che smettono
di usare il sistema — e un sistema che non si usa non protegge niente. Si impone
dove una password rubata apre davvero qualcosa.

**Password e codice insieme** costa una seconda verifica scrypt (~100 ms) ed
elimina l'intera categoria di errori legata agli stati intermedi: niente token
temporanei da firmare, far scadere e revocare.

## Conseguenze

- **Senza `MFA_SECRET_KEY` l'MFA non si attiva**, e quindi amministratori e
  contabilità **non entrano**. È una variabile in più da non dimenticare al
  deploy; `npm run configura` la genera.
- **Se la chiave si perde**, i segreti diventano illeggibili: si entra con i
  codici di recupero, che non dipendono dalla chiave apposta, e si riconfigura
  l'app. Non è una perdita di accesso, è un pomeriggio scomodo.
- **Niente QR.** Si mostra il segreto in base32 a gruppi di quattro e un
  collegamento `otpauth://` toccabile da telefono. Un generatore di QR sarebbe
  circa duecentocinquanta righe o una dipendenza: rimandato, non escluso.
- Un amministratore può azzerare l'MFA di un altro utente (chiudendogli tutte le
  sessioni). Non la propria: azzerarsi da soli vanificherebbe l'obbligo.
- Un codice sbagliato conta come tentativo fallito e alimenta il blocco
  progressivo: senza, il secondo fattore sarebbe attaccabile all'infinito da chi
  conosce già la password.

## Alternative scartate

**WebAuthn / passkey** — più sicuro e più comodo, ma richiede dispositivi
compatibili e un percorso di recupero più complesso. Da riprendere quando l'MFA
sarà un'abitudine acquisita.

**SMS** — costa, dipende da un fornitore e non protegge dallo scambio di SIM.
