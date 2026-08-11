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

/** Resa specifica di default (kWh/kWp·anno), allineata ai dossier recenti (~1309–1344). */
export const RESA_SPECIFICA_DEFAULT_KWH_KWP = 1320

export function kWpDaLayout(layout: LayoutStudioFalda | null): number {
  if (!layout || layout.moduli.length === 0) return 0
  return (layout.moduli.length * layout.wattPicco) / 1000
}

export function stimaProduzioneAnnuakWh(kWp: number, resa = RESA_SPECIFICA_DEFAULT_KWH_KWP): number {
  if (kWp <= 0) return 0
  return Math.round(kWp * resa)
}

export function studioCompleto(snapshot: SnapshotStudioTetto): boolean {
  if (!snapshot.analisi?.falde?.length) return false
  if (!snapshot.layout || snapshot.layout.moduli.length < 1) return false
  if (!(snapshot.consumoAnnuoKwh >= 0)) return false
  if (!(snapshot.produzioneAnnuakWh > 0)) return false
  return true
}
