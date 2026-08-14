/**
 * Profili di carico residenziali: come un consumo annuo si distribuisce nel
 * tempo — nei dodici mesi e nelle ore del giorno — a seconda del tipo di utenza.
 *
 * ## Perché esistono
 *
 * L'autoconsumo non è una proprietà dell'impianto: è l'**incastro fra quando il
 * sole produce e quando la casa consuma**. Due case con lo stesso impianto e lo
 * stesso consumo annuo autoconsumano quote diverse se una vive di sera e l'altra
 * di giorno. Il modello precedente lo riassumeva in una frazione unica (0,40
 * fisso): un numero che azzecca la famiglia-tipo per caso e sbaglia tutti gli
 * altri — una casa con pompa di calore consuma d'inverno, quando il FV rende
 * meno, e il 40% diventa una bugia.
 *
 * SolarEdge Designer risolve così: l'utente inserisce il **consumo annuo dalla
 * bolletta** e sceglie un **profilo di utenza**, che spalma quel numero sui mesi
 * e sulle fasce orarie. È il metodo che l'azienda già usa e conosce, e questo
 * modulo lo porta dentro il nostro motore — senza dipendere da nessuna API: un
 * profilo è **forma statica**, dodici pesi mensili più i pesi delle fasce.
 *
 * ## Cosa NON è
 *
 * Non è la curva reale del contatore del cliente: quella, quando c'è, la
 * batterebbe. È la stima sintetica di default, la stessa classe di modello che
 * usa SolarEdge. La conservazione è garantita: i pesi sommano a 1, quindi la
 * ridistribuzione non crea né distrugge kWh.
 */

/* -------------------------------------------------------------------------- */
/*  Fasce orarie                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Le cinque fasce del giorno, identiche a quelle di SolarEdge Designer. La
 * larghezza è disomogenea di proposito (notte e sera durano sei ore, le altre
 * quattro): sono i confini con cui l'azienda già ragiona.
 */
export const FASCE_GIORNALIERE = [
  { chiave: 'notte', etichetta: 'Notte', dalleOre: 0, alleOre: 6 },
  { chiave: 'mattina', etichetta: 'Mattina', dalleOre: 6, alleOre: 10 },
  { chiave: 'mezzogiorno', etichetta: 'Mezzogiorno', dalleOre: 10, alleOre: 14 },
  { chiave: 'pomeriggio', etichetta: 'Pomeriggio', dalleOre: 14, alleOre: 18 },
  { chiave: 'sera', etichetta: 'Sera', dalleOre: 18, alleOre: 24 },
] as const

export type ChiaveFascia = (typeof FASCE_GIORNALIERE)[number]['chiave']

/** In quale fascia cade un'ora [0, 23]. */
export function fasciaPerOra(ora: number): ChiaveFascia {
  const h = ((Math.floor(ora) % 24) + 24) % 24
  for (const f of FASCE_GIORNALIERE) {
    if (h >= f.dalleOre && h < f.alleOre) return f.chiave
  }
  // Le fasce coprono [0,24): questo ramo non si raggiunge, ma il tipo lo esige.
  return 'sera'
}

/* -------------------------------------------------------------------------- */
/*  Il profilo                                                                */
/* -------------------------------------------------------------------------- */

export interface ProfiloCarico {
  readonly chiave: string
  readonly nome: string
  readonly descrizione: string
  /** Dodici pesi mensili (Gen→Dic), somma 1. */
  readonly pesiMensili: readonly number[]
  /** Peso di ciascuna fascia sul consumo di un giorno, somma 1. */
  readonly pesiGiornalieri: Readonly<Record<ChiaveFascia, number>>
}

/* -------------------------------------------------------------------------- */
/*  Libreria dei profili                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Profilo di riferimento, digitalizzato dalle schermate di SolarEdge Designer
 * consegnate dall'azienda (utenza «Famiglia con una o due persone», 5.000 kWh).
 *
 * Mensile: piatto con il tuffo di luglio (le vacanze). Giornaliero: poco a
 * mezzogiorno (6%), molto la sera (41%) — produzione e consumo in controfase,
 * ed è il motivo per cui l'autoconsumo diretto è più basso di quanto un 40%
 * piatto lasci credere.
 */
export const FAMIGLIA_1_2: ProfiloCarico = {
  chiave: 'famiglia_1_2',
  nome: 'Famiglia con una o due persone',
  descrizione:
    'Consumo distribuito sull’anno con calo estivo; giornata concentrata la sera.',
  // 450 355 480 440 455 410 255 400 410 455 410 480  su 5.000 kWh
  pesiMensili: [
    0.09, 0.071, 0.096, 0.088, 0.091, 0.082, 0.051, 0.08, 0.082, 0.091, 0.082,
    0.096,
  ],
  pesiGiornalieri: {
    notte: 0.09,
    mattina: 0.17,
    mezzogiorno: 0.06,
    pomeriggio: 0.27,
    sera: 0.41,
  },
}

/**
 * Pesi MENSILI dell'utenza «Casa Full Electric con Pompa di Calore» (5.000 kWh),
 * dominata dall'inverno: Gen/Dic 842, luglio 316. Contro un impianto FV che
 * d'inverno rende un terzo dell'estate, è il caso che smaschera il 40% fisso.
 *
 * Manca ancora il profilo GIORNALIERO di questa utenza (non era nelle schermate
 * fornite): finché non lo si cattura da SolarEdge, la pompa di calore non ha un
 * profilo completo qui, e non si inventa — un profilo giornaliero sbagliato
 * falserebbe l'autoconsumo peggio di non averlo. Vedere docs/15.
 */
