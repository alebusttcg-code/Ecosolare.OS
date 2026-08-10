import type { Coordinate, RettangoloGeo } from './tipi'

const RAGGIO_TERRA_M = 6_371_000

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

/** Quattro lati di un bounding box (SW–SE–NE–NW), con metri e punto medio. */
export function latiRettangolo(box: RettangoloGeo): readonly LatoPerimetro[] {
  const sw = box.sw
  const ne = box.ne
  const se: Coordinate = { latitude: sw.latitude, longitude: ne.longitude }
  const nw: Coordinate = { latitude: ne.latitude, longitude: sw.longitude }

  const lati: [Coordinate, Coordinate][] = [
    [sw, se],
    [se, ne],
    [ne, nw],
    [nw, sw],
  ]

  return lati.map(([da, a]) => {
    const metri = metriFra(da, a)
    return {
      da,
      a,
      meta: {
        latitude: (da.latitude + a.latitude) / 2,
        longitude: (da.longitude + a.longitude) / 2,
      },
      metri,
      etichetta: formattaMetri(metri),
    }
  })
}
