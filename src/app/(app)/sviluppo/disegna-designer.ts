import {
  geoAPixel,
  pixelAGeo,
  type Coordinate,
  type RettangoloModulo,
} from '@/lib/solar'
import { clampPan } from './designer-geometria'

/** Proiezione geo↔schermo del canvas del designer, per hit-test e drag. */
export interface ProiezioneCanvas {
  toScreen: (c: Coordinate) => { x: number; y: number }
  fromScreen: (x: number, y: number) => Coordinate
}

export interface StatoDisegno {
  canvas: HTMLCanvasElement
  /** Foto aerea di sfondo, o null se non ancora caricata / non disponibile. */
  img: HTMLImageElement | null
  /** Origine della proiezione e zoom della foto (frame congelato per falda). */
  centro: Coordinate
  zoom: number
  scale: number
  mapW: number
  mapH: number
  /** Zoom della vista (1 = tutta la foto) e pan corrente. */
  zoomVista: number
  pan: { x: number; y: number }
  poligono: readonly Coordinate[]
  moduli: readonly RettangoloModulo[]
  selezionati: ReadonlySet<number>
  marquee: { x0: number; y0: number; x1: number; y1: number } | null
  /** true se la falda è editabile: disegna le maniglie sui vertici. */
  editabile: boolean
  raggioManiglia: number
}

/**
 * Disegna sfondo (foto Solar o ripiego neutro), poligono della falda con le
 * maniglie, moduli ed eventuale riquadro di selezione. Ritorna la proiezione
 * geo↔schermo e il pan effettivo (clampato), che il chiamante salva nei ref.
 *
 * Funzione pura sul canvas: nessuno stato React qui dentro. Il chiamante legge i
 * ref e passa i valori; così l'interazione resta nel componente e il disegno —
 * la parte più lunga — è isolato e leggibile.
 */
export function disegnaDesigner(
  s: StatoDisegno,
): { proiezione: ProiezioneCanvas; pan: { x: number; y: number } } | null {
  const { canvas, img, centro, zoom, scale: SCALE, mapW: MAP_W, mapH: MAP_H } = s
  if (s.poligono.length < 3) return null
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const imgOk = !!img && img.complete && img.naturalWidth > 0

  const w = canvas.clientWidth || 400
  const h = canvas.clientHeight || 320
  const mobile =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 1023px)').matches
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const base = Math.max(w / MAP_W, h / MAP_H)
  const scala = base * s.zoomVista
  let pan = s.pan
  const dw = MAP_W * scala
  const dh = MAP_H * scala
  if (s.zoomVista <= 1.001) pan = { x: 0, y: 0 }
  else pan = clampPan(w, h, dw, dh, pan)
  const ox = (w - dw) / 2 + pan.x
  const oy = (h - dh) / 2 + pan.y

  const toScreen = (c: Coordinate) => {
    const p = geoAPixel(c, centro, zoom, SCALE, MAP_W, MAP_H)
    return { x: ox + p.x * scala, y: oy + p.y * scala }
  }
  const fromScreen = (sx: number, sy: number) => {
    const mx = (sx - ox) / scala
    const my = (sy - oy) / scala
    return pixelAGeo(mx, my, centro, zoom, SCALE, MAP_W, MAP_H)
  }

  ctx.fillStyle = '#050a14'
  ctx.fillRect(0, 0, w, h)
  if (imgOk && img) {
    ctx.drawImage(img, ox, oy, dw, dh)
  } else {
    // Ripiego senza foto: rettangolo neutro nell'area della mappa e un avviso,
    // così è chiaro perché manca la foto (non è un errore dell'app).
    ctx.fillStyle = 'rgba(127,178,232,0.05)'
    ctx.fillRect(ox, oy, dw, dh)
    ctx.fillStyle = 'rgba(159,176,195,0.85)'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText('Foto aerea non disponibile — falda e moduli in scala', 14, 22)
  }

  const punti = s.poligono
  ctx.beginPath()
  punti.forEach((c, i) => {
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

  // Maniglie della falda: si trascinano per incollare la falda al tetto della
  // foto Solar (fonte unica, co-registrata con l'anteprima e col PDF).
  if (s.editabile && punti.length >= 3) {
    // Punti medi dei lati (vuoti): trascinandoli si inserisce un vertice, per i
    // tetti non rettangolari. Sotto i vertici pieni, così questi vincono.
    for (let i = 0; i < punti.length; i++) {
      const a = toScreen(punti[i]!)
      const b = toScreen(punti[(i + 1) % punti.length]!)
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      ctx.beginPath()
      ctx.arc(mx, my, s.raggioManiglia - 1, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(10,21,40,0.65)'
      ctx.strokeStyle = 'rgba(232,199,101,0.9)'
      ctx.lineWidth = 1.5
      ctx.fill()
      ctx.stroke()
    }
    // Vertici (pieni): trascina per spostare, doppio click per eliminare.
    punti.forEach((c) => {
      const p = toScreen(c)
      ctx.beginPath()
      ctx.arc(p.x, p.y, s.raggioManiglia, 0, Math.PI * 2)
      ctx.fillStyle = '#e8c765'
      ctx.strokeStyle = 'rgba(10,21,40,0.9)'
      ctx.lineWidth = 2
      ctx.fill()
      ctx.stroke()
    })
  }

  s.moduli.forEach((m, i) => {
    const pts = m.angoli.map(toScreen)
    const attivo = s.selezionati.has(i)
    ctx.beginPath()
    pts.forEach((p, pi) => {
      if (pi === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.closePath()
    ctx.fillStyle = attivo
      ? 'rgba(232, 199, 101, 0.55)'
      : 'rgba(30, 58, 95, 0.78)'
    ctx.strokeStyle = attivo ? '#e8c765' : 'rgba(127, 178, 232, 0.95)'
    ctx.lineWidth = attivo ? 2 : 1
    ctx.fill()
    ctx.stroke()

    const a = pts[0]!
    const b = pts[1]!
    const c = pts[2]!
    const d = pts[3]!
    ctx.strokeStyle = attivo
      ? 'rgba(232,199,101,0.55)'
      : 'rgba(127,178,232,0.4)'
    ctx.beginPath()
    ctx.moveTo((a.x + d.x) / 2, (a.y + d.y) / 2)
    ctx.lineTo((b.x + c.x) / 2, (b.y + c.y) / 2)
    ctx.stroke()
  })

  const mq = s.marquee
  if (mq) {
    const x = Math.min(mq.x0, mq.x1)
    const y = Math.min(mq.y0, mq.y1)
    const bw = Math.abs(mq.x1 - mq.x0)
    const bh = Math.abs(mq.y1 - mq.y0)
    ctx.fillStyle = 'rgba(127, 178, 232, 0.15)'
    ctx.strokeStyle = 'rgba(127, 178, 232, 0.9)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.fillRect(x, y, bw, bh)
    ctx.strokeRect(x, y, bw, bh)
    ctx.setLineDash([])
  }

  return { proiezione: { toScreen, fromScreen }, pan }
}
