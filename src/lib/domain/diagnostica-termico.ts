/**
 * Perché la pompa di calore non entra nel piano economico.
 *
 * Il motore è severo di proposito: senza gas consumato, SCOP e prezzo del gas
 * non inventa un risparmio, e il capitolo termico resta descrittivo. È la
 * scelta giusta — meglio un capitolo muto che un beneficio inventato — ma
 * finora era **silenziosa**: il commerciale mandava un preventivo in cui la
 * pompa di calore era solo un costo, il rientro usciva peggiore del vero, e
 * nessuno sapeva che era mancato un campo.
 *
 * Questo modulo non decide niente: dice soltanto cosa manca e dove si compila.
 * La regola di calcolo resta una sola, in `simulaImpiantoFv`, e questa
 * diagnosi ne ricalca le condizioni.
 */

import { prezzoTermicoEffettivoCents } from './componenti-impianto'

export interface IngressiTermico {
  /** Gas dell'ultimo anno, dalla bolletta del cliente, in Smc. */
  readonly consumoGasAnnuoSmc: number | null | undefined
  /** Rendimento stagionale: dal catalogo del prodotto o scritto a mano. */
  readonly scop: number | null | undefined
  /** Prezzo del gas: dal preventivo o dalla configurazione aziendale. */
  readonly prezzoGasEurSmc: number | null | undefined
}

export interface DatoMancante {
  /** Che cosa manca, in una riga. */
  readonly cosa: string
  /** Dove si compila, perché non sono tutti nella stessa schermata. */
  readonly dove: string
}

function assente(valore: number | null | undefined): boolean {
  return !(typeof valore === 'number' && Number.isFinite(valore) && valore > 0)
}

/**
 * L'elenco di ciò che manca, in ordine di dove si va a metterlo.
 * Vuoto significa che il termico entra nel piano.
 */
export function datiMancantiTermico(
  ingressi: IngressiTermico,
): readonly DatoMancante[] {
  const mancanti: DatoMancante[] = []

  if (assente(ingressi.consumoGasAnnuoSmc)) {
    mancanti.push({
      cosa: 'il gas consumato nell’ultimo anno',
      dove: 'nello studio tetto, sezione Sviluppo — è sulla bolletta del cliente',
    })
  }
  if (assente(ingressi.scop)) {
    mancanti.push({
      cosa: 'lo SCOP della pompa di calore',
      dove: 'nel catalogo prodotti, oppure qui sotto per questo preventivo',
    })
  }
  if (assente(ingressi.prezzoGasEurSmc)) {
    mancanti.push({
      cosa: 'il prezzo del gas',
      dove: 'qui sotto, oppure come valore aziendale nelle impostazioni',
    })
  }

  return mancanti
}

/** Vero quando il risparmio sul riscaldamento entra davvero nei conti. */
export function termicoEntraNelPiano(ingressi: IngressiTermico): boolean {
  return datiMancantiTermico(ingressi).length === 0
}

/**
 * I tre dati messi insieme da dove vivono davvero.
 *
 * Non è una comodità: la combinazione è la parte che si sbaglia. Lo SCOP può
 * arrivare dal catalogo o dal campo a mano, il prezzo del gas dal preventivo o
 * dalla configurazione aziendale, e il gas consumato solo dallo studio tetto.
 * Tenerla dentro un componente di ottocento righe vorrebbe dire non poterla
 * verificare.
 */
export function ingressiTermico(dati: {
  /** Dallo studio tetto: non ha alternative, o c'è o non c'è. */
  readonly consumoGasAnnuoSmc: number | null | undefined
  /** Dal catalogo del prodotto. */
  readonly scopCatalogo: number | null | undefined
  /** Scritto a mano nel preventivo, quando il catalogo tace. */
  readonly scopManuale: number | null | undefined
  /** Scritto a mano nel preventivo: è il gas del cliente. */
  readonly prezzoGasManuale: number | null | undefined
  /** Valore aziendale configurato, quando il preventivo tace. */
  readonly prezzoGasPredefinito: number | null | undefined
}): IngressiTermico {
  const primoValido = (
    ...valori: readonly (number | null | undefined)[]
  ): number | null => {
    for (const valore of valori) {
      if (typeof valore === 'number' && Number.isFinite(valore) && valore > 0) {
        return valore
      }
    }
    return null
  }

  return {
    consumoGasAnnuoSmc: primoValido(dati.consumoGasAnnuoSmc),
    scop: primoValido(dati.scopCatalogo, dati.scopManuale),
    prezzoGasEurSmc: primoValido(dati.prezzoGasManuale, dati.prezzoGasPredefinito),
  }
}

