import type { BilancioEnergia } from '@/lib/domain/bilancio-energia'
import {
  rateDetrazionePerAnno,
  type DetrazioneIrpef,
} from '@/lib/domain/incentivi'
import { dividiArrotondando } from '@/lib/domain/money'

/**
 * Economia FV lato cliente: bollette, risparmio, cashflow, payback, NPV.
 *
 * Tutte le tariffe, inflazione, sconto e orizzonte sono input del caso
 * (studio + config vigente): lo stesso motore produce risultati diversi per
 * ogni cliente.
 */

export type InputEconomiaFv = {
  readonly bilancio: BilancioEnergia
  readonly tariffaImportEurKwh: number
  readonly tariffaExportEurKwh: number
  /** Investimento IVA inclusa, centesimi (totale lordo preventivo FV). */
  readonly investimentoLordoCents: number
  readonly detrazione: DetrazioneIrpef
  readonly orizzonteAnni: number
  /** Inflazione prezzo energia, punti percentuali (es. 3 = +3%/anno). */
  readonly inflazioneEnergiaPct: number
  /** Tasso di sconto NPV, punti percentuali. */
  readonly tassoScontoPct: number
  /** Degradazione produzione, punti percentuali/anno. */
  readonly degradazioneProduzionePctAnno: number
}

export type AnnoSimulazione = {
  readonly anno: number
  readonly risparmioEnergiaCents: number
  readonly rataDetrazioneCents: number
  readonly flussoCents: number
  readonly flussoAttualizzatoCents: number
}

export type EconomiaFv = {
  readonly bollettaAttualeAnnuacents: number
  readonly bollettaConFvAnnuacents: number
  readonly bollettaAttualeMensileCents: number
  readonly bollettaConFvMensileCents: number
  readonly risparmioMensileCents: number
  readonly risparmioAnnuoAnno1Cents: number
  /** Anni al recupero (con detrazione nel flusso), null se non recupera. */
  readonly paybackAnni: number | null
  readonly npvCents: number
  readonly cashflow: readonly AnnoSimulazione[]
}

/** kWh × €/kWh → centesimi, arrotondamento commerciale. */
export function costoEnergiaCents(kwh: number, tariffaEurKwh: number): number {
  if (!(kwh > 0) || !(tariffaEurKwh > 0)) return 0
  return Math.round(kwh * tariffaEurKwh * 100)
}

/**
 * Bolletta annua con FV: costo energia da rete meno valorizzazione export RID.
 * Può essere negativa (credito netto da cessione).
 */
export function bollettaConFvAnnuacents(
  bilancio: BilancioEnergia,
  tariffaImportEurKwh: number,
  tariffaExportEurKwh: number,
): number {
  const costoRete = costoEnergiaCents(bilancio.daReteKwh, tariffaImportEurKwh)
  const ricavoExport = costoEnergiaCents(bilancio.exportKwh, tariffaExportEurKwh)
  return costoRete - ricavoExport
}

export function calcolaEconomiaFv(input: InputEconomiaFv): EconomiaFv {
  const bollettaAttualeAnnuacents = costoEnergiaCents(
    input.bilancio.consumoKwh,
    input.tariffaImportEurKwh,
  )
  const bollettaConFv = bollettaConFvAnnuacents(
    input.bilancio,
    input.tariffaImportEurKwh,
    input.tariffaExportEurKwh,
  )
  const risparmioAnnuoAnno1Cents = bollettaAttualeAnnuacents - bollettaConFv

  const bollettaAttualeMensileCents = dividiArrotondando(
    bollettaAttualeAnnuacents,
    12,
  )
  const bollettaConFvMensileCents = dividiArrotondando(bollettaConFv, 12)
  const risparmioMensileCents =
    bollettaAttualeMensileCents - bollettaConFvMensileCents

  const orizzonte = Math.max(1, Math.round(input.orizzonteAnni))
  const infl = input.inflazioneEnergiaPct / 100
  const degr = input.degradazioneProduzionePctAnno / 100
  const sconto = input.tassoScontoPct / 100
  const rateDetrazione = rateDetrazionePerAnno(input.detrazione)

  const cashflow: AnnoSimulazione[] = []
  let cumulato = -Math.max(0, Math.round(input.investimentoLordoCents))
  let paybackAnni: number | null = null
  let npvCents = -Math.max(0, Math.round(input.investimentoLordoCents))

  for (let anno = 1; anno <= orizzonte; anno++) {
    const fattoreDegr = Math.pow(1 - degr, anno - 1)
    const fattoreInfl = Math.pow(1 + infl, anno - 1)
    const risparmioEnergiaCents = Math.round(
      risparmioAnnuoAnno1Cents * fattoreDegr * fattoreInfl,
    )
    const rataDetrazioneCents =
      anno <= rateDetrazione.length ? (rateDetrazione[anno - 1] ?? 0) : 0
    const flussoCents = risparmioEnergiaCents + rataDetrazioneCents
    const flussoAttualizzatoCents = Math.round(
      flussoCents / Math.pow(1 + sconto, anno),
    )

    cashflow.push({
      anno,
      risparmioEnergiaCents,
      rataDetrazioneCents,
      flussoCents,
      flussoAttualizzatoCents,
    })

    cumulato += flussoCents
    if (paybackAnni == null && cumulato >= 0) paybackAnni = anno
    npvCents += flussoAttualizzatoCents
  }

  return {
    bollettaAttualeAnnuacents,
    bollettaConFvAnnuacents: bollettaConFv,
    bollettaAttualeMensileCents,
    bollettaConFvMensileCents,
    risparmioMensileCents,
    risparmioAnnuoAnno1Cents,
    paybackAnni,
    npvCents,
    cashflow,
  }
}
