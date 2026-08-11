import type { SnapshotStudioTetto } from '@/lib/domain/studio-tetto'
import type { Coordinate } from '@/lib/solar'

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

export type PlanimetriaPdf = {
  readonly viewBox: string
  readonly poligonoPath: string
  readonly moduliPaths: readonly string[]
  readonly legenda: string
}

/** Proietta poligono falda + moduli in coordinate locali per SVG PDF. */
export function planimetriaDaStudio(
  snapshot: SnapshotStudioTetto,
): PlanimetriaPdf | null {
  const layout = snapshot.layout
  if (!layout || layout.moduli.length === 0) return null

  const chiave = String(layout.faldaIndice)
  const poligono = snapshot.poligoni[chiave]
  const punti: Coordinate[] = []
  if (poligono && poligono.length >= 3) punti.push(...poligono)
  for (const m of layout.moduli) {
    punti.push(...m.angoli)
  }
  if (punti.length < 3) return null

  const origine = {
    latitude: punti.reduce((s, p) => s + p.latitude, 0) / punti.length,
    longitude: punti.reduce((s, p) => s + p.longitude, 0) / punti.length,
  }

  const localizza = (c: Coordinate) => aMetriLocali(c, origine)
  // SVG: x = est, y = −nord (nord in alto)
  const toSvg = (c: Coordinate) => {
    const { e, n } = localizza(c)
    return { x: e, y: -n }
  }

  const tutti = punti.map(toSvg)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of tutti) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const pad = Math.max(0.8, (maxX - minX + maxY - minY) * 0.06)
  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad

  const pathDi = (coords: readonly Coordinate[]) => {
    if (coords.length === 0) return ''
    const pts = coords.map(toSvg)
    return (
      pts
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`)
        .join(' ') + ' Z'
    )
  }

  const poligonoPath =
    poligono && poligono.length >= 3 ? pathDi(poligono) : ''
  const moduliPaths = layout.moduli.map((m) => pathDi(m.angoli))

  return {
    viewBox: `${minX.toFixed(3)} ${minY.toFixed(3)} ${(maxX - minX).toFixed(3)} ${(maxY - minY).toFixed(3)}`,
    poligonoPath,
    moduliPaths,
    legenda: `${layout.moduli.length} moduli · ${((layout.moduli.length * layout.wattPicco) / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kWp · falda ${layout.faldaIndice + 1}`,
  }
}
