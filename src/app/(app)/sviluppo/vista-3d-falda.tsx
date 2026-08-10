'use client'

import { useEffect, useRef } from 'react'
import type { MeshFalda } from '@/lib/solar'

/**
 * Vista 3D leggera (canvas 2D + proiezione prospettica).
 * Orbit con drag; evita dipendenza three.js (rete npm instabile in CI/dev).
 */
export function Vista3dFalda({ mesh }: { mesh: MeshFalda | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stato = useRef({
    yaw: 0.7,
    pitch: 0.55,
    distanza: 1,
    dragging: false,
    lastX: 0,
    lastY: 0,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !mesh || mesh.vertici.length < 3) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    }
    resize()

    const xs = mesh.vertici.map((v) => v.x)
    const ys = mesh.vertici.map((v) => v.y)
    const zs = mesh.vertici.map((v) => v.z)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2
    const span = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
      Math.max(...zs) - Math.min(...zs),
      1,
    )

    const project = (x: number, y: number, z: number) => {
      const { yaw, pitch, distanza } = stato.current
      let X = (x - cx) / span
      let Y = (y - cy) / span
      let Z = (z - cz) / span
      // yaw attorno a Z (verticale locale → Y schermo dopo)
      const cosY = Math.cos(yaw)
      const sinY = Math.sin(yaw)
      ;[X, Y] = [X * cosY - Y * sinY, X * sinY + Y * cosY]
      const cosP = Math.cos(pitch)
      const sinP = Math.sin(pitch)
      ;[Y, Z] = [Y * cosP - Z * sinP, Y * sinP + Z * cosP]
      const f = 2.2 / (distanza + Z + 2.5)
      const w = canvas.width
      const h = canvas.height
      return {
        x: w / 2 + X * f * w * 0.38,
        y: h / 2 - Y * f * h * 0.38,
        depth: Z,
      }
    }

    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(5,10,20,0.85)'
      ctx.fillRect(0, 0, w, h)

      // Griglia suolo.
      ctx.strokeStyle = 'rgba(92,117,149,0.25)'
      ctx.lineWidth = 1 * dpr
      for (let i = -2; i <= 2; i++) {
        const a = project(cx + (i * span) / 2, cy - span, cz)
        const b = project(cx + (i * span) / 2, cy + span, cz)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        const c = project(cx - span, cy + (i * span) / 2, cz)
        const d = project(cx + span, cy + (i * span) / 2, cz)
        ctx.beginPath()
        ctx.moveTo(c.x, c.y)
        ctx.lineTo(d.x, d.y)
        ctx.stroke()
      }

      const faces: { depth: number; pts: { x: number; y: number }[] }[] = []
      for (let i = 0; i + 2 < mesh.indici.length; i += 3) {
        const ia = mesh.indici[i]!
        const ib = mesh.indici[i + 1]!
        const ic = mesh.indici[i + 2]!
        const va = mesh.vertici[ia]!
        const vb = mesh.vertici[ib]!
        const vc = mesh.vertici[ic]!
        const pa = project(va.x, va.y, va.z)
        const pb = project(vb.x, vb.y, vb.z)
        const pc = project(vc.x, vc.y, vc.z)
        faces.push({
          depth: (pa.depth + pb.depth + pc.depth) / 3,
          pts: [pa, pb, pc],
        })
      }
      faces.sort((a, b) => a.depth - b.depth)

      for (const f of faces) {
        ctx.beginPath()
        ctx.moveTo(f.pts[0]!.x, f.pts[0]!.y)
        ctx.lineTo(f.pts[1]!.x, f.pts[1]!.y)
        ctx.lineTo(f.pts[2]!.x, f.pts[2]!.y)
        ctx.closePath()
        const shade = 0.35 + Math.max(0, Math.min(0.45, 0.5 - f.depth * 0.2))
        ctx.fillStyle = `rgba(217,164,65,${shade})`
        ctx.strokeStyle = 'rgba(232,199,101,0.55)'
        ctx.lineWidth = 0.8 * dpr
        ctx.fill()
        ctx.stroke()
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    const onDown = (e: PointerEvent) => {
      stato.current.dragging = true
      stato.current.lastX = e.clientX
      stato.current.lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!stato.current.dragging) return
      const dx = e.clientX - stato.current.lastX
      const dy = e.clientY - stato.current.lastY
      stato.current.lastX = e.clientX
      stato.current.lastY = e.clientY
      stato.current.yaw += dx * 0.01
      stato.current.pitch = Math.max(
        0.15,
        Math.min(1.35, stato.current.pitch + dy * 0.01),
      )
    }
    const onUp = () => {
      stato.current.dragging = false
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      stato.current.distanza = Math.max(
        0.4,
        Math.min(3, stato.current.distanza + e.deltaY * 0.0015),
      )
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', resize)
    }
  }, [mesh])

  if (!mesh || mesh.vertici.length < 3) {
    return (
      <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
        Mesh 3D non disponibile: regola il poligono sulla falda o attendi il DSM.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium">Vista 3D (DSM)</h4>
        <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
          Trascina per orbitare · scroll per zoom
        </p>
      </div>
      <canvas
        ref={canvasRef}
        className="h-[260px] w-full touch-none rounded-lg border sm:h-[300px]"
        style={{ borderColor: 'var(--bordo)', cursor: 'grab' }}
      />
    </div>
  )
}