export const PESI_MENSILI_FULL_ELECTRIC_PDC: readonly number[] = [
  0.1684, 0.1474, 0.0421, 0.0421, 0.0421, 0.0526, 0.0632, 0.0632, 0.0421,
  0.0421, 0.1263, 0.1684,
]

/** I profili completi utilizzabili oggi. Si estende catturando le altre utenze. */
export const PROFILI_CARICO: readonly ProfiloCarico[] = [FAMIGLIA_1_2]

export function profiloPerChiave(chiave: string): ProfiloCarico | null {
  return PROFILI_CARICO.find((p) => p.chiave === chiave) ?? null
}

/* -------------------------------------------------------------------------- */
/*  Espansione del consumo                                                     */
/* -------------------------------------------------------------------------- */

/** Numero di giorni per mese, anno non bisestile. */
const GIORNI_MESE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

/**
 * La quota di consumo di un giorno che cade in ciascuna delle 24 ore.
 *
 * Il peso della fascia si spalma uniformemente sulle sue ore: è
 * l'approssimazione dichiarata del metodo a fasce (SolarEdge internamente lavora
 * a risoluzione più fine). Somma 1.
 */
export function quotaOrariaConsumo(profilo: ProfiloCarico): number[] {
  const ore = new Array<number>(24).fill(0)
  for (const f of FASCE_GIORNALIERE) {
    const oreFascia = f.alleOre - f.dalleOre
    const perOra = (profilo.pesiGiornalieri[f.chiave] ?? 0) / oreFascia
    for (let h = f.dalleOre; h < f.alleOre; h += 1) ore[h] = perOra
  }
  return ore
}

/**
 * Il consumo annuo disteso su una matrice **mese × ora del giorno** (kWh),
 * cioè quanta energia dell'anno cade in un dato mese e in una data ora tipica.
 *
 * È la forma su cui si calcola l'autoconsumo per confronto con la produzione,
 * distribuita alla stessa risoluzione. La somma di tutte le celle è il consumo
 * annuo (a meno dell'arrotondamento intero non applicato qui: si resta in kWh
 * frazionari, l'arrotondamento a euro avviene molto più a valle).
 */
export function matriceConsumoMensileOraria(
  consumoAnnuoKwh: number,
  profilo: ProfiloCarico,
): number[][] {
  const annuo = Number.isFinite(consumoAnnuoKwh) && consumoAnnuoKwh > 0
    ? consumoAnnuoKwh
    : 0
  const quotaOraria = quotaOrariaConsumo(profilo)

  return profilo.pesiMensili.map((pesoMese) => {
    const consumoMese = annuo * pesoMese
    return quotaOraria.map((q) => consumoMese * q)
  })
}

/* -------------------------------------------------------------------------- */
/*  Matching produzione / consumo                                             */
/* -------------------------------------------------------------------------- */

export interface BilancioDaMatching {
  readonly produzioneKwh: number
  readonly consumoKwh: number
  readonly autoconsumoKwh: number
  readonly exportKwh: number
  readonly prelievoKwh: number
  /** autoconsumo / produzione, in [0, 1]. */
  readonly frazioneAutoconsumo: number
}

/**
 * Autoconsumo dal confronto **cella per cella** di due matrici mese × ora.
 *
 * In ogni cella si autoconsuma il minimo fra ciò che si produce e ciò che si
 * consuma in quel momento tipico; il resto della produzione va in rete, il resto
 * del consumo viene dalla rete. È la stessa conservazione di `bilanciaEnergia`,
 * ma alla risoluzione dove l'autoconsumo si decide davvero — invece che
 * sull'anno intero, dove un surplus di mezzogiorno cancella per finta un
 * prelievo di sera che avviene otto ore dopo.
 *
 * Le due matrici devono avere la stessa forma (12 × 24). La produzione la
 * fornirà il motore fisico come giorno-tipo mensile; qui la funzione è pura e
 * indifferente alla sua origine, così è testabile da sola.
 */
export function autoconsumoDaMatching(
  produzioneMensileOraria: readonly (readonly number[])[],
  consumoMensileOrario: readonly (readonly number[])[],
): BilancioDaMatching {
  let produzioneKwh = 0
  let consumoKwh = 0
  let autoconsumoKwh = 0

  for (let m = 0; m < 12; m += 1) {
    const rigaProd = produzioneMensileOraria[m] ?? []
    const rigaCons = consumoMensileOrario[m] ?? []
    for (let h = 0; h < 24; h += 1) {
      const prod = Math.max(0, rigaProd[h] ?? 0)
      const cons = Math.max(0, rigaCons[h] ?? 0)
      produzioneKwh += prod
      consumoKwh += cons
      autoconsumoKwh += Math.min(prod, cons)
    }
  }

  const exportKwh = produzioneKwh - autoconsumoKwh
  const prelievoKwh = consumoKwh - autoconsumoKwh

  return {
    produzioneKwh,
    consumoKwh,
    autoconsumoKwh,
    exportKwh,
    prelievoKwh,
    frazioneAutoconsumo: produzioneKwh > 0 ? autoconsumoKwh / produzioneKwh : 0,
  }
}

/** I giorni per mese, esportati per chi costruisce la matrice di produzione. */
export { GIORNI_MESE }
