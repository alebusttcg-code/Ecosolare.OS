import {
  contaModuli,
  kWpDaLayouts,
  layoutsAttivi,
  type SnapshotStudioTetto,
} from '@/lib/domain/studio-tetto'
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
  readonly poligoniPaths: readonly string[]
  readonly moduliPaths: readonly string[]
  readonly legenda: string
  readonly fotoDataUri: string | null
}

/** Proietta tutte le falde con moduli in coordinate locali per SVG PDF. */
export function planimetriaDaStudio(
  snapshot: SnapshotStudioTetto,
): PlanimetriaPdf | null {
  const layouts = layoutsAttivi(snapshot)
  if (layouts.length === 0) return null

  const nFalde = layouts.length
  const legenda = `${contaModuli(layouts)} moduli · ${kWpDaLayouts(layouts).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kWp · ${nFalde} falda${nFalde === 1 ? '' : 'e'} (${layouts.map((l) => `F${l.faldaIndice + 1}:${l.moduli.length}`).join(', ')})`

  const anteprima = snapshot.anteprimaModuliDataUri
  if (anteprima?.startsWith('data:image/')) {
    return {
      viewBox: '0 0 960 630',
      poligoniPaths: [],
      moduliPaths: [],
      legenda,
      fotoDataUri: anteprima,
    }
  }

  const punti: Coordinate[] = []
  for (const layout of layouts) {
    const poligono = snapshot.poligoni[String(layout.faldaIndice)]
    if (poligono && poligono.length >= 3) punti.push(...poligono)
    for (const m of layout.moduli) punti.push(...m.angoli)
  }
  if (punti.length < 3) return null

  const origine = {
    latitude: punti.reduce((s, p) => s + p.latitude, 0) / punti.length,
    longitude: punti.reduce((s, p) => s + p.longitude, 0) / punti.length,
  }

  const toSvg = (c: Coordinate) => {
    const { e, n } = aMetriLocali(c, origine)
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

  const poligoniPaths: string[] = []
  const moduliPaths: string[] = []
  for (const layout of layouts) {
    const poligono = snapshot.poligoni[String(layout.faldaIndice)]
    if (poligono && poligono.length >= 3) {
      poligoniPaths.push(pathDi(poligono))
    }
    for (const m of layout.moduli) {
      moduliPaths.push(pathDi(m.angoli))
    }
  }

  return {
    viewBox: `${minX.toFixed(3)} ${minY.toFixed(3)} ${(maxX - minX).toFixed(3)} ${(maxY - minY).toFixed(3)}`,
    poligoniPaths,
    moduliPaths,
    legenda,
    fotoDataUri: null,
  }
}
