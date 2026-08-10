import { metriFra } from './geo'
import {
  isQuotaValida,
  quoteAt,
  quotaInterpolata,
  type GrigliaDsm,
} from './griglia-dsm'
import type { Coordinate } from './tipi'

export interface PuntoSezione {
  readonly distanzaM: number
  readonly quotaM: number
  /** Quota relativa al minimo del profilo (0 in basso). */
  readonly quotaRelM: number
}

export interface ProfiloSezione {
  readonly punti: readonly PuntoSezione[]
  readonly quotaMinM: number
  readonly quotaMaxM: number
  readonly lunghezzaM: number
  /** Angolo medio del profilo (gradi), da regressione lineare. */
  readonly pitchMedioDegrees: number | null
}

export interface PuntoMesh {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface MeshFalda {
  /** Vertici in metri locali (x Est, y Nord, z quota relativa). */
  readonly vertici: readonly PuntoMesh[]
  /** Indici triangoli (triplets). */
  readonly indici: readonly number[]
}

function centroide(vertici: readonly Coordinate[]): Coordinate {
  const n = vertici.length || 1
  return {
    latitude: vertici.reduce((s, v) => s + v.latitude, 0) / n,
    longitude: vertici.reduce((s, v) => s + v.longitude, 0) / n,
  }
}

/** Sposta un punto di `metri` lungo un bearing (0 = Nord, gradi orari). */
export function spostaMetri(
  origine: Coordinate,
  bearingDegrees: number,
  metri: number,
): Coordinate {
  const R = 6_371_000
  const δ = metri / R
  const θ = (bearingDegrees * Math.PI) / 180
  const φ1 = (origine.latitude * Math.PI) / 180
  const λ1 = (origine.longitude * Math.PI) / 180
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  )
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    )
  return {
    latitude: (φ2 * 180) / Math.PI,
    longitude: (λ2 * 180) / Math.PI,
  }
}

/** Proiezione locale equirettangolare (metri Est/Nord dal centro). */
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

