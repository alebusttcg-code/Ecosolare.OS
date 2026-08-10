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
  spostaModulo,
  type Coordinate,
  type FaldaTetto,
  type RettangoloModulo,
} from '@/lib/solar'

const ZOOM = 20
const SCALE = 2

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

export function EditorModuli({
  falda,
  poligono,
}: {
  falda: FaldaTetto | null
  poligono: readonly Coordinate[] | null
}) {
  const [formatoId, setFormatoId] = useState(FORMATI_MODULO_FV[0]!.id)
  const [quantita, setQuantita] = useState(12)
  const [landscape, setLandscape] = useState(true)
  const [manuale, setManuale] = useState<{
    chiave: string
    moduli: RettangoloModulo[]
  } | null>(null)
  const [selezionati, setSelezionati] = useState<ReadonlySet<number>>(
    () => new Set(),
  )
  const [marqueeLive, setMarqueeLive] = useState<{
    x0: number
    y0: number
    x1: number
    y1: number
  } | null>(null)
  const [schermoIntero, setSchermoIntero] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const proiezioneRef = useRef<ProiezioneCanvas | null>(null)
  const dragRef = useRef<DragMode | null>(null)

  const centro = useMemo(
    () =>
      poligono && poligono.length >= 3
        ? centroide(poligono)
        : falda?.center ?? null,
    [poligono, falda],
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

  const moduli =
    manuale && manuale.chiave === seedKey ? manuale.moduli : autoModuli

  const moduliRef = useRef(moduli)
  const selezionatiRef = useRef(selezionati)

  useEffect(() => {
    moduliRef.current = moduli
    selezionatiRef.current = selezionati
  }, [moduli, selezionati])

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

  const urlStatica = centro
    ? `/api/sviluppo/mappa?lat=${centro.latitude}&lng=${centro.longitude}&zoom=${ZOOM}&marker=0`
    : null

  const disegna = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img?.complete || !centro || !poligono || poligono.length < 3) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.clientWidth || 400
    const h = canvas.clientHeight || 320
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    const dw = img.naturalWidth * scale
    const dh = img.naturalHeight * scale
    const ox = (w - dw) / 2
    const oy = (h - dh) / 2
    const mapW = img.naturalWidth
    const mapH = img.naturalHeight

    const toScreen = (c: Coordinate) => {
      const p = geoAPixel(c, centro, ZOOM, SCALE, mapW, mapH)
      return { x: ox + p.x * scale, y: oy + p.y * scale }
    }
    const fromScreen = (sx: number, sy: number) => {
      const mx = (sx - ox) / scale
      const my = (sy - oy) / scale
      return pixelAGeo(mx, my, centro, ZOOM, SCALE, mapW, mapH)
    }
    proiezioneRef.current = { toScreen, fromScreen }

    ctx.fillStyle = '#050a14'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, ox, oy, dw, dh)

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

    const mq = marqueeLive
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
  }, [centro, poligono, marqueeLive])

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
    img.onerror = () => {
      if (annullato) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const w = canvas.clientWidth || 400
      const h = canvas.clientHeight || 320
      canvas.width = w
      canvas.height = h
      ctx.fillStyle = '#0a1528'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#5c7595'
      ctx.font = '12px sans-serif'
      ctx.fillText('Anteprima satellitare non disponibile', 16, 28)
    }
    img.src = urlStatica

    return () => {
      annullato = true
    }
  }, [urlStatica, centro, poligono, disegna])

  useEffect(() => {
    disegna()
  }, [moduli, selezionati, disegna])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !falda || !poligono || !centro) return

    const coordsLocale = (e: PointerEvent) => {
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

    const onDown = (e: PointerEvent) => {
      const { x, y } = coordsLocale(e)
      const hit = hitTest(x, y)
      const toggle = e.shiftKey || e.metaKey || e.ctrlKey

      if (hit == null) {
        if (!toggle) setSelezionati(new Set())
        dragRef.current = { tipo: 'marquee', x0: x, y0: y, x1: x, y1: y }
        setMarqueeLive({ x0: x, y0: y, x1: x, y1: y })
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
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
    }

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const { x, y } = coordsLocale(e)

      if (drag.tipo === 'marquee') {
        drag.x1 = x
        drag.y1 = y
        setMarqueeLive({ x0: drag.x0, y0: drag.y0, x1: x, y1: y })
        return
      }

      const proj = proiezioneRef.current
      if (!proj || !falda) return
      const pointer = proj.fromScreen(x, y)
      const dLat = pointer.latitude - drag.pointer0.latitude
      const dLng = pointer.longitude - drag.pointer0.longitude
      const fmt = formatoModuloById(formatoId)

      aggiornaModuli((prev) =>
        prev.map((m, i) => {
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
        }),
      )
    }

    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current
      dragRef.current = null
      canvas.style.cursor = 'grab'
      setMarqueeLive(null)

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

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.style.cursor = 'grab'

    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [falda, poligono, centro, formatoId, landscape, aggiornaModuli])

  const ruotaSelezione = (delta: number) => {
    if (!falda || !centro || selezionati.size === 0) return
    const fmt = formatoModuloById(formatoId)
    aggiornaModuli((prev) =>
      prev.map((m, i) =>
        selezionati.has(i)
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
  }

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
            Falda {falda.indice + 1} · trascina · Shift/⌘ click o riquadro per
            gruppo
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
          {selezionati.size > 0 ? ` · ${selezionati.size} sel.` : ''}
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
          onClick={() => ruotaSelezione(-15)}
          disabled={selezionati.size === 0}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
          style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
          title="Ruota −15°"
        >
          ↺ 15°
        </button>
        <button
          type="button"
          onClick={() => ruotaSelezione(15)}
          disabled={selezionati.size === 0}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
          style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
          title="Ruota +15°"
        >
          ↻ 15°
        </button>
        <button
          type="button"
          onClick={() => ruotaSelezione(90)}
          disabled={selezionati.size === 0}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
          style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
          title="Ruota 90°"
        >
          ↻ 90°
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

      <canvas
        ref={canvasRef}
        className={
          schermoIntero
            ? 'min-h-[50vh] w-full flex-1 touch-none rounded-xl border'
            : 'h-[280px] w-full touch-none rounded-xl border sm:h-[320px]'
        }
        style={{ borderColor: 'var(--bordo)', background: '#050a14' }}
      />

      {!schermoIntero ? (
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
          Shift/⌘+click o trascina un riquadro per selezionare un gruppo, poi
          sposta o ruota insieme. Usa «Tutto schermo» per lavorare più a
          largo. Anteprima non contrattuale.
        </p>
      ) : null}
    </div>
  )
}
