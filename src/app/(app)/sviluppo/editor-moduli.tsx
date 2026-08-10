'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FORMATI_MODULO_FV,
  formatoModuloById,
  geoAPixel,
  layoutModuliInFalda,
  type Coordinate,
  type FaldaTetto,
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const centro = useMemo(
    () =>
      poligono && poligono.length >= 3
        ? centroide(poligono)
        : falda?.center ?? null,
    [poligono, falda],
  )

  const formato = formatoModuloById(formatoId)

  const layout = useMemo(() => {
    if (!falda || !poligono || poligono.length < 3) return null
    return layoutModuliInFalda({
      poligono,
      formato,
      quantita,
      azimuthDegrees: falda.azimuthDegrees,
      landscape,
    })
  }, [falda, poligono, formato, quantita, landscape])

  const urlStatica = centro
    ? `/api/sviluppo/mappa?lat=${centro.latitude}&lng=${centro.longitude}&zoom=${ZOOM}&marker=0`
    : null

  useEffect(() => {
    if (!urlStatica || !centro || !poligono || poligono.length < 3) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let annullato = false
    const img = new Image()
    imgRef.current = img
    img.onload = () => {
      if (annullato) return
      const w = canvas.clientWidth || 400
      const h = canvas.clientHeight || 320
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Cover-fit dell’immagine satellitare.
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      const ox = (w - dw) / 2
      const oy = (h - dh) / 2
      ctx.fillStyle = '#050a14'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, ox, oy, dw, dh)

      // Proiezione allineata alla static map (size 640×420 scale 2 → 1280×840).
      // Dopo cover, i pixel “logici” della mappa sono dw×dh con origine (ox,oy).
      const mapW = img.naturalWidth
      const mapH = img.naturalHeight

      const toScreen = (c: Coordinate) => {
        const p = geoAPixel(c, centro, ZOOM, SCALE, mapW, mapH)
        return { x: ox + p.x * scale, y: oy + p.y * scale }
      }

      // Poligono falda.
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

      if (layout) {
        for (const m of layout.moduli) {
          const pts = m.angoli.map(toScreen)
          ctx.beginPath()
          pts.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y)
            else ctx.lineTo(p.x, p.y)
          })
          ctx.closePath()
          ctx.fillStyle = 'rgba(30, 58, 95, 0.75)'
          ctx.strokeStyle = 'rgba(127, 178, 232, 0.95)'
          ctx.lineWidth = 1
          ctx.fill()
          ctx.stroke()
          // Linea mediana stilizzata (cella).
          const a = pts[0]!
          const b = pts[1]!
          const c = pts[2]!
          const d = pts[3]!
          ctx.strokeStyle = 'rgba(127,178,232,0.4)'
          ctx.beginPath()
          ctx.moveTo((a.x + d.x) / 2, (a.y + d.y) / 2)
          ctx.lineTo((b.x + c.x) / 2, (b.y + c.y) / 2)
          ctx.stroke()
        }
      }
    }
    img.onerror = () => {
      if (annullato || !canvas) return
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
  }, [urlStatica, centro, poligono, layout])

  if (!falda || !poligono || poligono.length < 3) {
    return (
      <div
        className="flex h-full min-h-[280px] flex-col justify-center rounded-xl border px-4 py-6"
        style={{ borderColor: 'var(--bordo)', background: 'rgba(5,10,20,0.4)' }}
      >
        <h3 className="text-sm font-medium">Anteprima moduli</h3>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
          Seleziona una falda sulla mappa per disporre i pannelli
          fotovoltaici sull’immagine satellitare (formato prestabilito).
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium">Anteprima moduli</h3>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
          Falda {falda.indice + 1} · layout dimostrativo per il cliente
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

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="inline-flex items-center gap-1.5" style={{ color: 'var(--testo-tenue)' }}>
          <input
            type="checkbox"
            checked={landscape}
            onChange={(e) => setLandscape(e.target.checked)}
          />
          Landscape (lato lungo in gronda)
        </label>
        {layout ? (
          <span className="tabular-nums" style={{ color: '#e8c765' }}>
            {layout.collocati}/{layout.richiesti} · {layout.kWp.toFixed(2)} kWp
            {layout.collocati < layout.richiesti ? ' (spazio insufficiente)' : ''}
          </span>
        ) : null}
      </div>

      <canvas
        ref={canvasRef}
        className="h-[280px] w-full rounded-xl border sm:h-[320px]"
        style={{ borderColor: 'var(--bordo)', background: '#050a14' }}
      />

      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
        Anteprima non contrattuale: moduli da listino tipologico EcoSolare,
        allineati all’esposizione Solar. Il preventivo formale userà listino e
        quantità validati.
      </p>
    </div>
  )
}
