import type { Coordinate, RettangoloGeo } from './tipi'

const RAGGIO_TERRA_M = 6_371_000

/** Centroide (media dei vertici) di un poligono in coordinate WGS84. */
export function centroide(vertici: readonly Coordinate[]): Coordinate {
  const n = vertici.length || 1
  return {
    latitude: vertici.reduce((s, v) => s + v.latitude, 0) / n,
    longitude: vertici.reduce((s, v) => s + v.longitude, 0) / n,
  }
}

/** Distanza geodetica approssimata (Haversine) in metri. */
export function metriFra(a: Coordinate, b: Coordinate): number {
  const φ1 = (a.latitude * Math.PI) / 180
  const φ2 = (b.latitude * Math.PI) / 180
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180
  const h =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return 2 * RAGGIO_TERRA_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formattaMetri(metri: number): string {
  if (!Number.isFinite(metri) || metri <= 0) return '—'
  if (metri < 10) return `${metri.toFixed(1).replace('.', ',')} m`
  return `${Math.round(metri)} m`
}

export interface LatoPerimetro {
  readonly da: Coordinate
  readonly a: Coordinate
  readonly meta: Coordinate
  readonly metri: number
  readonly etichetta: string
}

/** Vertici SW–SE–NE–NW di un bounding box Solar. */
export function verticiDaRettangolo(box: RettangoloGeo): Coordinate[] {
  const sw = box.sw
  const ne = box.ne
  return [
    { latitude: sw.latitude, longitude: sw.longitude },
    { latitude: sw.latitude, longitude: ne.longitude },
    { latitude: ne.latitude, longitude: ne.longitude },
    { latitude: ne.latitude, longitude: sw.longitude },
  ]
}

/** Quattro lati di un bounding box (SW–SE–NE–NW), con metri e punto medio. */
export function latiRettangolo(box: RettangoloGeo): readonly LatoPerimetro[] {
  return latiPoligono(verticiDaRettangolo(box))
}

/**
 * Lati di un poligono chiuso (ultimo → primo implicito).
 * Ignora vertici consecutivi duplicati.
 */
export function latiPoligono(
  vertici: readonly Coordinate[],
): readonly LatoPerimetro[] {
  if (vertici.length < 2) return []

  const lati: LatoPerimetro[] = []
  for (let i = 0; i < vertici.length; i++) {
    const da = vertici[i]!
    const a = vertici[(i + 1) % vertici.length]!
    const metri = metriFra(da, a)
    if (metri < 0.05) continue
    lati.push({
      da,
      a,
      meta: {
        latitude: (da.latitude + a.latitude) / 2,
        longitude: (da.longitude + a.longitude) / 2,
      },
      metri,
      etichetta: formattaMetri(metri),
    })
  }
  return lati
}

/** Perimetro (somma lati) in metri. */
export function perimetroPoligonoMetri(vertici: readonly Coordinate[]): number {
  return latiPoligono(vertici).reduce((s, l) => s + l.metri, 0)
}

/**
 * Area di un poligono in m² (shoelace su proiezione equirettangolare
 * intorno al centroide). Approssimazione adeguata a falde di tetto.
 */
export function areaPoligonoMetri2(vertici: readonly Coordinate[]): number {
  if (vertici.length < 3) return 0

  const lat0 =
    vertici.reduce((s, v) => s + v.latitude, 0) / vertici.length
  const cosLat = Math.cos((lat0 * Math.PI) / 180)
  const mPerDegLat = (Math.PI / 180) * RAGGIO_TERRA_M
  const mPerDegLng = mPerDegLat * cosLat

  const pts = vertici.map((v) => ({
    x: (v.longitude - vertici[0]!.longitude) * mPerDegLng,
    y: (v.latitude - vertici[0]!.latitude) * mPerDegLat,
  }))

  let doppia = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    doppia += a.x * b.y - b.x * a.y
  }
  return Math.abs(doppia) / 2
}

/** Confronta due poligoni entro una tolleranza (gradi). */
export function poligoniQuasiUguali(
  a: readonly Coordinate[],
  b: readonly Coordinate[],
  eps = 1e-7,
): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (
      Math.abs(a[i]!.latitude - b[i]!.latitude) > eps ||
      Math.abs(a[i]!.longitude - b[i]!.longitude) > eps
    ) {
      return false
    }
  }
  return true
}
