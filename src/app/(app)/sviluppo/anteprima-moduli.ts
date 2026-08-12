import { geoAPixel, type Coordinate, type RettangoloModulo } from '@/lib/solar'

/** Allineato a `/api/sviluppo/mappa` (640×420 CSS, scale 2). */
const MAP_CSS_W = 640
const MAP_CSS_H = 420
const MAP_SCALE = 2
const MAP_PIXEL_W = MAP_CSS_W * MAP_SCALE
const MAP_PIXEL_H = MAP_CSS_H * MAP_SCALE
const ZOOM_MIN = 15
const ZOOM_MAX = 21
const MARGINE = 0.06

/** Canvas esportato per il PDF (stesso aspect della static map). */
export const ANTEPRIMA_W = 960
export const ANTEPRIMA_H = Math.round((ANTEPRIMA_W * MAP_CSS_H) / MAP_CSS_W)

export type InputAnteprimaModuli = {
  readonly poligoni: Readonly<Record<string, readonly Coordinate[]>>
  readonly layouts: readonly {
    readonly faldaIndice: number
    readonly moduli: readonly RettangoloModulo[]
  }[]
}

function puntiDaInput(input: InputAnteprimaModuli): Coordinate[] {
  const punti: Coordinate[] = []
  for (const layout of input.layouts) {
    if (layout.moduli.length === 0) continue
    const poligono = input.poligoni[String(layout.faldaIndice)]
    if (poligono && poligono.length >= 3) punti.push(...poligono)
    for (const m of layout.moduli) punti.push(...m.angoli)
  }
  return punti
}

function centroDaPunti(punti: readonly Coordinate[]): Coordinate {
  return {
    latitude: punti.reduce((s, p) => s + p.latitude, 0) / punti.length,
    longitude: punti.reduce((s, p) => s + p.longitude, 0) / punti.length,
  }
}

/** Zoom massimo che contiene tutti i punti nel frame Static Maps. */
export function zoomAnteprimaModuli(
  punti: readonly Coordinate[],
  centro: Coordinate,
): number {
  const mx = MAP_PIXEL_W * MARGINE
  const my = MAP_PIXEL_H * MARGINE
  for (let zoom = ZOOM_MAX; zoom >= ZOOM_MIN; zoom--) {
    const ok = punti.every((p) => {
      const { x, y } = geoAPixel(
        p,
        centro,
        zoom,
        MAP_SCALE,
        MAP_PIXEL_W,
        MAP_PIXEL_H,
      )
      return x >= mx && x <= MAP_PIXEL_W - mx && y >= my && y <= MAP_PIXEL_H - my
    })
    if (ok) return zoom
  }
  return ZOOM_MIN
}

function caricaImmagine(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Mappa satellitare non disponibile'))
    img.src = url
  })
}

export type AnteprimeTetto = {
  /** La stessa ortofoto, con la stessa inquadratura, prima del disegno dei moduli. */
  readonly senzaModuliDataUri: string
  /** Ortofoto con falde e moduli disegnati dall’editor. */
  readonly conModuliDataUri: string
}

/**
 * Cattura la coppia usata nel preventivo: tetto esistente e progetto FV.
 * Le due immagini nascono dallo stesso canvas e hanno quindi ritaglio,
 * risoluzione e punto di vista perfettamente identici.
 */
export async function catturaAnteprimeTetto(
  input: InputAnteprimaModuli,
): Promise<AnteprimeTetto | null> {
  if (typeof document === 'undefined') return null

  const punti = puntiDaInput(input)
  if (punti.length < 3) return null

  const centro = centroDaPunti(punti)
  const zoom = zoomAnteprimaModuli(punti, centro)
  const url = `/api/sviluppo/mappa?lat=${centro.latitude}&lng=${centro.longitude}&zoom=${zoom}&marker=0`

  let img: HTMLImageElement
  try {
    img = await caricaImmagine(url)
  } catch {
    return null
  }
  if (!img.complete || !(img.naturalWidth > 0)) return null

  const canvas = document.createElement('canvas')
  canvas.width = ANTEPRIMA_W
  canvas.height = ANTEPRIMA_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const w = ANTEPRIMA_W
  const h = ANTEPRIMA_H
  const mapW = img.naturalWidth
  const mapH = img.naturalHeight
  // Cover come l’editor moduli.
  const scale = Math.max(w / mapW, h / mapH)
  const dw = mapW * scale
  const dh = mapH * scale
  const ox = (w - dw) / 2
  const oy = (h - dh) / 2

  const toScreen = (c: Coordinate) => {
    const p = geoAPixel(c, centro, zoom, MAP_SCALE, mapW, mapH)
    return { x: ox + p.x * scale, y: oy + p.y * scale }
  }

  ctx.fillStyle = '#050a14'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, ox, oy, dw, dh)

  let senzaModuliDataUri: string
  try {
    senzaModuliDataUri = canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return null
  }

  for (const layout of input.layouts) {
    if (layout.moduli.length === 0) continue
    const poligono = input.poligoni[String(layout.faldaIndice)]
    if (poligono && poligono.length >= 3) {
      ctx.beginPath()
      poligono.forEach((c, i) => {
        const p = toScreen(c)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.closePath()
      ctx.fillStyle = 'rgba(217,164,65,0.12)'
      ctx.strokeStyle = 'rgba(232,199,101,0.85)'
      ctx.lineWidth = 1.5
      ctx.fill()
      ctx.stroke()
    }

    for (const m of layout.moduli) {
      const pts = m.angoli.map(toScreen)
      ctx.beginPath()
      pts.forEach((p, pi) => {
        if (pi === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.closePath()
      ctx.fillStyle = 'rgba(30, 58, 95, 0.78)'
      ctx.strokeStyle = 'rgba(127, 178, 232, 0.95)'
      ctx.lineWidth = 1
      ctx.fill()
      ctx.stroke()

      const a = pts[0]
      const b = pts[1]
      const c = pts[2]
      const d = pts[3]
      if (a && b && c && d) {
        ctx.strokeStyle = 'rgba(127,178,232,0.4)'
        ctx.beginPath()
        ctx.moveTo((a.x + d.x) / 2, (a.y + d.y) / 2)
        ctx.lineTo((b.x + c.x) / 2, (b.y + c.y) / 2)
        ctx.stroke()
      }
    }
  }

  try {
    return {
      senzaModuliDataUri,
      conModuliDataUri: canvas.toDataURL('image/jpeg', 0.82),
    }
  } catch {
    return null
  }
}

/** Compatibilità per eventuali chiamanti che richiedono solo il progetto. */
export async function catturaAnteprimaModuli(
  input: InputAnteprimaModuli,
): Promise<string | null> {
  return (await catturaAnteprimeTetto(input))?.conModuliDataUri ?? null
}