function puntoInPoligono(
  punto: Coordinate,
  poligono: readonly Coordinate[],
): boolean {
  if (poligono.length < 3) return false
  let inside = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const xi = poligono[i]!.longitude
    const yi = poligono[i]!.latitude
    const xj = poligono[j]!.longitude
    const yj = poligono[j]!.latitude
    const intersect =
      yi > punto.latitude !== yj > punto.latitude &&
      punto.longitude <
        ((xj - xi) * (punto.latitude - yi)) / (yj - yi + 1e-15) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function estensioneSuAsse(
  vertici: readonly Coordinate[],
  centro: Coordinate,
  azimuthDegrees: number,
): number {
  const dir = (azimuthDegrees * Math.PI) / 180
  const ux = Math.sin(dir)
  const uy = Math.cos(dir)
  let min = 0
  let max = 0
  for (const v of vertici) {
    const { e, n } = aMetriLocali(v, centro)
    const t = e * ux + n * uy
    min = Math.min(min, t)
    max = Math.max(max, t)
  }
  return Math.max(2, max - min)
}

/**
 * Sezione DSM lungo la linea di massima pendenza (azimuth Solar)
 * attraverso il centroide del poligono editato.
 */
export function profiloSezioneDsm(
  griglia: GrigliaDsm,
  poligono: readonly Coordinate[],
  azimuthDegrees: number,
  campioni = 48,
): ProfiloSezione | null {
  if (poligono.length < 3) return null
  const centro = centroide(poligono)
  const lunghezza = estensioneSuAsse(poligono, centro, azimuthDegrees)
  const metà = lunghezza / 2
  const grezzi: { distanzaM: number; quotaM: number }[] = []

  for (let i = 0; i < campioni; i++) {
    const t = -metà + (lunghezza * i) / Math.max(1, campioni - 1)
    const p = spostaMetri(centro, azimuthDegrees, t)
    if (!puntoInPoligono(p, poligono)) continue
    const q = quotaInterpolata(griglia, p)
    if (q == null) continue
    grezzi.push({ distanzaM: t + metà, quotaM: q })
  }

  if (grezzi.length < 2) return null

  const quotaMinM = Math.min(...grezzi.map((p) => p.quotaM))
  const quotaMaxM = Math.max(...grezzi.map((p) => p.quotaM))
  const punti: PuntoSezione[] = grezzi.map((p) => ({
    ...p,
    quotaRelM: p.quotaM - quotaMinM,
  }))

  // Regressione lineare quota ~ distanza → pitch.
  const n = punti.length
  const meanX = punti.reduce((s, p) => s + p.distanzaM, 0) / n
  const meanY = punti.reduce((s, p) => s + p.quotaM, 0) / n
  let num = 0
  let den = 0
  for (const p of punti) {
    num += (p.distanzaM - meanX) * (p.quotaM - meanY)
    den += (p.distanzaM - meanX) ** 2
  }
  let pitchMedioDegrees: number | null = null
  if (den > 1e-6) {
    const slope = num / den
    pitchMedioDegrees = (Math.atan(Math.abs(slope)) * 180) / Math.PI
  }

  return {
    punti,
    quotaMinM,
    quotaMaxM,
    lunghezzaM: metriFra(
      spostaMetri(centro, azimuthDegrees, -metà),
      spostaMetri(centro, azimuthDegrees, metà),
    ),
    pitchMedioDegrees,
  }
}

/**
 * Mesh a griglia dei punti DSM dentro il poligono (quote relative).
 */
export function meshFaldaDaDsm(
  griglia: GrigliaDsm,
  poligono: readonly Coordinate[],
  passoCelle = 1,
): MeshFalda | null {
  if (poligono.length < 3) return null
  const centro = centroide(poligono)
  const mappa = new Map<string, number>()
  const vertici: PuntoMesh[] = []
  const quoteAssolute: number[] = []

  for (let r = 0; r < griglia.height; r += passoCelle) {
    for (let c = 0; c < griglia.width; c += passoCelle) {
      if (griglia.mask && (griglia.mask[r * griglia.width + c] ?? 0) < 0.5) {
        // Preferisci mask se presente, ma richiedi comunque poligono.
      }
      const q = quoteAt(griglia, c, r)
      if (!isQuotaValida(q)) continue
      const geo = {
        latitude:
          griglia.bounds.north -
          ((r + 0.5) / griglia.height) *
            (griglia.bounds.north - griglia.bounds.south),
        longitude:
          griglia.bounds.west +
          ((c + 0.5) / griglia.width) *
            (griglia.bounds.east - griglia.bounds.west),
      }
      if (!puntoInPoligono(geo, poligono)) continue
      const { e, n } = aMetriLocali(geo, centro)
      const idx = vertici.length
      mappa.set(`${c},${r}`, idx)
      quoteAssolute.push(q)
      vertici.push({ x: e, y: n, z: q })
    }
  }

  if (vertici.length < 3) return null

  const zMin = Math.min(...quoteAssolute)
  const normalizzati = vertici.map((v) => ({
    x: v.x,
    y: v.y,
    z: v.z - zMin,
  }))

  const indici: number[] = []
  for (let r = 0; r < griglia.height - passoCelle; r += passoCelle) {
    for (let c = 0; c < griglia.width - passoCelle; c += passoCelle) {
      const a = mappa.get(`${c},${r}`)
      const b = mappa.get(`${c + passoCelle},${r}`)
      const d = mappa.get(`${c},${r + passoCelle}`)
      const e = mappa.get(`${c + passoCelle},${r + passoCelle}`)
      if (a == null || b == null || d == null || e == null) continue
      indici.push(a, b, e, a, e, d)
    }
  }

  if (indici.length < 3) {
    // Fallback: fan triangulation dal primo vertice (convesso-ish).
    for (let i = 1; i < normalizzati.length - 1; i++) {
      indici.push(0, i, i + 1)
    }
  }

  return { vertici: normalizzati, indici }
}
