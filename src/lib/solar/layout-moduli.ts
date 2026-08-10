import type { Coordinate } from './tipi'
import type { FormatoModuloFv } from './moduli-fv'

export interface RettangoloModulo {
  /** Quattro angoli WGS84 in senso orario. */
  readonly angoli: readonly [Coordinate, Coordinate, Coordinate, Coordinate]
  readonly centro: Coordinate
}

export interface LayoutModuli {
  readonly moduli: readonly RettangoloModulo[]
  readonly richiesti: number
  readonly collocati: number
  readonly kWp: number
  readonly areaModuliM2: number
}

function centroide(vertici: readonly Coordinate[]): Coordinate {
  const n = vertici.length || 1
  return {
    latitude: vertici.reduce((s, v) => s + v.latitude, 0) / n,
    longitude: vertici.reduce((s, v) => s + v.longitude, 0) / n,
  }
}

function aMetriLocali(
  c: Coordinate,
  origine: Coordinate,
): { e: number; n: number } {
  const mPerDegLat = (Math.PI / 180) * 6_371_000
  const mPerDegLng =
    mPerDegLat * Math.cos((origine.latitude * Math.PI) / 180)
  return {
    e: (c.longitude - origine.longitude) * mPerDegLng,
    n: (c.latitude - origine.latitude) * mPerDegLat,
  }
}

function daMetriLocali(
  e: number,
  n: number,
  origine: Coordinate,
): Coordinate {
  const mPerDegLat = (Math.PI / 180) * 6_371_000
  const mPerDegLng =
    mPerDegLat * Math.cos((origine.latitude * Math.PI) / 180)
  return {
    latitude: origine.latitude + n / mPerDegLat,
    longitude: origine.longitude + e / mPerDegLng,
  }
}

function puntoInPoligonoUV(
  u: number,
  v: number,
  poli: readonly { u: number; v: number }[],
): boolean {
  let inside = false
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const xi = poli[i]!.u
    const yi = poli[i]!.v
    const xj = poli[j]!.u
    const yj = poli[j]!.v
    const intersect =
      yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi + 1e-15) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function rettangoloInPoligonoUV(
  cu: number,
  cv: number,
  w: number,
  h: number,
  poli: readonly { u: number; v: number }[],
): boolean {
  const hw = w / 2
  const hh = h / 2
  const corners = [
    { u: cu - hw, v: cv - hh },
    { u: cu + hw, v: cv - hh },
    { u: cu + hw, v: cv + hh },
    { u: cu - hw, v: cv + hh },
  ]
  return corners.every((c) => puntoInPoligonoUV(c.u, c.v, poli))
}

/**
 * Dispone fino a `quantita` moduli nella falda, allineati all’azimuth
 * (lato lungo lungo la gronda ≈ azimuth+90° se landscape).
 */
export function layoutModuliInFalda(opzioni: {
  poligono: readonly Coordinate[]
  formato: FormatoModuloFv
  quantita: number
  /** Azimuth falda (0 = Nord). */
  azimuthDegrees: number
  /** true = lato lungo lungo la gronda (tipico). */
  landscape?: boolean
  gapM?: number
}): LayoutModuli {
  const {
    poligono,
    formato,
    quantita,
    azimuthDegrees,
    landscape = true,
    gapM = 0.03,
  } = opzioni

  const richiesti = Math.max(0, Math.min(500, Math.floor(quantita)))
  if (poligono.length < 3 || richiesti === 0) {
    return {
      moduli: [],
      richiesti,
      collocati: 0,
      kWp: 0,
      areaModuliM2: 0,
    }
  }

  const origine = centroide(poligono)
  // u = lungo gronda (azimuth+90), v = salita falda (azimuth)
  const θ = ((azimuthDegrees + 90) * Math.PI) / 180
  const cosA = Math.cos(θ)
  const sinA = Math.sin(θ)

  const en = poligono.map((p) => aMetriLocali(p, origine))
  const poliUV = en.map(({ e, n }) => ({
    u: e * cosA + n * sinA,
    v: -e * sinA + n * cosA,
  }))

  const minU = Math.min(...poliUV.map((p) => p.u))
  const maxU = Math.max(...poliUV.map((p) => p.u))
  const minV = Math.min(...poliUV.map((p) => p.v))
  const maxV = Math.max(...poliUV.map((p) => p.v))

  const w = landscape ? formato.lunghezzaM : formato.larghezzaM
  const h = landscape ? formato.larghezzaM : formato.lunghezzaM
  const stepU = w + gapM
  const stepV = h + gapM

  const moduli: RettangoloModulo[] = []

  for (let v = minV + h / 2; v <= maxV - h / 2 + 1e-6; v += stepV) {
    for (let u = minU + w / 2; u <= maxU - w / 2 + 1e-6; u += stepU) {
      if (moduli.length >= richiesti) break
      if (!rettangoloInPoligonoUV(u, v, w, h, poliUV)) continue

      const hw = w / 2
      const hh = h / 2
      const cornersUV = [
        { u: u - hw, v: v - hh },
        { u: u + hw, v: v - hh },
        { u: u + hw, v: v + hh },
        { u: u - hw, v: v + hh },
      ]

      const angoli = cornersUV.map((c) => {
        // Inverso: e/n da u/v
        const e = c.u * cosA - c.v * sinA
        const n = c.u * sinA + c.v * cosA
        return daMetriLocali(e, n, origine)
      }) as [Coordinate, Coordinate, Coordinate, Coordinate]

      const ce = u * cosA - v * sinA
      const cn = u * sinA + v * cosA
      moduli.push({
        angoli,
        centro: daMetriLocali(ce, cn, origine),
      })
    }
    if (moduli.length >= richiesti) break
  }

  const areaUno = formato.larghezzaM * formato.lunghezzaM
  return {
    moduli,
    richiesti,
    collocati: moduli.length,
    kWp: (moduli.length * formato.wattPicco) / 1000,
    areaModuliM2: moduli.length * areaUno,
  }
}

/** Metri/pixel per Static Maps (immagine già a `scale`). */
export function metriPerPixelStaticMap(
  latitude: number,
  zoom: number,
  scale: number,
): number {
  return (
    (156_543.03392 * Math.cos((latitude * Math.PI) / 180)) /
    Math.pow(2, zoom) /
    scale
  )
}

export function geoAPixel(
  c: Coordinate,
  centro: Coordinate,
  zoom: number,
  scale: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const mpp = metriPerPixelStaticMap(centro.latitude, zoom, scale)
  const { e, n } = aMetriLocali(c, centro)
  return {
    x: canvasW / 2 + e / mpp,
    y: canvasH / 2 - n / mpp,
  }
}
