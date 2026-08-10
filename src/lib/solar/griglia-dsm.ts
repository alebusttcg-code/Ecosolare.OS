import type { Coordinate, QualitaImmagini } from './tipi'

export const DSM_INVALIDO = -9999

export interface BoundsGeo {
  readonly north: number
  readonly south: number
  readonly east: number
  readonly west: number
}

/** Griglia quote (m s.l.m.) serializzabile verso il client. */
export interface GrigliaDsm {
  readonly width: number
  readonly height: number
  /** Row-major, lunghezza width*height. Valori invaldi = DSM_INVALIDO. */
  readonly quote: readonly number[]
  readonly bounds: BoundsGeo
  readonly imageryQuality: QualitaImmagini | null
  /** Opzionale: 1 = edificio, 0 = fuori (stessa dimensione). */
  readonly mask: readonly number[] | null
}

export function quoteAt(g: GrigliaDsm, col: number, row: number): number {
  if (col < 0 || row < 0 || col >= g.width || row >= g.height) return DSM_INVALIDO
  return g.quote[row * g.width + col] ?? DSM_INVALIDO
}

export function isQuotaValida(q: number): boolean {
  return Number.isFinite(q) && q > DSM_INVALIDO + 1
}

/** Coordinate WGS84 del centro cella (col, row). */
export function coordinateCella(g: GrigliaDsm, col: number, row: number): Coordinate {
  const { north, south, east, west } = g.bounds
  const lng = west + ((col + 0.5) / g.width) * (east - west)
  const lat = north - ((row + 0.5) / g.height) * (north - south)
  return { latitude: lat, longitude: lng }
}

/** Indici cella (float) per una coordinata; fuori griglia → null. */
export function cellaDaCoordinate(
  g: GrigliaDsm,
  c: Coordinate,
): { col: number; row: number } | null {
  const { north, south, east, west } = g.bounds
  if (
    c.latitude > north ||
    c.latitude < south ||
    c.longitude < west ||
    c.longitude > east
  ) {
    return null
  }
  const col = ((c.longitude - west) / (east - west)) * g.width - 0.5
  const row = ((north - c.latitude) / (north - south)) * g.height - 0.5
  return { col, row }
}

/** Interpolazione bilineare della quota; null se campione non valido. */
export function quotaInterpolata(g: GrigliaDsm, c: Coordinate): number | null {
  const cella = cellaDaCoordinate(g, c)
  if (!cella) return null
  const c0 = Math.floor(cella.col)
  const r0 = Math.floor(cella.row)
  const c1 = c0 + 1
  const r1 = r0 + 1
  const tx = cella.col - c0
  const ty = cella.row - r0

  const q00 = quoteAt(g, c0, r0)
  const q10 = quoteAt(g, c1, r0)
  const q01 = quoteAt(g, c0, r1)
  const q11 = quoteAt(g, c1, r1)
  if (
    !isQuotaValida(q00) ||
    !isQuotaValida(q10) ||
    !isQuotaValida(q01) ||
    !isQuotaValida(q11)
  ) {
    const candidati = [q00, q10, q01, q11].filter(isQuotaValida)
    if (candidati.length === 0) return null
    return candidati.reduce((a, b) => a + b, 0) / candidati.length
  }

  const top = q00 * (1 - tx) + q10 * tx
  const bot = q01 * (1 - tx) + q11 * tx
  return top * (1 - ty) + bot * ty
}

/**
 * Riduce la griglia a maxDim lato, media dei validi per blocco.
 * Mantiene bounds originali.
 */
export function downsampleGriglia(
  g: GrigliaDsm,
  maxDim: number,
): GrigliaDsm {
  if (g.width <= maxDim && g.height <= maxDim) return g

  const scale = Math.max(g.width / maxDim, g.height / maxDim)
  const width = Math.max(1, Math.round(g.width / scale))
  const height = Math.max(1, Math.round(g.height / scale))
  const quote: number[] = new Array(width * height)
  const mask: number[] | null = g.mask ? new Array(width * height) : null

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const c0 = Math.floor((c / width) * g.width)
      const c1 = Math.min(g.width, Math.floor(((c + 1) / width) * g.width))
      const r0 = Math.floor((r / height) * g.height)
      const r1 = Math.min(g.height, Math.floor(((r + 1) / height) * g.height))
      let somma = 0
      let n = 0
      let maskSum = 0
      let maskN = 0
      for (let rr = r0; rr < r1; rr++) {
        for (let cc = c0; cc < c1; cc++) {
          const q = quoteAt(g, cc, rr)
          if (isQuotaValida(q)) {
            somma += q
            n++
          }
          if (g.mask) {
            maskSum += g.mask[rr * g.width + cc] ?? 0
            maskN++
          }
        }
      }
      quote[r * width + c] = n > 0 ? somma / n : DSM_INVALIDO
      if (mask && maskN > 0) {
        mask[r * width + c] = maskSum / maskN >= 0.5 ? 1 : 0
      }
    }
  }

  return {
    width,
    height,
    quote,
    bounds: g.bounds,
    imageryQuality: g.imageryQuality,
    mask,
  }
}
