'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FORMATI_MODULO_FV,
  formatoModuloById,
  geoAPixel,
  layoutModuliInFalda,
  moduloDaCentro,
  pixelAGeo,
  puntoInRettangoloSchermo,
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
  /** Layout manuale: valido solo se `chiave` coincide col seed corrente. */
  const [manuale, setManuale] = useState<{
    chiave: string
    moduli: RettangoloModulo[]
  } | null>(null)
  const [selezionato, setSelezionato] = useState<number | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const proiezioneRef = useRef<ProiezioneCanvas | null>(null)
  const dragRef = useRef<{
    indice: number
    offsetLat: number
    offsetLng: number
  } | null>(null)

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
  const selezionatoRef = useRef(selezionato)

  useEffect(() => {
    moduliRef.current = moduli
    selezionatoRef.current = selezionato
  }, [moduli, selezionato])

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
    setSelezionato(null)
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

    const sel = selezionatoRef.current
    moduliRef.current.forEach((m, i) => {
      const pts = m.angoli.map(toScreen)
      const attivo = sel === i
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
  }, [centro, poligono])

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
  }, [moduli, selezionato, disegna])

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

    const onDown = (e: PointerEvent) => {
      const { x, y } = coordsLocale(e)
      const hit = hitTest(x, y)
      if (hit == null) {
        setSelezionato(null)
        return
      }
      setSelezionato(hit)
      const proj = proiezioneRef.current
      if (!proj) return
      const geo = proj.fromScreen(x, y)
      const m = moduliRef.current[hit]!
      dragRef.current = {
        indice: hit,
        offsetLat: m.centro.latitude - geo.latitude,
        offsetLng: m.centro.longitude - geo.longitude,
      }
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
    }

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      const proj = proiezioneRef.current
      if (!drag || !proj || !falda) return
      const { x, y } = coordsLocale(e)
      const geo = proj.fromScreen(x, y)
      const nuovoCentro: Coordinate = {
        latitude: geo.latitude + drag.offsetLat,
        longitude: geo.longitude + drag.offsetLng,
      }
      const ricostruito = moduloDaCentro({
        centro: nuovoCentro,
        formato: formatoModuloById(formatoId),
        azimuthDegrees: falda.azimuthDegrees,
        landscape,
        origineProiezione: centro,
      })
      aggiornaModuli((prev) =>
        prev.map((m, i) => (i === drag.indice ? ricostruito : m)),
      )
    }

    const onUp = () => {
      dragRef.current = null
      canvas.style.cursor = 'grab'
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

  const eliminaSelezionato = () => {
    if (selezionato == null) return
    aggiornaModuli((prev) => prev.filter((_, i) => i !== selezionato))
    setSelezionato(null)
  }

  if (!falda || !poligono || poligono.length < 3) {
    return (
      <div
        className="flex h-full min-h-[280px] flex-col justify-center rounded-xl border px-4 py-6"
        style={{ borderColor: 'var(--bordo)', background: 'rgba(5,10,20,0.4)' }}
      >
        <h3 className="text-sm font-medium">Anteprima moduli</h3>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
          Seleziona una falda sulla mappa per disporre e spostare i pannelli
          sull’immagine satellitare.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium">Anteprima moduli</h3>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
          Falda {falda.indice + 1} · trascina i pannelli per posizionarli
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
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
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={ridisponi}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium"
          style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
        >
          Ridisponi automaticamente
        </button>
        <button
          type="button"
          onClick={eliminaSelezionato}
          disabled={selezionato == null}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-40"
          style={{
            borderColor: 'rgba(224, 133, 133, 0.45)',
            color: '#e8a0a0',
          }}
        >
          Elimina selezionato
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="h-[280px] w-full touch-none rounded-xl border sm:h-[320px]"
        style={{ borderColor: 'var(--bordo)', background: '#050a14' }}
      />

      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
        Anteprima non contrattuale: trascina i moduli sul tetto. Più avanti
        esposizione, inclinazione e superficie serviranno a stimare la
        produzione.
      </p>
    </div>
  )
}
