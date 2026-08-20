'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FORMATI_MODULO_FV,
  formatoModuloById,
  geoAPixel,
  layoutModuliInFalda,
  pixelAGeo,
  puntoInRettangoloSchermo,
  ruotaModulo,
  snapCentroModulo,
  spostaModulo,
  zoomPerContenere,
  type Coordinate,
  type FaldaTetto,
  type RettangoloModulo,
} from '@/lib/solar'

/** Zoom di ripiego quando non c'è ancora un poligono da inquadrare. */
const ZOOM_DEFAULT = 20
const SCALE = 2
/**
 * Versione dello sfondo aereo, per invalidare la cache 24h della foto a ogni
 * deploy. È l'id del rilascio (SHA del commit su Vercel), esposto da
 * `next.config.ts`: così cambia da solo a ogni pubblicazione e l'utente non vede
 * mai una foto vecchia disallineata, senza dover svuotare cache o usare incognito.
 */
const VERSIONE_SFONDO = process.env.NEXT_PUBLIC_SFONDO_VER ?? 'dev'
/**
 * Dimensioni della Static Map richiesta (640×420 @ scale 2). Sono note a priori:
 * così la proiezione geo→canvas regge anche quando l'immagine satellitare non
 * arriva — dal 2025 Google blocca il satellite sulla Static Maps API in UE, ma
 * la falda e i moduli devono restare disegnabili lo stesso, in scala.
 */
const MAP_W = 640 * SCALE
const MAP_H = 420 * SCALE
// Vista: 1 = tutta la foto (larga, con contesto), fino a 8× per il dettaglio
// fine dei vertici. Si parte a metà strada così si può subito sia allargare
// sia stringere.
const ZOOM_VISTA_MIN = 1
const ZOOM_VISTA_MAX = 8
const ZOOM_VISTA_INIZIALE = 2
/** Maniglia di vertice della falda: raggio disegnato e raggio di presa (px CSS). */
const RAGGIO_MANIGLIA = 6
const PRESA_MANIGLIA = 14

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function clampPan(
  w: number,
  h: number,
  dw: number,
  dh: number,
  pan: { x: number; y: number },
) {
  const maxX = Math.max(0, (dw - w) / 2 + 48)
  const maxY = Math.max(0, (dh - h) / 2 + 48)
  return {
    x: clamp(pan.x, -maxX, maxX),
    y: clamp(pan.y, -maxY, maxY),
  }
}

function centroide(vertici: readonly Coordinate[]): Coordinate {
  const n = vertici.length || 1
  return {
    latitude: vertici.reduce((s, v) => s + v.latitude, 0) / n,
    longitude: vertici.reduce((s, v) => s + v.longitude, 0) / n,
  }
}

interface ProiezioneCanvas {
  toScreen: (c: Coordinate) => { x: number; y: number }
  fromScreen: (x: number, y: number) => Coordinate
}

type DragMode =
  | {
      tipo: 'moduli'
      indici: number[]
      /** Centro di ciascun modulo selezionato al pointerdown. */
      centri0: Coordinate[]
      pointer0: Coordinate
    }
  | {
      tipo: 'marquee'
      x0: number
      y0: number
      x1: number
      y1: number
    }
  | {
      tipo: 'pan'
      x0: number
      y0: number
      pan0: { x: number; y: number }
    }
  | {
      tipo: 'vertice'
      /** Indice del vertice della falda trascinato sulla foto Solar. */
      indice: number
    }

export type LayoutModuliCorrente = {
  readonly faldaIndice: number
  readonly formatoId: string
  readonly wattPicco: number
  readonly quantitaRichiesta: number
  readonly landscape: boolean
  readonly moduli: readonly RettangoloModulo[]
  readonly kWp: number
}

