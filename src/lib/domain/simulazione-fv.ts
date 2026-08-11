import { bilanciaEnergia, type BilancioEnergia } from '@/lib/domain/bilancio-energia'
import {
  calcolaEconomiaFv,
  type EconomiaFv,
} from '@/lib/domain/economia-fv'
import {
  calcolaDetrazioneIrpef,
  type DetrazioneIrpef,
} from '@/lib/domain/incentivi'
import {
  kWpDaLayout,
  type SnapshotStudioTetto,
} from '@/lib/domain/studio-tetto'

/**
 * Parametri di simulazione provenienti da config (A18), mai da costanti di
 * calcolo nei caller di business.
 */
export type ParametriSimulazioneFv = {
  readonly detrazionePct: number
  readonly detrazioneAnni: number
  readonly orizzonteAnni: number
  readonly inflazioneEnergiaPct: number
  readonly tassoScontoPct: number
  readonly degradazioneProduzionePctAnno: number
  /** Usata solo se lo studio non ha una frazione esplicita. */
  readonly frazioneAutoconsumoDefault: number
}

export type InputSimulazioneFv = {
  readonly snapshot: SnapshotStudioTetto
  /** Totale lordo preventivo (IVA inclusa), centesimi. */
  readonly investimentoLordoCents: number
  readonly parametri: ParametriSimulazioneFv
}

export type FaldaSimulazione = {
  readonly indice: number
  readonly pitchDegrees: number
  readonly azimuthDegrees: number
  readonly areaMeters2: number | null
}

export type RisultatoSimulazioneFv = {
  readonly moduli: number
  readonly kWp: number
  readonly wattPicco: number | null
  readonly produzioneKwh: number
  readonly consumoKwh: number
  readonly resaSpecificaKwhKwp: number | null
  readonly tariffaImportEurKwh: number
  readonly tariffaExportEurKwh: number
  readonly frazioneAutoconsumoUsata: number
  readonly falde: readonly FaldaSimulazione[]
  readonly bilancio: BilancioEnergia
  readonly detrazione: DetrazioneIrpef
  readonly economia: EconomiaFv
}

export function simulaImpiantoFv(input: InputSimulazioneFv): RisultatoSimulazioneFv {
  const { snapshot, parametri } = input
  const layout = snapshot.layout
  const moduli = layout?.moduli.length ?? 0
  const kWp = kWpDaLayout(layout)
  const produzioneKwh = Math.round(snapshot.produzioneAnnuakWh)
  const consumoKwh = Math.round(snapshot.consumoAnnuoKwh)
  const frazioneAutoconsumoUsata =
    snapshot.frazioneAutoconsumo != null &&
    Number.isFinite(snapshot.frazioneAutoconsumo)
      ? snapshot.frazioneAutoconsumo
      : parametri.frazioneAutoconsumoDefault

  const bilancio = bilanciaEnergia({
    produzioneKwh,
    consumoKwh,
    frazioneAutoconsumo: frazioneAutoconsumoUsata,
  })

  const detrazione = calcolaDetrazioneIrpef({
    prezzoLordoCents: input.investimentoLordoCents,
    detrazionePct: parametri.detrazionePct,
    anniRate: parametri.detrazioneAnni,
  })

  const economia = calcolaEconomiaFv({
    bilancio,
    tariffaImportEurKwh: snapshot.tariffaImportEurKwh,
    tariffaExportEurKwh: snapshot.tariffaExportEurKwh,
    investimentoLordoCents: input.investimentoLordoCents,
    detrazione,
    orizzonteAnni: parametri.orizzonteAnni,
    inflazioneEnergiaPct: parametri.inflazioneEnergiaPct,
    tassoScontoPct: parametri.tassoScontoPct,
    degradazioneProduzionePctAnno: parametri.degradazioneProduzionePctAnno,
  })

  const faldeVisibili = new Set(snapshot.faldeRimosse)
  const falde: FaldaSimulazione[] = (snapshot.analisi.falde ?? [])
    .filter((f) => !faldeVisibili.has(f.indice))
    .map((f) => ({
      indice: f.indice,
      pitchDegrees: f.pitchDegrees,
      azimuthDegrees: f.azimuthDegrees,
      areaMeters2: f.areaMeters2,
    }))

  return {
    moduli,
    kWp,
    wattPicco: layout?.wattPicco ?? null,
    produzioneKwh,
    consumoKwh,
    resaSpecificaKwhKwp: kWp > 0 ? Math.round(produzioneKwh / kWp) : null,
    tariffaImportEurKwh: snapshot.tariffaImportEurKwh,
    tariffaExportEurKwh: snapshot.tariffaExportEurKwh,
    frazioneAutoconsumoUsata,
    falde,
    bilancio,
    detrazione,
    economia,
  }
}
