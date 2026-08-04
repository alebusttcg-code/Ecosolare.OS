import {
  dividiArrotondando,
  SCALA_IMPORTO,
  SCALA_PERCENTUALE,
  SCALA_PREZZO,
  SCALA_QUANTITA,
} from './money'

/**
 * Calcolo di un preventivo: imponibile, costi, margine, IVA.
 *
 * Funzione pura e interamente in aritmetica intera (vedere money.ts). E' il
 * modulo su cui poggia l'obiettivo "margine protetto" del brief: se sbaglia,
 * sbagliano tutte le decisioni commerciali prese sopra di esso.
 *
 * Due regole che determinano i risultati e che vanno conosciute:
 *
 *  1. **Si arrotonda a livello di riga, poi si somma.** E' la prassi della
 *     fatturazione italiana e produce un totale che coincide con la somma delle
 *     righe stampate sul documento. Sommare prima e arrotondare dopo darebbe un
 *     totale piu' "esatto" ma diverso da quello che il cliente ricalcola a mano.
 *  2. **Lo sconto globale e' ripartito sulle righe**, non sottratto dal totale:
 *     altrimenti il margine per riga non sarebbe piu' confrontabile con il costo.
 */

export interface RigaCalcolo {
  /** Millesimi di unita' (scala 1.000). */
  readonly quantita: number
  /** Decimillesimi di euro (scala 10.000). */
  readonly prezzoUnitario: number
  readonly costoUnitario: number
  /** Centesimi di punto percentuale (scala 100): 1050 = 10,5%. */
  readonly scontoPct: number
  readonly aliquotaIva: number
}

export interface TotaliRiga {
  /** Centesimi di euro. */
  readonly imponibile: number
  readonly costo: number
  readonly iva: number
  readonly margine: number
}

/**
 * Totali di una singola riga.
 *
 * L'ordine delle operazioni conta: si moltiplica prima e si arrotonda dopo, una
 * volta sola, per non accumulare l'errore di due arrotondamenti successivi.
 */
export function calcolaRiga(riga: RigaCalcolo): TotaliRiga {
  // quantita' (1/1.000) x prezzo (1/10.000) => 1/10.000.000, riportato a centesimi.
  const lordoCentesimi = dividiArrotondando(
    riga.quantita * riga.prezzoUnitario,
    (SCALA_QUANTITA * SCALA_PREZZO) / SCALA_IMPORTO,
  )

  const scontoCentesimi = dividiArrotondando(
    lordoCentesimi * riga.scontoPct,
    SCALA_PERCENTUALE * 100,
  )
  const imponibile = lordoCentesimi - scontoCentesimi

  // Il costo non subisce lo sconto commerciale: quello che paghiamo non cambia
  // perche' abbiamo deciso di vendere a meno. E' esattamente il punto in cui il
  // margine si assottiglia, e deve restare visibile.
  const costo = dividiArrotondando(
    riga.quantita * riga.costoUnitario,
    (SCALA_QUANTITA * SCALA_PREZZO) / SCALA_IMPORTO,
  )

  const iva = dividiArrotondando(imponibile * riga.aliquotaIva, SCALA_PERCENTUALE * 100)

  return { imponibile, costo, iva, margine: imponibile - costo }
}

export interface RipartizioneIva {
  readonly aliquota: number
  readonly imponibile: number
  readonly imposta: number
}

export interface TotaliPreventivo {
  readonly imponibile: number
  readonly costoTotale: number
  readonly margine: number
  /** Centesimi di punto. `null` quando l'imponibile e' zero. */
  readonly marginePct: number | null
  readonly scontoGlobale: number
  readonly ripartizioneIva: readonly RipartizioneIva[]
  readonly imposta: number
  readonly totale: number
  readonly righe: readonly TotaliRiga[]
}

/**
 * Totali del preventivo.
 *
 * @param scontoGlobalePct sconto sul totale, in centesimi di punto. Viene
 * ripartito proporzionalmente sulle righe prima del calcolo dell'IVA, cosi' che
 * ogni aliquota riceva la sua quota di sconto.
 */
export function calcolaPreventivo(
  righe: readonly RigaCalcolo[],
  scontoGlobalePct = 0,
): TotaliPreventivo {
  const conSconto: RigaCalcolo[] = righe.map((riga) => {
    if (scontoGlobalePct === 0) return riga
    // Gli sconti si compongono in modo moltiplicativo: 10% + 10% e' 19%, non 20%.
    const residuo =
      (SCALA_PERCENTUALE * 100 - riga.scontoPct) *
      (SCALA_PERCENTUALE * 100 - scontoGlobalePct)
    const scontoComposto = SCALA_PERCENTUALE * 100 - dividiArrotondando(residuo, SCALA_PERCENTUALE * 100)
    return { ...riga, scontoPct: scontoComposto }
  })

  const totaliRighe = conSconto.map(calcolaRiga)

  const imponibile = totaliRighe.reduce((somma, r) => somma + r.imponibile, 0)
  const costoTotale = totaliRighe.reduce((somma, r) => somma + r.costo, 0)
  const imposta = totaliRighe.reduce((somma, r) => somma + r.iva, 0)

  const lordoSenzaSconto = righe
    .map((riga) => calcolaRiga({ ...riga, scontoPct: 0 }))
    .reduce((somma, r) => somma + r.imponibile, 0)

  const aliquote = new Map<number, { imponibile: number; imposta: number }>()
  conSconto.forEach((riga, indice) => {
    const totali = totaliRighe[indice]
    if (!totali) return
    const corrente = aliquote.get(riga.aliquotaIva) ?? { imponibile: 0, imposta: 0 }
    aliquote.set(riga.aliquotaIva, {
      imponibile: corrente.imponibile + totali.imponibile,
      imposta: corrente.imposta + totali.iva,
    })
  })

  const margine = imponibile - costoTotale

  return {
    imponibile,
    costoTotale,
    margine,
    // Su imponibile zero la percentuale non esiste: restituire 0 farebbe
    // sembrare "a margine nullo" un preventivo semplicemente vuoto.
    marginePct:
      imponibile === 0
        ? null
        : dividiArrotondando(margine * SCALA_PERCENTUALE * 100, imponibile),
    scontoGlobale: lordoSenzaSconto - imponibile,
    ripartizioneIva: [...aliquote.entries()]
      .map(([aliquota, valori]) => ({ aliquota, ...valori }))
      .sort((a, b) => a.aliquota - b.aliquota),
    imposta,
    totale: imponibile + imposta,
    righe: totaliRighe,
  }
}

export type EsitoSoglia = 'sopra_soglia' | 'sotto_soglia' | 'non_valutabile'

/**
 * Verifica del margine rispetto alla soglia minima aziendale.
 *
 * Un preventivo sotto soglia non viene bloccato: richiede l'approvazione della
 * direzione (§5.7 del brief). La differenza e' importante — l'obiettivo e'
 * rendere consapevole la decisione, non impedirla.
 */
export function valutaSoglia(
  marginePct: number | null,
  sogliaPct: number,
): EsitoSoglia {
  if (marginePct === null) return 'non_valutabile'
  return marginePct < sogliaPct ? 'sotto_soglia' : 'sopra_soglia'
}