export function EditorModuli({
  falda,
  poligono,
  layoutIniziale,
  onLayoutChange,
  onPoligonoChange,
  onTrascinamentoChange,
}: {
  falda: FaldaTetto | null
  poligono: readonly Coordinate[] | null
  /** Layout già salvato per questa falda (multi-falda: non perdere il lavoro). */
  layoutIniziale?: LayoutModuliCorrente | null
  onLayoutChange?: (layout: LayoutModuliCorrente | null) => void
  /**
   * Vertici della falda modificati trascinandoli **sulla foto Solar**. È la fonte
   * unica: la foto Solar è co-registrata con la propria geometria, quindi ciò che
   * si regola qui combacia con l'anteprima e col PDF, senza lo scarto di
   * parallasse che nasce tracciando sul satellite Google Maps (altro scatto).
   */
  onPoligonoChange?: (punti: readonly Coordinate[]) => void
  /** true mentre si spostano moduli: il parent non deve cambiare falda. */
  onTrascinamentoChange?: (attivo: boolean) => void
}) {
  const quantitaIniziale =
    layoutIniziale?.quantitaRichiesta ??
    layoutIniziale?.moduli.length ??
    12
  const [formatoId, setFormatoId] = useState(
    () => layoutIniziale?.formatoId ?? FORMATI_MODULO_FV[0]!.id,
  )
  const [quantita, setQuantita] = useState(() => quantitaIniziale)
  const [landscape, setLandscape] = useState(
    () => layoutIniziale?.landscape ?? true,
  )
  const [manuale, setManuale] = useState<{
    chiave: string
    moduli: RettangoloModulo[]
  } | null>(() => {
    if (!layoutIniziale?.moduli.length) return null
    const idx = layoutIniziale.faldaIndice
    const q =
      layoutIniziale.quantitaRichiesta ?? layoutIniziale.moduli.length
    const chiave = `${idx}|${layoutIniziale.formatoId}|${layoutIniziale.landscape}|${q}`
    return { chiave, moduli: [...layoutIniziale.moduli] }
  })
  const [selezionati, setSelezionati] = useState<ReadonlySet<number>>(
    () => new Set(),
  )
  const [schermoIntero, setSchermoIntero] = useState(false)
  const [zoomVista, setZoomVista] = useState(ZOOM_VISTA_INIZIALE)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const proiezioneRef = useRef<ProiezioneCanvas | null>(null)
  const dragRef = useRef<DragMode | null>(null)
  const marqueeRef = useRef<{
    x0: number
    y0: number
    x1: number
    y1: number
  } | null>(null)
  const disegnaRef = useRef<() => void>(() => {})
  const pendingCommitRef = useRef<RettangoloModulo[] | null>(null)
  const zoomVistaRef = useRef(ZOOM_VISTA_INIZIALE)
  const panRef = useRef({ x: 0, y: 0 })
  const zoomAtRef = useRef<
    ((clientX: number, clientY: number, nuovoZoom: number) => void) | null
  >(null)

  useEffect(() => {
    zoomVistaRef.current = zoomVista
  }, [zoomVista])

  const centro = useMemo(
    () =>
      poligono && poligono.length >= 3
        ? centroide(poligono)
        : falda?.center ?? null,
    [poligono, falda],
  )

  // Zoom della foto: si prende un livello più largo del "fit" esatto della
  // falda, così attorno resta contesto (tetto intero, vicini) e si può poi sia
  // allargare sia stringere con la vista. Vale per foto e proiezione insieme,
  // quindi restano allineate.
  const zoom = useMemo(
    () =>
      centro && poligono && poligono.length >= 3
        ? Math.max(17, zoomPerContenere(poligono, centro, MAP_W, MAP_H, SCALE) - 1)
        : ZOOM_DEFAULT,
    [poligono, centro],
  )

  const formato = formatoModuloById(formatoId)
  const faldaKey = falda?.indice ?? -1
  const seedKey = `${faldaKey}|${formatoId}|${landscape}|${quantita}`

  const autoModuli = useMemo(() => {
    if (!falda || !poligono || poligono.length < 3) return [] as RettangoloModulo[]
    return [
      ...layoutModuliInFalda({
        poligono,
        formato,
        quantita,
        azimuthDegrees: falda.azimuthDegrees,
        landscape,
      }).moduli,
    ]
  }, [falda, poligono, formato, quantita, landscape])

  /*
   * Adegua lo stato alla nuova falda/configurazione durante il render, come
   * stato derivato dalla chiave. Farlo in un Effect causava un render
   * intermedio incoerente e una cascata di aggiornamenti; la condizione sulla
   * chiave garantisce che il nuovo render converga immediatamente.
   */
  if (manuale && manuale.chiave !== seedKey) {
    setManuale(
      autoModuli.length > 0 || manuale.moduli.length === 0
        ? null
        : { chiave: seedKey, moduli: manuale.moduli },
    )
  }

  const usaManualeDuranteCambio =
    manuale && autoModuli.length === 0 && manuale.moduli.length > 0
  const moduli =
    manuale && (manuale.chiave === seedKey || usaManualeDuranteCambio)
      ? manuale.moduli
      : autoModuli

  const moduliRef = useRef(moduli)
  const selezionatiRef = useRef(selezionati)
  const onLayoutChangeRef = useRef(onLayoutChange)
  const onPoligonoChangeRef = useRef(onPoligonoChange)
  const onTrascinamentoChangeRef = useRef(onTrascinamentoChange)
  // Copia viva del poligono: durante il trascinamento di un vertice la si muta
  // e ridisegna, senza rimontare (centro/zoom della foto restano fermi finché
  // non si rilascia). Al rilascio si notifica il parent, che aggiorna il prop.
  const poligonoRef = useRef<readonly Coordinate[] | null>(poligono)
  const formatoIdRef = useRef(formatoId)
  const quantitaRef = useRef(quantita)
  const landscapeRef = useRef(landscape)
  const wattPiccoRef = useRef(formato.wattPicco)
  const faldaIndiceRef = useRef(falda?.indice ?? null)

  useEffect(() => {
    moduliRef.current = moduli
    selezionatiRef.current = selezionati
  }, [moduli, selezionati])

  useEffect(() => {
    poligonoRef.current = poligono
  }, [poligono])

  useEffect(() => {
    onLayoutChangeRef.current = onLayoutChange
    onPoligonoChangeRef.current = onPoligonoChange
    onTrascinamentoChangeRef.current = onTrascinamentoChange
    formatoIdRef.current = formatoId
    quantitaRef.current = quantita
    landscapeRef.current = landscape
    wattPiccoRef.current = formato.wattPicco
    faldaIndiceRef.current = falda?.indice ?? null
  }, [
    onLayoutChange,
    onPoligonoChange,
    onTrascinamentoChange,
    formatoId,
    quantita,
    landscape,
    formato.wattPicco,
    falda?.indice,
  ])

  /** Notifica sincrona al parent (sopravvive al remount su cambio falda). */
  const notificaLayoutAlParent = useCallback((lista: RettangoloModulo[]) => {
    const cb = onLayoutChangeRef.current
    const indice = faldaIndiceRef.current
    if (!cb || indice == null) return
    const wp = wattPiccoRef.current
    cb({
      faldaIndice: indice,
      formatoId: formatoIdRef.current,
      wattPicco: wp,
      quantitaRichiesta: quantitaRef.current,
      landscape: landscapeRef.current,
      moduli: lista,
      kWp: (lista.length * wp) / 1000,
    })
  }, [])

  const aggiornaModuli = useCallback(
    (next: RettangoloModulo[] | ((prev: RettangoloModulo[]) => RettangoloModulo[])) => {
      setManuale((prev) => {
        const base =
          prev && prev.chiave === seedKey ? prev.moduli : autoModuli
        const moduliNext = typeof next === 'function' ? next(base) : next
        return { chiave: seedKey, moduli: moduliNext }
      })
    },
    [seedKey, autoModuli],
  )

  const ridisponi = () => {
    setManuale(null)
    setSelezionati(new Set())
  }

  const kWp = (moduli.length * formato.wattPicco) / 1000

  useEffect(() => {
    if (!onLayoutChange || !falda) return
    // Sempre con faldaIndice: moduli vuoti = clear solo quella falda (non null cieco).
    onLayoutChange({
      faldaIndice: falda.indice,
      formatoId,
      wattPicco: formato.wattPicco,
      quantitaRichiesta: quantita,
      landscape,
      moduli,
      kWp,
    })
  }, [
    onLayoutChange,
    falda,
    moduli,
    formatoId,
    formato.wattPicco,
    quantita,
    landscape,
    kWp,
  ])

  // Cambio falda / unmount a metà drag: flush sincrono (non solo setState).
  useEffect(() => {
    return () => {
      onTrascinamentoChangeRef.current?.(false)
      const pendenti = pendingCommitRef.current
      pendingCommitRef.current = null
      dragRef.current = null
      if (pendenti?.length) notificaLayoutAlParent(pendenti)
    }
  }, [falda?.indice, notificaLayoutAlParent])

  const urlStatica = centro
    ? `/api/sviluppo/mappa?lat=${centro.latitude}&lng=${centro.longitude}&zoom=${zoom}&marker=0&v=${VERSIONE_SFONDO}`
    : null

  const disegna = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !centro || !poligono || poligono.length < 3) {
      return
    }
    // L'immagine satellitare è un di più: senza (Static Maps UE) si disegna
    // comunque la falda e i moduli su sfondo neutro, in scala.
    const img = imgRef.current
    const imgOk = !!img && img.complete && img.naturalWidth > 0
    const ctx = canvas.getContext('2d')
    if (!ctx) return

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
    const z = zoomVistaRef.current
    const scale = base * z
    let pan = panRef.current
    const dw = MAP_W * scale
    const dh = MAP_H * scale
    if (z <= 1.001) {
      pan = { x: 0, y: 0 }
      panRef.current = pan
    } else {
      pan = clampPan(w, h, dw, dh, pan)
      panRef.current = pan
    }
    const ox = (w - dw) / 2 + pan.x
    const oy = (h - dh) / 2 + pan.y
    const mapW = MAP_W
    const mapH = MAP_H

    const toScreen = (c: Coordinate) => {
      const p = geoAPixel(c, centro, zoom, SCALE, mapW, mapH)
      return { x: ox + p.x * scale, y: oy + p.y * scale }
    }
    const fromScreen = (sx: number, sy: number) => {
      const mx = (sx - ox) / scale
      const my = (sy - oy) / scale
      return pixelAGeo(mx, my, centro, zoom, SCALE, mapW, mapH)
    }
    proiezioneRef.current = { toScreen, fromScreen }

    ctx.fillStyle = '#050a14'
    ctx.fillRect(0, 0, w, h)
    if (imgOk && img) {
      ctx.drawImage(img, ox, oy, dw, dh)
    } else {
      // Ripiego senza satellite: rettangolo neutro nell'area della mappa e un
      // avviso, così è chiaro perché manca la foto (non è un errore dell'app).
      ctx.fillStyle = 'rgba(127,178,232,0.05)'
      ctx.fillRect(ox, oy, dw, dh)
      ctx.fillStyle = 'rgba(159,176,195,0.85)'
      ctx.font = '12px system-ui, sans-serif'
      ctx.fillText('Vista satellitare non disponibile (UE) — falda e moduli in scala', 14, 22)
    }

    const punti = poligonoRef.current ?? poligono ?? []
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
    if (onPoligonoChangeRef.current && punti.length >= 3) {
      // Punti medi dei lati (vuoti): trascinandoli si inserisce un vertice, per
      // i tetti non rettangolari. Sotto i vertici pieni, così questi vincono.
      for (let i = 0; i < punti.length; i++) {
        const a = toScreen(punti[i]!)
        const b = toScreen(punti[(i + 1) % punti.length]!)
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        ctx.beginPath()
        ctx.arc(mx, my, RAGGIO_MANIGLIA - 1, 0, Math.PI * 2)
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
        ctx.arc(p.x, p.y, RAGGIO_MANIGLIA, 0, Math.PI * 2)
        ctx.fillStyle = '#e8c765'
        ctx.strokeStyle = 'rgba(10,21,40,0.9)'
        ctx.lineWidth = 2
        ctx.fill()
        ctx.stroke()
      })
    }

    const sel = selezionatiRef.current
    moduliRef.current.forEach((m, i) => {
      const pts = m.angoli.map(toScreen)
      const attivo = sel.has(i)
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

    const mq = marqueeRef.current
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
  }, [centro, poligono, zoom])

  useEffect(() => {
    disegnaRef.current = disegna
  }, [disegna])

  useEffect(() => {
    if (!urlStatica || !centro || !poligono || poligono.length < 3) return
    const canvas = canvasRef.current
    if (!canvas) return

    let annullato = false
    const img = new Image()
    imgRef.current = img
    img.onload = () => {
      if (!annullato) disegna()
    }
    // Anche in errore (satellite UE bloccato) si ridisegna: `disegna` gestisce
    // l'assenza dell'immagine e mostra comunque falda e moduli.
    img.onerror = () => {
      if (!annullato) disegna()
    }
    img.src = urlStatica

    // Disegno subito, senza aspettare la rete: la falda compare all'istante e
    // l'eventuale foto satellitare si sovrappone dopo, al load.
    disegna()

    return () => {
      annullato = true
    }
  }, [urlStatica, centro, poligono, disegna])

  useEffect(() => {
    disegna()
  }, [moduli, selezionati, zoomVista, disegna])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !falda || !poligono || !centro) return

    const coordsLocale = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const hitTest = (x: number, y: number): number | null => {
      const proj = proiezioneRef.current
      if (!proj) return null
      const lista = moduliRef.current
      for (let i = lista.length - 1; i >= 0; i--) {
        const pts = lista[i]!.angoli.map(proj.toScreen)
        if (puntoInRettangoloSchermo(x, y, pts)) return i
      }
      return null
    }

    // Vertice della falda più vicino al puntatore, se entro la presa. Ha priorità
    // sui moduli: le maniglie stanno sopra, e regolare la falda è l'atto raro e
    // deliberato che qui va reso possibile.
    const hitVertice = (x: number, y: number): number | null => {
      const proj = proiezioneRef.current
      const punti = poligonoRef.current
      if (!proj || !punti || !onPoligonoChangeRef.current) return null
      let migliore: number | null = null
      let minDist = PRESA_MANIGLIA
      punti.forEach((c, i) => {
        const p = proj.toScreen(c)
        const d = Math.hypot(p.x - x, p.y - y)
        if (d <= minDist) {
          minDist = d
          migliore = i
        }
      })
      return migliore
    }

    // Punto medio del lato più vicino, se entro la presa. Ritorna l'indice del
    // vertice DOPO cui inserire il nuovo punto (lato i → i+1).
    const hitMidpoint = (x: number, y: number): number | null => {
      const proj = proiezioneRef.current
      const punti = poligonoRef.current
      if (!proj || !punti || punti.length < 3 || !onPoligonoChangeRef.current) {
        return null
      }
      let migliore: number | null = null
      let minDist = PRESA_MANIGLIA
      for (let i = 0; i < punti.length; i++) {
        const a = proj.toScreen(punti[i]!)
        const b = proj.toScreen(punti[(i + 1) % punti.length]!)
        const d = Math.hypot((a.x + b.x) / 2 - x, (a.y + b.y) / 2 - y)
        if (d <= minDist) {
          minDist = d
          migliore = i
        }
      }
      return migliore
    }

    const intersecaMarquee = (
      pts: { x: number; y: number }[],
      box: { x0: number; y0: number; x1: number; y1: number },
    ) => {
      const minX = Math.min(box.x0, box.x1)
      const maxX = Math.max(box.x0, box.x1)
      const minY = Math.min(box.y0, box.y1)
      const maxY = Math.max(box.y0, box.y1)
      return pts.some(
        (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
      )
    }

    const applicaZoomSuPunto = (
      clientX: number,
      clientY: number,
      nuovoZoom: number,
    ) => {
      const img = imgRef.current
      if (!img?.complete) {
        const z = clamp(nuovoZoom, ZOOM_VISTA_MIN, ZOOM_VISTA_MAX)
        zoomVistaRef.current = z
        setZoomVista(z)
        if (z <= 1.001) panRef.current = { x: 0, y: 0 }
        return
      }
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const w = canvas.clientWidth || 400
      const h = canvas.clientHeight || 320
      const base = Math.max(w / img.naturalWidth, h / img.naturalHeight)
      const z0 = zoomVistaRef.current
      const z1 = clamp(nuovoZoom, ZOOM_VISTA_MIN, ZOOM_VISTA_MAX)
      if (Math.abs(z1 - z0) < 1e-6) return

      const pan0 = panRef.current
      const dw0 = img.naturalWidth * base * z0
      const dh0 = img.naturalHeight * base * z0
      const ox0 = (w - dw0) / 2 + pan0.x
      const oy0 = (h - dh0) / 2 + pan0.y
      const mx = (x - ox0) / (base * z0)
      const my = (y - oy0) / (base * z0)
      const dw1 = img.naturalWidth * base * z1
      const dh1 = img.naturalHeight * base * z1
      let pan1 =
        z1 <= 1.001
          ? { x: 0, y: 0 }
          : {
              x: x - (w - dw1) / 2 - mx * base * z1,
              y: y - (h - dh1) / 2 - my * base * z1,
            }
      if (z1 > 1.001) pan1 = clampPan(w, h, dw1, dh1, pan1)
      panRef.current = pan1
      zoomVistaRef.current = z1
      setZoomVista(z1)
    }

    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      const { x, y } = coordsLocale(e)

      // Trascinamento di un vertice della falda: priorità su tutto il resto.
      const vertice = hitVertice(x, y)
      if (vertice != null) {
        dragRef.current = { tipo: 'vertice', indice: vertice }
        onTrascinamentoChangeRef.current?.(true)
        canvas.setPointerCapture(e.pointerId)
        canvas.style.cursor = 'grabbing'
        return
      }

      // Punto medio di un lato: inserisci un vertice lì e trascinalo subito.
      const lato = hitMidpoint(x, y)
      if (lato != null) {
        const base = poligonoRef.current
        const proj = proiezioneRef.current
        if (base && proj) {
          const nuovo = proj.fromScreen(x, y)
          const next = [
            ...base.slice(0, lato + 1),
            nuovo,
            ...base.slice(lato + 1),
          ]
          poligonoRef.current = next
          dragRef.current = { tipo: 'vertice', indice: lato + 1 }
          onTrascinamentoChangeRef.current?.(true)
          canvas.setPointerCapture(e.pointerId)
          canvas.style.cursor = 'grabbing'
          disegnaRef.current()
          return
        }
      }

      const hit = hitTest(x, y)
      const toggle = e.shiftKey || e.metaKey || e.ctrlKey

      if (hit == null) {
        if (!toggle) {
          setSelezionati(new Set())
          selezionatiRef.current = new Set()
        }
        // Con zoom: trascina vuoto = pan; Shift = marquee.
        if (zoomVistaRef.current > 1.01 && !toggle) {
          dragRef.current = {
            tipo: 'pan',
            x0: x,
            y0: y,
            pan0: { ...panRef.current },
          }
          canvas.setPointerCapture(e.pointerId)
          canvas.style.cursor = 'grabbing'
          return
        }
        dragRef.current = { tipo: 'marquee', x0: x, y0: y, x1: x, y1: y }
        marqueeRef.current = { x0: x, y0: y, x1: x, y1: y }
        disegnaRef.current()
        canvas.setPointerCapture(e.pointerId)
        return
      }

      const selAttuale = selezionatiRef.current
      let nextSel: Set<number>
      if (toggle) {
        nextSel = new Set(selAttuale)
        if (nextSel.has(hit)) nextSel.delete(hit)
        else nextSel.add(hit)
      } else if (selAttuale.has(hit)) {
        nextSel = new Set(selAttuale)
      } else {
        nextSel = new Set([hit])
      }
      setSelezionati(nextSel)
      selezionatiRef.current = nextSel

      if (nextSel.size === 0) return

      const proj = proiezioneRef.current
      if (!proj) return
      const pointer0 = proj.fromScreen(x, y)
      const indici = [...nextSel].sort((a, b) => a - b)
      const centri0 = indici.map((i) => moduliRef.current[i]!.centro)
      dragRef.current = {
        tipo: 'moduli',
        indici,
        centri0,
        pointer0,
      }
      pendingCommitRef.current = null
      onTrascinamentoChangeRef.current?.(true)
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
    }

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      e.preventDefault()
      const { x, y } = coordsLocale(e)

      if (drag.tipo === 'pan') {
        const img = imgRef.current
        const w = canvas.clientWidth || 400
        const h = canvas.clientHeight || 320
        const z = zoomVistaRef.current
        const next = {
          x: drag.pan0.x + (x - drag.x0),
          y: drag.pan0.y + (y - drag.y0),
        }
        if (img?.complete) {
          const base = Math.max(w / img.naturalWidth, h / img.naturalHeight)
          const dw = img.naturalWidth * base * z
          const dh = img.naturalHeight * base * z
          panRef.current = clampPan(w, h, dw, dh, next)
        } else {
          panRef.current = next
        }
        disegnaRef.current()
        return
      }

      if (drag.tipo === 'marquee') {
        drag.x1 = x
        drag.y1 = y
        marqueeRef.current = { x0: drag.x0, y0: drag.y0, x1: x, y1: y }
        disegnaRef.current()
        return
      }

      if (drag.tipo === 'vertice') {
        const proj = proiezioneRef.current
        const base = poligonoRef.current
        if (!proj || !base) return
        const geo = proj.fromScreen(x, y)
        const next = base.map((c, i) => (i === drag.indice ? geo : c))
        poligonoRef.current = next
        disegnaRef.current()
        return
      }

      const proj = proiezioneRef.current
      if (!proj || !falda) return
      const pointer = proj.fromScreen(x, y)
      const dLat = pointer.latitude - drag.pointer0.latitude
      const dLng = pointer.longitude - drag.pointer0.longitude
      const fmt = formatoModuloById(formatoId)

      const next = moduliRef.current.map((m, i) => {
        const pos = drag.indici.indexOf(i)
        if (pos < 0) return m
        const c0 = drag.centri0[pos]!
        return spostaModulo(
          { ...m, centro: c0 },
          dLat,
          dLng,
          fmt,
          falda.azimuthDegrees,
          landscape,
          centro,
        )
      })

      const selezionatiDrag = new Set(drag.indici)
      const fissi = next.filter((_, i) => !selezionatiDrag.has(i))
      const leaderIdx = drag.indici[0]!
      const leader = next[leaderIdx]!
      if (leader && fissi.length > 0) {
        const snappato = snapCentroModulo({
          centro: leader.centro,
          rotazioneDegrees: leader.rotazioneDegrees,
          formato: fmt,
          azimuthDegrees: falda.azimuthDegrees,
          landscape,
          origineProiezione: centro,
          fissi,
        })
        const sLat = snappato.latitude - leader.centro.latitude
        const sLng = snappato.longitude - leader.centro.longitude
        if (sLat !== 0 || sLng !== 0) {
          for (const i of drag.indici) {
            const m = next[i]!
            next[i] = spostaModulo(
              m,
              sLat,
              sLng,
              fmt,
              falda.azimuthDegrees,
              landscape,
              centro,
            )
          }
        }
      }

      moduliRef.current = next
      pendingCommitRef.current = next
      disegnaRef.current()
    }

    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current
      dragRef.current = null
      canvas.style.cursor = zoomVistaRef.current > 1.01 ? 'grab' : 'grab'
      marqueeRef.current = null

      if (drag?.tipo === 'moduli') {
        onTrascinamentoChangeRef.current?.(false)
      }

      if (drag?.tipo === 'vertice') {
        onTrascinamentoChangeRef.current?.(false)
        const punti = poligonoRef.current
        if (punti) onPoligonoChangeRef.current?.(punti)
        disegnaRef.current()
        return
      }

      if (pendingCommitRef.current) {
        const next = pendingCommitRef.current
        pendingCommitRef.current = null
        // Sincrono al parent: evita perdita se il remount scarta lo state React.
        notificaLayoutAlParent(next)
        aggiornaModuli(next)
      }

      disegnaRef.current()

      if (!drag || drag.tipo !== 'marquee') return
      const proj = proiezioneRef.current
      if (!proj) return
      const box = drag
      const piccoli =
        Math.abs(box.x1 - box.x0) < 4 && Math.abs(box.y1 - box.y0) < 4
      if (piccoli) return

      const hit = new Set<number>()
      moduliRef.current.forEach((m, i) => {
        const pts = m.angoli.map(proj.toScreen)
        if (intersecaMarquee(pts, box)) hit.add(i)
      })
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        setSelezionati((prev) => {
          const next = new Set(prev)
          for (const i of hit) next.add(i)
          return next
        })
      } else {
        setSelezionati(hit)
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14
      applicaZoomSuPunto(e.clientX, e.clientY, zoomVistaRef.current * factor)
    }

    // Doppio click su un vertice = eliminalo (una falda resta almeno un
    // triangolo). Serve per i tetti che vanno semplificati dopo un inserimento.
    const onDblClick = (e: MouseEvent) => {
      const punti = poligonoRef.current
      if (!punti || punti.length <= 3 || !onPoligonoChangeRef.current) return
      const { x, y } = coordsLocale(e)
      const v = hitVertice(x, y)
      if (v == null) return
      e.preventDefault()
      const next = punti.filter((_, i) => i !== v)
      poligonoRef.current = next
      onPoligonoChangeRef.current(next)
      disegnaRef.current()
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('dblclick', onDblClick)
    canvas.style.cursor = 'grab'
    zoomAtRef.current = applicaZoomSuPunto

    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('dblclick', onDblClick)
      zoomAtRef.current = null
    }
  }, [
    falda,
    poligono,
    centro,
    formatoId,
    landscape,
    aggiornaModuli,
    notificaLayoutAlParent,
  ])

  const zoomRelativo = (delta: number) => {
    const canvas = canvasRef.current
    const factor = delta > 0 ? 1.25 : 0.8
    if (canvas && zoomAtRef.current) {
      const rect = canvas.getBoundingClientRect()
      zoomAtRef.current(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        zoomVistaRef.current * factor,
      )
      return
    }
    const z = clamp(
      zoomVistaRef.current * factor,
      ZOOM_VISTA_MIN,
      ZOOM_VISTA_MAX,
    )
    zoomVistaRef.current = z
    if (z <= 1.001) panRef.current = { x: 0, y: 0 }
    setZoomVista(z)
  }

  const resetZoom = () => {
    zoomVistaRef.current = ZOOM_VISTA_INIZIALE
    panRef.current = { x: 0, y: 0 }
    setZoomVista(ZOOM_VISTA_INIZIALE)
  }

  const ruotaSelezione = useCallback(
    (delta: number) => {
      if (!falda || !centro || selezionatiRef.current.size === 0) return
      const sel = selezionatiRef.current
      const fmt = formatoModuloById(formatoId)
      aggiornaModuli((prev) =>
        prev.map((m, i) =>
          sel.has(i)
            ? ruotaModulo(
                m,
                delta,
                fmt,
                falda.azimuthDegrees,
                landscape,
                centro,
              )
            : m,
        ),
      )
    },
    [falda, centro, formatoId, landscape, aggiornaModuli],
  )

  const eliminaSelezionati = () => {
    if (selezionati.size === 0) return
    aggiornaModuli((prev) => prev.filter((_, i) => !selezionati.has(i)))
    setSelezionati(new Set())
  }

  const selezionaTutti = () => {
    setSelezionati(new Set(moduli.map((_, i) => i)))
  }

  useEffect(() => {
    if (!schermoIntero) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSchermoIntero(false)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => disegna(), 50)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [schermoIntero, disegna])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'SELECT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      ) {
        return
      }
      if (selezionatiRef.current.size === 0) return
      if (e.key === '[' || e.key === ',') {
        e.preventDefault()
        ruotaSelezione(e.shiftKey ? -5 : -1)
      } else if (e.key === ']' || e.key === '.') {
        e.preventDefault()
        ruotaSelezione(e.shiftKey ? 5 : 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ruotaSelezione])

  if (!falda || !poligono || poligono.length < 3) {
    return (
      <div
        className="flex h-full min-h-[280px] flex-col justify-center rounded-xl border px-4 py-6"
        style={{ borderColor: 'var(--bordo)', background: 'rgba(5,10,20,0.4)' }}
      >
        <h3 className="text-sm font-medium">Anteprima moduli</h3>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
          Seleziona una falda sulla mappa per disporre, spostare e ruotare i
          pannelli sull’immagine satellitare.
        </p>
      </div>
    )
  }

  return (
    <div
      className={
        schermoIntero
          ? 'fixed inset-0 z-[200] flex flex-col gap-3 overflow-auto p-4 sm:p-5'
          : 'flex h-full flex-col gap-3'
      }
      style={
        schermoIntero
          ? {
              background:
                'linear-gradient(165deg, #071018 0%, #0a1528 45%, #050a14 100%)',
            }
          : undefined
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Anteprima moduli</h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
            Falda {falda.indice + 1} · trascina i punti gialli per allineare la
            falda al tetto · zoom rotella/± · Shift/⌘ o riquadro
            {schermoIntero ? ' · Esc per uscire' : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSchermoIntero((v) => !v)}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: schermoIntero
              ? 'rgba(232, 199, 101, 0.45)'
              : 'var(--bordo)',
            color: schermoIntero ? '#e8c765' : 'var(--testo)',
            background: schermoIntero
              ? 'rgba(217, 164, 65, 0.12)'
              : 'transparent',
          }}
        >
          {schermoIntero ? 'Esci da tutto schermo' : 'Tutto schermo'}
        </button>
      </div>

      <div
        className={
          schermoIntero
            ? 'grid gap-2 sm:grid-cols-2 lg:max-w-xl'
            : 'grid gap-2 sm:grid-cols-2'
        }
      >
        <label className="block text-xs" style={{ color: 'var(--testo-fioco)' }}>
          Formato
          <select
            value={formatoId}
            onChange={(e) => setFormatoId(e.target.value)}
            className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm outline-none"
            style={{
              background: 'rgba(5,10,20,0.55)',
              borderColor: 'var(--bordo)',
              color: 'var(--testo)',
            }}
          >
            {FORMATI_MODULO_FV.map((f) => (
              <option key={f.id} value={f.id}>
                {f.etichetta}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs" style={{ color: 'var(--testo-fioco)' }}>
          Numero pannelli
          <input
            type="number"
            min={1}
            max={200}
            value={quantita}
            onChange={(e) => setQuantita(Number(e.target.value) || 1)}
            className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm tabular-nums outline-none"
            style={{
              background: 'rgba(5,10,20,0.55)',
              borderColor: 'var(--bordo)',
              color: 'var(--testo)',
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="inline-flex items-center gap-1.5" style={{ color: 'var(--testo-tenue)' }}>
          <input
            type="checkbox"
            checked={landscape}
            onChange={(e) => setLandscape(e.target.checked)}
          />
          Landscape (lato lungo in gronda)
        </label>
        <span className="tabular-nums" style={{ color: '#e8c765' }}>
          {moduli.length} pannelli · {kWp.toFixed(2)} kWp
          {selezionati.size > 0
            ? ` · ${selezionati.size} sel. · rot. ${(() => {
                const i = [...selezionati][0]!
                const r = moduli[i]?.rotazioneDegrees ?? 0
                return `${r.toFixed(0)}°`
              })()}`
            : ''}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={ridisponi}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium"
          style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
        >
          Ridisponi
        </button>
        <button
          type="button"
          onClick={selezionaTutti}
          disabled={moduli.length === 0}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
          style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
        >
          Seleziona tutti
        </button>
        <button
          type="button"
          onClick={() => ruotaSelezione(-1)}
          disabled={selezionati.size === 0}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
          style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
          title="Ruota −1° (fine)"
        >
          −1°
        </button>
        <button
          type="button"
          onClick={() => ruotaSelezione(1)}
          disabled={selezionati.size === 0}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
          style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
          title="Ruota +1° (fine)"
        >
          +1°
        </button>
        <button
          type="button"
          onClick={() => ruotaSelezione(-5)}
          disabled={selezionati.size === 0}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
          style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
          title="Ruota −5°"
        >
          −5°
        </button>
        <button
          type="button"
          onClick={() => ruotaSelezione(5)}
          disabled={selezionati.size === 0}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
          style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
          title="Ruota +5°"
        >
          +5°
        </button>
        <button
          type="button"
          onClick={() => ruotaSelezione(90)}
          disabled={selezionati.size === 0}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
          style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
          title="Ruota 90°"
        >
          +90°
        </button>
        <button
          type="button"
          onClick={eliminaSelezionati}
          disabled={selezionati.size === 0}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
          style={{
            borderColor: 'rgba(224, 133, 133, 0.45)',
            color: '#e8a0a0',
          }}
        >
          Elimina
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className={
            schermoIntero
              ? 'min-h-[50dvh] w-full flex-1 touch-none rounded-xl border'
              : 'h-[240px] w-full touch-none rounded-xl border sm:h-[320px]'
          }
          style={{
            borderColor: 'var(--bordo)',
            background: '#050a14',
            touchAction: 'none',
          }}
        />
        <div
          className="pointer-events-none absolute right-2 bottom-2 z-[1] flex flex-col gap-1.5"
        >
          <div
            className="pointer-events-auto flex flex-col gap-0.5 rounded-xl border p-1"
            style={{
              borderColor: 'rgba(30, 51, 80, 0.95)',
              background: 'rgba(5, 10, 20, 0.82)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
            }}
          >
            <button
              type="button"
              onClick={() => zoomRelativo(1)}
              disabled={zoomVista >= ZOOM_VISTA_MAX - 1e-6}
              title="Zoom avanti"
              aria-label="Zoom avanti"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition hover:text-[#e8c765] disabled:opacity-35"
              style={{ color: 'var(--testo-tenue)' }}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => zoomRelativo(-1)}
              disabled={zoomVista <= ZOOM_VISTA_MIN + 1e-6}
              title="Zoom indietro"
              aria-label="Zoom indietro"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition hover:text-[#e8c765] disabled:opacity-35"
              style={{ color: 'var(--testo-tenue)' }}
            >
              −
            </button>
          </div>
          {Math.abs(zoomVista - ZOOM_VISTA_INIZIALE) > 0.01 ? (
            <button
              type="button"
              onClick={resetZoom}
              title="Reimposta zoom"
              className="pointer-events-auto rounded-xl border px-2 py-1 text-[10px] font-medium tabular-nums"
              style={{
                borderColor: 'rgba(30, 51, 80, 0.95)',
                background: 'rgba(5, 10, 20, 0.82)',
                color: '#e8c765',
                backdropFilter: 'blur(12px)',
              }}
            >
              {Math.round(zoomVista * 100)}%
            </button>
          ) : null}
        </div>
      </div>

      {!schermoIntero ? (
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
          Trascina i punti gialli per far combaciare la falda col tetto di
          questa foto (è la stessa che finisce nel PDF); i punti vuoti sui lati
          aggiungono un vertice, doppio click su un vertice lo elimina. Poi
          «Ridisponi» per rimettere i moduli dentro. Rotella o ± per zoom; con
          zoom attivo trascina lo sfondo per spostare la vista (Shift+trascina =
          riquadro). Rotazione fine ±1° / ±5° (tasti [ ] , anche Shift). Vicini
          entro ~30 cm si attaccano.
        </p>
      ) : null}
    </div>
  )
}
