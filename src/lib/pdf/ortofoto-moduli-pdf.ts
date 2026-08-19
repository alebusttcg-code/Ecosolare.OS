import {
  contaModuli,
  kWpDaLayouts,
  layoutsAttivi,
  type SnapshotStudioTetto,
} from '@/lib/domain/studio-tetto'
import type { PlanimetriaPdfDto } from '@/lib/pdf/dati-preventivo'
import { geoAPixel, type Coordinate } from '@/lib/solar'
import { fotoTettoPng } from '@/lib/solar/foto-tetto'

/** Allineato all’editor moduli (Static Maps scale=2). */
export const ORTOFOTO_CSS_W = 640
export const ORTOFOTO_CSS_H = 640
export const ORTOFOTO_SCALE = 2
export const ORTOFOTO_PIXEL_W = ORTOFOTO_CSS_W * ORTOFOTO_SCALE
export const ORTOFOTO_PIXEL_H = ORTOFOTO_CSS_H * ORTOFOTO_SCALE
const ZOOM_MIN = 15
const ZOOM_MAX = 21
/** Margine rispetto al bordo dell’immagine (frazione). Più stretto = tetto più grande in PDF. */
const MARGINE = 0.045

export type InquadraturaOrtofoto = {
  readonly centro: Coordinate
  readonly zoom: number
  readonly pixelW: number
  readonly pixelH: number
  readonly scale: number
}

/** Punti geografici rilevanti (poligoni falda + angoli moduli). */
export function puntiStudioPerOrtofoto(
  snapshot: SnapshotStudioTetto,
): Coordinate[] {
  const layouts = layoutsAttivi(snapshot)
  const punti: Coordinate[] = []
  for (const layout of layouts) {
    const poligono = snapshot.poligoni[String(layout.faldaIndice)]
    if (poligono && poligono.length >= 3) punti.push(...poligono)
    for (const m of layout.moduli) punti.push(...m.angoli)
  }
  return punti
}

export function centroDaPunti(punti: readonly Coordinate[]): Coordinate | null {
  if (punti.length === 0) return null
  return {
    latitude: punti.reduce((s, p) => s + p.latitude, 0) / punti.length,
    longitude: punti.reduce((s, p) => s + p.longitude, 0) / punti.length,
  }
}

/**
 * Zoom massimo (15–21) che contiene tutti i punti nel frame con margine.
 * Esportata per i test (nessuna rete).
 */
export function zoomCheContienePunti(
  punti: readonly Coordinate[],
  centro: Coordinate,
  pixelW = ORTOFOTO_PIXEL_W,
  pixelH = ORTOFOTO_PIXEL_H,
  scale = ORTOFOTO_SCALE,
): number {
  const mx = pixelW * MARGINE
  const my = pixelH * MARGINE
  for (let zoom = ZOOM_MAX; zoom >= ZOOM_MIN; zoom--) {
    const ok = punti.every((p) => {
      const { x, y } = geoAPixel(p, centro, zoom, scale, pixelW, pixelH)
      return x >= mx && x <= pixelW - mx && y >= my && y <= pixelH - my
    })
    if (ok) return zoom
  }
  return ZOOM_MIN
}

export function inquadraturaDaStudio(
  snapshot: SnapshotStudioTetto,
): InquadraturaOrtofoto | null {
  const punti = puntiStudioPerOrtofoto(snapshot)
  if (punti.length < 1) return null
  const centro = centroDaPunti(punti)
  if (!centro) return null
  const zoom = zoomCheContienePunti(punti, centro)
  return {
    centro,
    zoom,
    pixelW: ORTOFOTO_PIXEL_W,
    pixelH: ORTOFOTO_PIXEL_H,
    scale: ORTOFOTO_SCALE,
  }
}

function pathPixel(
  coords: readonly Coordinate[],
  centro: Coordinate,
  zoom: number,
  scale: number,
  pixelW: number,
  pixelH: number,
): string {
  if (coords.length === 0) return ''
  const pts = coords.map((c) =>
    geoAPixel(c, centro, zoom, scale, pixelW, pixelH),
  )
  return (
    pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ') + ' Z'
  )
}

function legendaStudio(snapshot: SnapshotStudioTetto): string {
  const layouts = layoutsAttivi(snapshot)
  const nFalde = layouts.length
  return `${contaModuli(layouts)} moduli · ${kWpDaLayouts(layouts).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kWp · ${nFalde} falda${nFalde === 1 ? '' : 'e'} (${layouts.map((l) => `F${l.faldaIndice + 1}:${l.moduli.length}`).join(', ')})`
}

/**
 * Aggiunge l'ortofoto pulita e i path in pixel. Se è già presente la cattura
 * dell'editor con i moduli, la conserva come vista progetto; in caso contrario
 * usa l'ortofoto come base e lascia che il renderer sovrapponga i moduli.
 */
export async function arricchisciPlanimetriaConOrtofoto(
  base: PlanimetriaPdfDto,
  snapshot: SnapshotStudioTetto,
  apiKey: string | null | undefined,
): Promise<PlanimetriaPdfDto> {
  const chiave = apiKey?.trim()
  if (!chiave) return base

  const inquadratura = inquadraturaDaStudio(snapshot)
  if (!inquadratura) return base

  // Foto aerea da Google Solar (la Static Maps satellite è bloccata in UE dal
  // 2025). Ricampionata nella stessa cornice della proiezione qui sotto, quindi
  // i path dei moduli si allineano per costruzione.
  const png = await fotoTettoPng({
    centro: inquadratura.centro,
    zoom: inquadratura.zoom,
    scale: ORTOFOTO_SCALE,
    widthBase: ORTOFOTO_CSS_W,
    heightBase: ORTOFOTO_CSS_H,
    apiKey: chiave,
  })
  if (!png) return base

  const { centro, zoom, scale } = inquadratura
  const pixelW = ORTOFOTO_PIXEL_W
  const pixelH = ORTOFOTO_PIXEL_H
  const layouts = layoutsAttivi(snapshot)

  const poligoniPaths: string[] = []
  const moduliPaths: string[] = []
  for (const layout of layouts) {
    const poligono = snapshot.poligoni[String(layout.faldaIndice)]
    if (poligono && poligono.length >= 3) {
      poligoniPaths.push(
        pathPixel(poligono, centro, zoom, scale, pixelW, pixelH),
      )
    }
    for (const m of layout.moduli) {
      moduliPaths.push(
        pathPixel(m.angoli, centro, zoom, scale, pixelW, pixelH),
      )
    }
  }

  const fotoSenzaModuliDataUri = `data:image/png;base64,${png.toString('base64')}`
  const conservaAnteprimaEditor =
    base.fotoConModuliIntegrati === true && Boolean(base.fotoDataUri)

  return {
    viewBox: `0 0 ${pixelW} ${pixelH}`,
    poligoniPaths,
    moduliPaths,
    legenda: base.legenda || legendaStudio(snapshot),
    fotoDataUri: conservaAnteprimaEditor
      ? base.fotoDataUri
      : fotoSenzaModuliDataUri,
    fotoSenzaModuliDataUri,
    fotoConModuliIntegrati: conservaAnteprimaEditor,
    fotoPixelW: pixelW,
    fotoPixelH: pixelH,
    focusXPct: base.focusXPct ?? snapshot.focusTettoXPct ?? 50,
    focusYPct: base.focusYPct ?? snapshot.focusTettoYPct ?? 50,
  }
}