/* -------------------------------------------------------------------------- */
/*  Coerenza del prezzo termico                                                */
/* -------------------------------------------------------------------------- */

export type FontePrezzoTermico = 'righe' | 'manuale' | 'assente'

export interface CoerenzaPrezzoTermico {
  /**
   * Prezzo IVA inclusa dedotto dalle righe con ruolo `pompa_calore`, centesimi.
   * Zero quando nessuna riga è riconosciuta come termica.
   */
  readonly dedottoCents: number
  /** Prezzo IVA inclusa scritto a mano nel blocco termico, centesimi. Zero se assente. */
  readonly manualeCents: number
  /** Il prezzo che entra davvero nel piano e nel PDF: le righe vincono quando dicono qualcosa. */
  readonly effettivoCents: number
  /** Da dove viene l'importo usato. */
  readonly fonte: FontePrezzoTermico
  /**
   * Vero quando esistono righe termiche **e** un valore a mano che diverge:
   * quel valore è ignorato, e chi compila deve saperlo invece di scoprirlo
   * confrontando due pagine dello stesso preventivo.
   */
  readonly manualeIgnorato: boolean
  /** Scarto assoluto in centesimi fra dedotto e manuale, quando entrambi presenti. */
  readonly divergenzaCents: number
}

/**
 * Sotto un euro non è una divergenza: è arrotondamento.
 *
 * Il valore a mano dei preventivi storici è tondo all'euro, la somma delle
 * righe no. Segnalare uno scarto di pochi centesimi vorrebbe dire gridare al
 * lupo su ogni preventivo, e un avviso che si impara a ignorare non protegge
 * più niente.
 */
const TOLLERANZA_DIVERGENZA_CENTS = 100

/**
 * Mette in chiaro quale prezzo termico vale e se ne sta ignorando un altro.
 *
 * La regola di *scelta* è una sola e vive in `prezzoTermicoEffettivoCents`: qui
 * la si riusa, non la si riscrive. Questa funzione aggiunge solo la diagnosi —
 * da dove viene il numero e quanto diverge da quello scritto a mano — perché la
 * coerenza fra le righe e il campo manuale non resti un fatto che si scopre
 * troppo tardi.
 */
export function coerenzaPrezzoTermico(input: {
  readonly dedottoCents: number
  readonly manualeCents: number
}): CoerenzaPrezzoTermico {
  // Un campo vuoto arriva come NaN dal parsing, un errore come negativo: né
  // l'uno né l'altro è un prezzo, e `Math.max(0, NaN)` resterebbe NaN.
  const cents = (valore: number): number =>
    Number.isFinite(valore) && valore > 0 ? Math.round(valore) : 0
  const dedottoCents = cents(input.dedottoCents)
  const manualeCents = cents(input.manualeCents)

  const effettivoCents = prezzoTermicoEffettivoCents(
    { prezzoTermicoLordoCents: dedottoCents },
    manualeCents,
  )

  const fonte: FontePrezzoTermico =
    dedottoCents > 0 ? 'righe' : manualeCents > 0 ? 'manuale' : 'assente'

  const divergenzaCents =
    dedottoCents > 0 && manualeCents > 0 ? Math.abs(dedottoCents - manualeCents) : 0

  const manualeIgnorato =
    fonte === 'righe' && divergenzaCents > TOLLERANZA_DIVERGENZA_CENTS

  return {
    dedottoCents,
    manualeCents,
    effettivoCents,
    fonte,
    manualeIgnorato,
    divergenzaCents,
  }
}
