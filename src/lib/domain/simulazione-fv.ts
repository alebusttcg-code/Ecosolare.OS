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
  contaModuli,
  kWpDaLayouts,
  layoutsAttivi,
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
  readonly moduli: number
  readonly kWp: number
}

export type RisultatoSimulazioneFv = {
  readonly moduli: number
  readonly kWp: number
  /** Watt di picco se unici su tutte le falde, altrimenti null. */
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
  const layouts = layoutsAttivi(snapshot)
  const moduli = contaModuli(layouts)
  const kWp = kWpDaLayouts(layouts)
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

  const faldeRimosse = new Set(snapshot.faldeRimosse)
  const layoutPerFalda = new Map(layouts.map((l) => [l.faldaIndice, l]))
  const falde: FaldaSimulazione[] = (snapshot.analisi.falde ?? [])
    .filter((f) => !faldeRimosse.has(f.indice))
    .map((f) => {
      const L = layoutPerFalda.get(f.indice)
      return {
        indice: f.indice,
        pitchDegrees: f.pitchDegrees,
        azimuthDegrees: f.azimuthDegrees,
        areaMeters2: f.areaMeters2,
        moduli: L?.moduli.length ?? 0,
        kWp: L ? (L.moduli.length * L.wattPicco) / 1000 : 0,
      }
    })

  const wattUnici = new Set(layouts.map((l) => l.wattPicco))

  return {
    moduli,
    kWp,
    wattPicco: wattUnici.size === 1 ? [...wattUnici][0]! : null,
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
