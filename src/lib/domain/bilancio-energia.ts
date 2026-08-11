/**
 * Bilancio energetico annuo di un impianto FV residenziale.
 *
 * Conservazione: autoconsumo + export = produzione;
 * autoconsumo + da rete = consumo (se consumo > 0).
 *
 * La frazione di autoconsumo è un input del caso cliente (studio), non una
 * costante di prodotto: impianti diversi (consumo, batteria, profilo) devono
 * poter produrre bilanci diversi e verificabili.
 */

export type InputBilancioEnergia = {
  readonly produzioneKwh: number
  readonly consumoKwh: number
  /**
   * Quota della produzione destinata all'autoconsumo, in [0, 1], prima del
   * tetto imposto dal consumo. 0 = tutta in rete (es. impianto aggiuntivo).
   */
  readonly frazioneAutoconsumo: number
}

export type BilancioEnergia = {
  readonly produzioneKwh: number
  readonly consumoKwh: number
  readonly autoconsumoKwh: number
  readonly exportKwh: number
  readonly daReteKwh: number
  /** autoconsumo / produzione (0 se produzione nulla). */
  readonly frazioneAutoconsumoEffettiva: number
}

function interoNonNegativo(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n)
}

export function bilanciaEnergia(input: InputBilancioEnergia): BilancioEnergia {
  const produzioneKwh = interoNonNegativo(input.produzioneKwh)
  const consumoKwh = interoNonNegativo(input.consumoKwh)
  const frazione = Number.isFinite(input.frazioneAutoconsumo)
    ? Math.min(1, Math.max(0, input.frazioneAutoconsumo))
    : 0

  const autoconsumoKwh = Math.min(
    Math.round(produzioneKwh * frazione),
    consumoKwh,
    produzioneKwh,
  )
  const exportKwh = produzioneKwh - autoconsumoKwh
  const daReteKwh = consumoKwh - autoconsumoKwh

  return {
    produzioneKwh,
    consumoKwh,
    autoconsumoKwh,
    exportKwh,
    daReteKwh,
    frazioneAutoconsumoEffettiva:
      produzioneKwh > 0 ? autoconsumoKwh / produzioneKwh : 0,
  }
}
