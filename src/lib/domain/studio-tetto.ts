import { stimaProduzioneFalda } from '@/lib/domain/produzione-fv'
import type { AnalisiTetto, Coordinate, RettangoloModulo } from '@/lib/solar'

/**
 * Snapshot persistito di uno studio tetto (Sviluppo → CRM).
 *
 * Produzione e tariffe sono del caso cliente; il motore economico
 * (`simulaImpiantoFv`) le consuma senza sovrascrivere i dati di situazione.
 */

export interface LayoutStudioFalda {
  readonly faldaIndice: number
  readonly formatoId: string
  readonly wattPicco: number
  readonly quantitaRichiesta: number
  readonly landscape: boolean
  readonly moduli: readonly RettangoloModulo[]
}

export interface SnapshotStudioTetto {
  readonly analisi: AnalisiTetto
  /** Chiavi = indice falda in stringa (JSON). */
  readonly poligoni: Readonly<Record<string, readonly Coordinate[]>>
  readonly faldeRimosse: readonly number[]
  readonly layout: LayoutStudioFalda | null
  readonly consumoAnnuoKwh: number
  readonly produzioneAnnuakWh: number
  /** Tariffe del caso (€/kWh), non valori di listino catalogo. */
  readonly tariffaImportEurKwh: number
  readonly tariffaExportEurKwh: number
  /**
   * Quota produzione → autoconsumo in [0, 1]. Se assente, in simulazione si
   * usa il default di config vigente.
   */
  readonly frazioneAutoconsumo?: number
}

/**
 * Fallback se mancano geometria/posizione (lab senza analisi completa).
 * Preferire sempre `stimaProduzioneDaStudio`.
 */
export const RESA_SPECIFICA_DEFAULT_KWH_KWP = 1320

export function kWpDaLayout(layout: LayoutStudioFalda | null): number {
  if (!layout || layout.moduli.length === 0) return 0
  return (layout.moduli.length * layout.wattPicco) / 1000
}

export function stimaProduzioneAnnuakWh(kWp: number, resa = RESA_SPECIFICA_DEFAULT_KWH_KWP): number {
  if (kWp <= 0) return 0
  return Math.round(kWp * resa)
}

/**
 * Produzione annua dal layout + falda/posizione dello studio.
 * Usa inclinazione, esposizione e latitudine; altrimenti fallback a resa fissa.
 */
export function stimaProduzioneDaStudio(
  snapshot: Pick<
    SnapshotStudioTetto,
    'analisi' | 'layout' | 'faldeRimosse'
  >,
): number {
  const kWp = kWpDaLayout(snapshot.layout)
  if (kWp <= 0) return 0

  const falde = (snapshot.analisi.falde ?? []).filter(
    (f) => !snapshot.faldeRimosse.includes(f.indice),
  )
  const faldaIdx = snapshot.layout?.faldaIndice
  const falda =
    faldaIdx != null ? falde.find((f) => f.indice === faldaIdx) : falde[0]

  const lat =
    snapshot.analisi.location?.latitude ??
    falda?.center?.latitude ??
    null
  if (lat == null || !falda) {
    return stimaProduzioneAnnuakWh(kWp)
  }

  const sunshineVals = falde
    .map((f) => f.sunshineMedio)
    .filter((v): v is number => v != null && v > 0)
  const sunshineMedioTetto =
    sunshineVals.length > 0
      ? sunshineVals.reduce((a, b) => a + b, 0) / sunshineVals.length
      : null

  return stimaProduzioneFalda({
    kWp,
    latitudine: lat,
    pitchDegrees: falda.pitchDegrees,
    azimuthDegrees: falda.azimuthDegrees,
    sunshineMedio: falda.sunshineMedio,
    sunshineMedioTetto,
  }).produzioneKwh
}

export function studioCompleto(snapshot: SnapshotStudioTetto): boolean {
  if (!snapshot.analisi?.falde?.length) return false
  if (!snapshot.layout || snapshot.layout.moduli.length < 1) return false
  if (!(snapshot.consumoAnnuoKwh >= 0)) return false
  if (!(snapshot.produzioneAnnuakWh > 0)) return false
  return true
}
