/**
 * Limitazione di frequenza degli endpoint pubblici — la parte che decide.
 *
 * Modulo puro: nessun database, nessuna dipendenza da Next. Le soglie e la
 * matematica della finestra stanno qui perché sono la parte che si sbaglia, e
 * perché una difesa che nessuno può verificare non è una difesa.
 *
 * **Finestra scorrevole approssimata.** Una finestra fissa («cento richieste
 * ogni cinque minuti») lascia passare duecento richieste a cavallo fra due
 * finestre: cento nell'ultimo istante della prima, cento nel primo della
 * seconda. È il momento che un attaccante sceglie, non un caso limite teorico.
 * Qui si tiene anche il conteggio della finestra precedente e lo si pesa per
 * la frazione ancora coperta: il conto scende in modo continuo invece di
 * azzerarsi di colpo. Costa una colonna e due moltiplicazioni.
 */

export interface Finestra {
  /** Quante richieste sono consentite nella finestra. */
  readonly massimo: number
  /** Ampiezza della finestra, in millisecondi. */
  readonly durataMs: number
}

export interface StatoContatore {
  readonly windowStart: Date
  readonly count: number
  readonly previousCount: number
}

export interface EsitoLimite {
  readonly consentito: boolean
  /** Stima scorrevole delle richieste nella finestra, arrotondata per eccesso. */
  readonly usate: number
  /** Secondi da aspettare prima di riprovare. Zero quando è consentito. */
  readonly riprovaTraSecondi: number
}

/* -------------------------------------------------------------------------- */
/*  Soglie di /api/intake                                                      */
/* -------------------------------------------------------------------------- */

/*
 * Le soglie sono generose di proposito. Il primo obbligo di questo endpoint è
 * scritto nel suo stesso commento — «non perdere mai un lead» — e un limite che
 * scatta su un picco vero costa più di quello che protegge: un modulo del sito
 * che ritenta tre volte non è un attacco, è un modulo del sito.
 *
 * Quello che devono fermare è l'altro ordine di grandezza: chi ha il token e
 * apre il rubinetto, o chi prova a indovinarlo.
 */

/** Un modulo del sito, per quanto insistente, non manda venti lead in un'ora. */
export const LIMITE_PER_IP: Finestra = { massimo: 20, durataMs: 60 * 60_000 }

/**
 * Tetto complessivo dell'endpoint, per non dipendere da un indirizzo IP che
 * chiunque può cambiare: è il freno che regge anche quando il primo non regge.
 * Duecento lead in un'ora sarebbero un record aziendale storico.
 */
export const LIMITE_GLOBALE: Finestra = { massimo: 200, durataMs: 60 * 60_000 }

/**
 * Token sbagliato: qui non c'è alcun uso legittimo da proteggere. Chi conosce
 * il segreto lo manda giusto al primo colpo; chi sbaglia dieci volte in un'ora
 * lo sta cercando, e a quel ritmo un token da 24 caratteri non si trova.
 */
export const LIMITE_TOKEN_ERRATO: Finestra = { massimo: 10, durataMs: 60 * 60_000 }

/* -------------------------------------------------------------------------- */
/*  Matematica della finestra                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Stima delle richieste nella finestra scorrevole che termina adesso.
 *
 * Il conteggio corrente vale per intero; quello precedente vale per la frazione
 * di finestra che ricade ancora nell'intervallo osservato. A metà finestra il
 * contributo della precedente è la metà, a fine finestra è zero.
 */
export function stimaScorrevole(
  stato: StatoContatore,
  finestra: Finestra,
  adesso: Date,
): number {
  const trascorso = adesso.getTime() - stato.windowStart.getTime()

  // Finestra vecchia di due o più intervalli: la precedente non copre più nulla
  // e il conteggio corrente è a sua volta scaduto.
  if (trascorso >= 2 * finestra.durataMs) return 0
  if (trascorso >= finestra.durataMs) {
    const residuo = 1 - (trascorso - finestra.durataMs) / finestra.durataMs
    return Math.ceil(stato.count * residuo)
  }

  const residuo = 1 - trascorso / finestra.durataMs
  return Math.ceil(stato.count + stato.previousCount * residuo)
}

/**
 * Quanto aspettare perché la stima torni sotto il limite.
 *
 * Approssimazione volutamente prudente: si dice al chiamante di aspettare la
 * fine della finestra corrente. Precisare al secondo esatto significherebbe
 * rivelare la forma del contatore a chi lo sta sondando, e non serve a nessuno
 * che stia usando l'endpoint per il suo scopo.
 */
export function riprovaTraSecondi(
  stato: StatoContatore,
  finestra: Finestra,
  adesso: Date,
): number {
  const fine = stato.windowStart.getTime() + finestra.durataMs
  return Math.max(1, Math.ceil((fine - adesso.getTime()) / 1000))
}

export function valuta(
  stato: StatoContatore,
  finestra: Finestra,
  adesso: Date,
): EsitoLimite {
  const usate = stimaScorrevole(stato, finestra, adesso)
  if (usate <= finestra.massimo) {
    return { consentito: true, usate, riprovaTraSecondi: 0 }
  }
  return {
    consentito: false,
    usate,
    riprovaTraSecondi: riprovaTraSecondi(stato, finestra, adesso),
  }
}
