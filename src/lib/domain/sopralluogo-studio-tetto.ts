import type { Risposte } from '@/lib/domain/questionnaire'
import {
  kWpDaLayouts,
  layoutsAttivi,
  type SnapshotStudioTetto,
} from '@/lib/domain/studio-tetto'
import { areaPoligonoMetri2 } from '@/lib/solar'
import type { FaldaTetto } from '@/lib/solar'

/**
 * Precompilazione Copertura (e potenza) del sopralluogo dallo studio tetto Solar.
 * Solo geometria affidabile: manto, stato, amianto e foto restano al rilievo.
 */

/** Campi che «Riallinea geometria» può sovrascrivere. */
export const CAMPI_GEOMETRIA_STUDIO = [
  'tipo_tetto',
  'orientamento',
  'inclinazione',
  'superficie_utile',
  'potenza_stimata',
] as const

export function orientamentoDaAzimuth(gradi: number): string {
  const a = ((gradi % 360) + 360) % 360
  if (a >= 337.5 || a < 22.5) return 'nord'
  if (a < 67.5) return 'est' // NE → est (opzione assente nel form)
  if (a < 112.5) return 'est'
  if (a < 157.5) return 'sud_est'
  if (a < 202.5) return 'sud'
  if (a < 247.5) return 'sud_ovest'
  if (a < 292.5) return 'ovest'
  return 'nord' // NO
}

function faldeAttive(snapshot: SnapshotStudioTetto): FaldaTetto[] {
  const rimossi = new Set(snapshot.faldeRimosse ?? [])
  return (snapshot.analisi.falde ?? []).filter((f) => !rimossi.has(f.indice))
}

/** Falda con moduli, altrimenti la più grande. */
export function faldaRiferimento(
  snapshot: SnapshotStudioTetto,
): FaldaTetto | null {
  const falde = faldeAttive(snapshot)
  if (falde.length === 0) return null
  const layouts = layoutsAttivi(snapshot)
  for (const L of layouts) {
    const f = falde.find((x) => x.indice === L.faldaIndice)
    if (f) return f
  }
  return [...falde].sort(
    (a, b) => (b.areaMeters2 ?? 0) - (a.areaMeters2 ?? 0),
  )[0]!
}

function tipoTettoDaFalde(falde: readonly FaldaTetto[]): string | null {
  if (falde.length === 0) return null
  const inclinate = falde.filter((f) => (f.pitchDegrees ?? 0) >= 5)
  if (inclinate.length === 0) return 'piano'
  if (inclinate.length === 1 && falde.length === 1) return 'falda'
  if (inclinate.length >= 2) return 'misto'
  return 'falda'
}

function superficieUtileMq(snapshot: SnapshotStudioTetto): number | null {
  const falde = faldeAttive(snapshot)
  if (falde.length === 0) return null
  let tot = 0
  let n = 0
  for (const f of falde) {
    const poli = snapshot.poligoni[String(f.indice)]
    if (poli && poli.length >= 3) {
      tot += areaPoligonoMetri2(poli)
      n++
      continue
    }
    if (f.areaMeters2 != null && f.areaMeters2 > 0) {
      tot += f.areaMeters2
      n++
    }
  }
  if (n === 0) {
    const whole = snapshot.analisi.wholeRoofAreaMeters2
    return whole != null && whole > 0 ? Math.round(whole * 10) / 10 : null
  }
  return Math.round(tot * 10) / 10
}

/** Valori iniziali dal payload studio (solo se completi/coerenti). */
export function risposteDaStudioTetto(
  snapshot: SnapshotStudioTetto | null | undefined,
): Risposte {
  if (!snapshot?.analisi?.falde?.length) return {}
  const falde = faldeAttive(snapshot)
  if (falde.length === 0) return {}

  const out: Record<string, string | number | boolean> = {}
  const tipo = tipoTettoDaFalde(falde)
  if (tipo) out.tipo_tetto = tipo

  const rif = faldaRiferimento(snapshot)
  if (rif && tipo !== 'piano') {
    out.orientamento = orientamentoDaAzimuth(rif.azimuthDegrees)
    out.inclinazione = Math.round(rif.pitchDegrees)
  } else if (rif && tipo === 'piano') {
    out.inclinazione = Math.round(rif.pitchDegrees)
  }

  const superficie = superficieUtileMq(snapshot)
  if (superficie != null && superficie > 0) {
    out.superficie_utile = superficie
  }

  const kWp = kWpDaLayouts(layoutsAttivi(snapshot))
  if (kWp > 0) {
    out.potenza_stimata = Math.round(kWp * 100) / 100
  }

  return out
}

export function haDatiStudioPerSopralluogo(
  snapshot: SnapshotStudioTetto | null | undefined,
): boolean {
  return Object.keys(risposteDaStudioTetto(snapshot)).length > 0
}
