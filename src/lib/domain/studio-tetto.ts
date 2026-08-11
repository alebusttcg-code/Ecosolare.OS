import { stimaProduzioneFalda } from '@/lib/domain/produzione-fv'
import type { AnalisiTetto, Coordinate, RettangoloModulo } from '@/lib/solar'

/**
 * Snapshot persistito di uno studio tetto (Sviluppo → CRM).
 *
 * I moduli possono stare su più falde: `layouts` è l’elenco per falda.
 * Produzione = somma delle stime per-falda (inclinazione/esposizione/zona).
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
  /** Layout moduli, uno per falda coinvolta. */
  readonly layouts: readonly LayoutStudioFalda[]
  /**
   * Legacy: un solo layout. Se presente in payload vecchi viene fuso in
   * `layouts` da `layoutsDelloStudio`.
   */
  readonly layout?: LayoutStudioFalda | null
  readonly consumoAnnuoKwh: number
  readonly produzioneAnnuakWh: number
  readonly tariffaImportEurKwh: number
  readonly tariffaExportEurKwh: number
  readonly frazioneAutoconsumo?: number
}

/**
 * Fallback se mancano geometria/posizione.
 * Preferire sempre `stimaProduzioneDaStudio`.
 */
export const RESA_SPECIFICA_DEFAULT_KWH_KWP = 1320

/** Unifica `layouts` e l’eventuale `layout` legacy (senza filtrare le rimosse). */
export function layoutsDelloStudio(
  snapshot:
    | {
        readonly layouts?: readonly LayoutStudioFalda[] | null
        readonly layout?: LayoutStudioFalda | null
      }
    | null
    | undefined,
): readonly LayoutStudioFalda[] {
  if (!snapshot) return []
  const daArray = (snapshot.layouts ?? []).filter((l) => l.moduli.length > 0)
  if (daArray.length > 0) {
    const mappa = new Map<number, LayoutStudioFalda>()
    for (const l of daArray) mappa.set(l.faldaIndice, l)
    return [...mappa.values()].sort((a, b) => a.faldaIndice - b.faldaIndice)
  }
  if (snapshot.layout && snapshot.layout.moduli.length > 0) {
    return [snapshot.layout]
  }
  return []
}

/**
 * Layout su falde ancora presenti nello studio (esclude `faldeRimosse`).
 * Usare per kWp, produzione, PDF e completamento.
 */
export function layoutsAttivi(
  snapshot: {
    readonly layouts?: readonly LayoutStudioFalda[] | null
    readonly layout?: LayoutStudioFalda | null
    readonly faldeRimosse?: readonly number[] | null
  } | null | undefined,
): readonly LayoutStudioFalda[] {
  const rimossi = new Set(snapshot?.faldeRimosse ?? [])
  return layoutsDelloStudio(snapshot).filter((l) => !rimossi.has(l.faldaIndice))
}

export function kWpDaLayout(layout: LayoutStudioFalda | null | undefined): number {
  if (!layout || layout.moduli.length === 0) return 0
  return (layout.moduli.length * layout.wattPicco) / 1000
}

export function kWpDaLayouts(
  layouts: readonly LayoutStudioFalda[] | null | undefined,
): number {
  if (!layouts?.length) return 0
  return layouts.reduce((s, l) => s + kWpDaLayout(l), 0)
}

export function contaModuli(
  layouts: readonly LayoutStudioFalda[] | null | undefined,
): number {
  if (!layouts?.length) return 0
  return layouts.reduce((s, l) => s + l.moduli.length, 0)
}

export function stimaProduzioneAnnuakWh(
  kWp: number,
  resa = RESA_SPECIFICA_DEFAULT_KWH_KWP,
): number {
  if (kWp <= 0) return 0
  return Math.round(kWp * resa)
}

/**
 * Produzione annua sommando ogni falda attiva con i propri moduli.
 * Layout su falde rimosse o assenti dall’analisi non contano.
 */
export function stimaProduzioneDaStudio(
  snapshot: Pick<
    SnapshotStudioTetto,
    'analisi' | 'layouts' | 'layout' | 'faldeRimosse'
  >,
): number {
  const layouts = layoutsAttivi(snapshot)
  if (layouts.length === 0) return 0

  const falde = (snapshot.analisi.falde ?? []).filter(
    (f) => !snapshot.faldeRimosse.includes(f.indice),
  )
  const latFallback = snapshot.analisi.location?.latitude ?? null

  const sunshineVals = falde
    .map((f) => f.sunshineMedio)
    .filter((v): v is number => v != null && v > 0)
  const sunshineMedioTetto =
    sunshineVals.length > 0
      ? sunshineVals.reduce((a, b) => a + b, 0) / sunshineVals.length
      : null

  let totale = 0
  for (const layout of layouts) {
    const kWp = kWpDaLayout(layout)
    if (kWp <= 0) continue
    const falda = falde.find((f) => f.indice === layout.faldaIndice)
    // Falda non più nell’analisi: non inventare kWh (evita orfani).
    if (!falda) continue
    const lat = falda.center?.latitude ?? latFallback
    if (lat == null) continue

    totale += stimaProduzioneFalda({
      kWp,
      latitudine: lat,
      pitchDegrees: falda.pitchDegrees,
      azimuthDegrees: falda.azimuthDegrees,
      sunshineMedio: falda.sunshineMedio,
      sunshineMedioTetto,
    }).produzioneKwh
  }
  return Math.round(totale)
}

export function studioCompleto(snapshot: SnapshotStudioTetto): boolean {
  if (!snapshot.analisi?.falde?.length) return false
  if (layoutsAttivi(snapshot).length < 1) return false
  if (!(snapshot.consumoAnnuoKwh >= 0)) return false
  if (!(snapshot.produzioneAnnuakWh > 0)) return false
  return true
}
