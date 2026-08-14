/**
 * Perdite di sistema e conversione dell'inverter.
 *
 * Sono le perdite **oltre** la temperatura (che ha il suo modulo): ciascuna è
 * nominata e dichiarata, non annegata in una costante. È la differenza fra un
 * numero che si può difendere davanti a un cliente e uno che si può solo
 * affermare. Cambiarle è una scelta esplicita, con un valore che ha un nome.
 */

export interface PerditeSistema {
  /** Sporco, polvere, deiezioni sul vetro. */
  readonly sporcamento: number
  /** Cadute ohmiche nei cavi in continua. */
  readonly ohmicheCc: number
  /** Moduli non identici in serie: rende il più debole. */
  readonly mismatch: number
  /** Degradazione iniziale indotta dalla luce (LID) e primo anno. */
  readonly degradazioneIniziale: number
  /** Riflessione (incidenza) e risposta spettrale/bassa luce. */
  readonly riflessioneSpettro: number
}

/** Valori standard per un impianto residenziale ben fatto. PR risultante ~0,90. */
export const PERDITE_STANDARD: PerditeSistema = {
  sporcamento: 0.02,
  ohmicheCc: 0.02,
  mismatch: 0.02,
  degradazioneIniziale: 0.015,
  riflessioneSpettro: 0.03,
}

/**
 * Fattore unico delle perdite di sistema: il prodotto dei complementi.
 *
 * Le perdite si compongono in modo moltiplicativo, non additivo: 2% + 2% non è
 * 4% ma 3,96%. Sommarle sovrastimerebbe la perdita.
 */
export function fattorePerditeSistema(
  perdite: PerditeSistema = PERDITE_STANDARD,
): number {
  return (
    (1 - perdite.sporcamento) *
    (1 - perdite.ohmicheCc) *
    (1 - perdite.mismatch) *
    (1 - perdite.degradazioneIniziale) *
    (1 - perdite.riflessioneSpettro)
  )
}

/** Efficienza di conversione CC→CA dell'inverter (media di lavoro). */
export const EFFICIENZA_INVERTER_DEFAULT = 0.97

export interface RisultatoInverter {
  /** Potenza in alternata consegnata, kW. */
  readonly potenzaAcKw: number
  /** Potenza persa per troncamento (clipping) quando il campo eccede l'inverter, kW. */
  readonly clippingKw: number
}

/**
 * Conversione dell'inverter con troncamento.
 *
 * L'inverter converte con un'efficienza, e non può superare la sua potenza CA
 * nominale: oltre quel tetto la produzione in eccesso viene **troncata**
 * (clipping). Su un campo poco sovradimensionato è briciole; su uno molto
 * sovradimensionato conta, e va misurato invece che ignorato.
 */
export function applicaInverter(
  potenzaDcKw: number,
  potenzaAcMaxKw: number,
  efficienza: number = EFFICIENZA_INVERTER_DEFAULT,
): RisultatoInverter {
  const dopoConversione = Math.max(0, potenzaDcKw) * efficienza
  const limite = potenzaAcMaxKw > 0 ? potenzaAcMaxKw : dopoConversione
  const potenzaAcKw = Math.min(dopoConversione, limite)
  return {
    potenzaAcKw,
    clippingKw: Math.max(0, dopoConversione - limite),
  }
}
