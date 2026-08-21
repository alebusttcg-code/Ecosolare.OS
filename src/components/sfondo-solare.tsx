'use client'

import { useEffect, useRef } from 'react'

/**
 * Sfondo animato della soglia: un tetto di pannelli all'alba, in prospettiva,
 * che cattura la prima luce. Il sole sorge, il fronte di luce raka sui moduli
 * (oro dal lato del sole, blu-vetro in ombra). È atmosfera, non decorazione:
 * racconta cosa fa l'azienda ancor prima di entrare.
 *
 * Il logo e la card restano sopra e intatti; un velo garantisce il contrasto.
 * Con `prefers-reduced-motion` la scena è statica, già illuminata.
 *
 * `variante`: 'soglia' = login, scena piena e centrata; 'accenno' = banner
 * discreto (home), più sobrio e con velo a sinistra per il saluto.
 */
export function SfondoSolare({
  variante = 'soglia',
}: {
  variante?: 'soglia' | 'accenno'
} = {}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return

    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let W = 0,
      H = 0,
      horizon = 0,
      cx = 0,
      ncol = 0,
      colW = 0
    const nrow = 18

    function layout() {
      const r = cv!.getBoundingClientRect()
      W = r.width || cv!.clientWidth || 800
      H = r.height || cv!.clientHeight || 600
      cv!.width = Math.round(W * DPR)
      cv!.height = Math.round(H * DPR)
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0)
      horizon = Math.round(H * 0.6)
      cx = W * 0.5
      ncol = Math.max(9, Math.min(22, Math.round(W / 78)))
      colW = (W * 2.0) / ncol
    }

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const c01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
    const yAt = (t: number) => horizon + (H - horizon) * Math.pow(t, 1.95)
    const sxAt = (y: number) => (y - horizon) / (H - horizon)

    function scena(time: number, load: number) {
      ctx!.clearRect(0, 0, W, H)

      // cielo: notte -> alba calda verso l'orizzonte
      const sky = ctx!.createLinearGradient(0, 0, 0, horizon + 2)
      sky.addColorStop(0, '#05080f')
      sky.addColorStop(0.55, '#0b1327')
      sky.addColorStop(0.78, '#241f3c')
      sky.addColorStop(0.9, '#5a3a44')
      sky.addColorStop(1, load > 0.4 ? '#c9824a' : '#3a2436')
      ctx!.fillStyle = sky
      ctx!.fillRect(0, 0, W, horizon + 2)

      // sole a destra (il centro resta scuro: logo e card leggibili)
      const sunX = W * 0.8
      const grow = c01(load * 1.15)
      const sunY = horizon - horizon * 0.3 * grow + 8
      const sunR = Math.max(28, H * 0.05)
      const bloom = ctx!.createRadialGradient(
        sunX,
        sunY,
        0,
        sunX,
        sunY,
        Math.max(200, W * 0.28),
      )
      bloom.addColorStop(0, 'rgba(255,236,190,' + 0.26 * grow + ')')
      bloom.addColorStop(0.45, 'rgba(232,180,110,' + 0.09 * grow + ')')
      bloom.addColorStop(1, 'rgba(232,180,110,0)')
      ctx!.fillStyle = bloom
      ctx!.fillRect(0, 0, W, horizon + 40)
      const disc = ctx!.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR)
      disc.addColorStop(0, 'rgba(255,248,228,' + grow + ')')
      disc.addColorStop(0.7, 'rgba(248,206,132,' + 0.95 * grow + ')')
      disc.addColorStop(1, 'rgba(232,180,110,0)')
      ctx!.beginPath()
      ctx!.arc(sunX, sunY, sunR, 0, 7)
      ctx!.fillStyle = disc
      ctx!.fill()

      // foschia d'orizzonte
      const haze = ctx!.createLinearGradient(0, horizon - 30, 0, horizon + 70)
      haze.addColorStop(0, 'rgba(232,180,110,0)')
      haze.addColorStop(0.5, 'rgba(240,196,130,' + 0.14 * grow + ')')
      haze.addColorStop(1, 'rgba(20,30,54,0)')
      ctx!.fillStyle = haze
      ctx!.fillRect(0, horizon - 30, W, 100)

      // tetto di pannelli in prospettiva
      const period = 13000
      const phase = reduce ? 0.42 : (time % period) / period
      const front = -0.15 + phase * 1.3
      const band = 0.2
      const half = ncol / 2

      for (let k = 0; k < nrow; k++) {
        const t0 = k / nrow,
          t1 = (k + 1) / nrow
        const yF = yAt(t0),
          yN = yAt(t1)
        const sF = sxAt(yF),
          sN = sxAt(yN)
        const gapN = Math.max(1.2, 3 * sN)
        const sky2 = 1 - t0
        for (let c = 0; c < ncol; c++) {
          const xFL = cx + (c - half) * colW * sF + gapN
          const xFR = cx + (c + 1 - half) * colW * sF - gapN
          const xNL = cx + (c - half) * colW * sN + gapN
          const xNR = cx + (c + 1 - half) * colW * sN - gapN
          const mid = (xFL + xFR + xNL + xNR) / 4,
            midY = (yF + yN) / 2
          if (Math.max(xFR, xNR) < 0 || Math.min(xFL, xNL) > W) continue
          const proj = mid / W + (1 - midY / H) * 0.5
          const d = proj - front
          let b = Math.exp(-(d * d) / (2 * band * band))
          const ds = Math.hypot(mid - sunX, midY - sunY) / (W * 0.8)
          const warm = c01(1 - ds) * grow
          b = c01(b * (0.6 + 0.7 * grow))

          const baseR = lerp(12, 36, sky2 * 0.6),
            baseG = lerp(30, 66, sky2 * 0.6),
            baseB = lerp(60, 124, sky2 * 0.6)
          const R = baseR + b * 175 + warm * 68
          const G = baseG + b * 146 + warm * 44
          const B = baseB + b * 64
          const grad = ctx!.createLinearGradient(0, yF, 0, yN)
          grad.addColorStop(
            0,
            'rgb(' + (c01(R / 255) * 255) + ',' + (c01(G / 255) * 255) + ',' + (c01(B / 255) * 255) + ')',
          )
          grad.addColorStop(
            1,
            'rgb(' + (c01((R * 0.6) / 255) * 255) + ',' + (c01((G * 0.62) / 255) * 255) + ',' + (c01((B * 0.7) / 255) * 255) + ')',
          )
          ctx!.beginPath()
          ctx!.moveTo(xNL, yN)
          ctx!.lineTo(xNR, yN)
          ctx!.lineTo(xFR, yF)
          ctx!.lineTo(xFL, yF)
          ctx!.closePath()
          ctx!.fillStyle = grad
          ctx!.fill()

          // busbar dorate che convergono
          ctx!.strokeStyle = 'rgba(233,201,110,' + (0.08 + 0.4 * b) + ')'
          ctx!.lineWidth = Math.max(0.6, 1.4 * sN)
          ctx!.beginPath()
          ctx!.moveTo(lerp(xNL, xNR, 0.34), yN)
          ctx!.lineTo(lerp(xFL, xFR, 0.34), yF)
          ctx!.moveTo(lerp(xNL, xNR, 0.66), yN)
          ctx!.lineTo(lerp(xFL, xFR, 0.66), yF)
          ctx!.stroke()

          if (b > 0.62) {
            const s = (b - 0.62) / 0.38
            ctx!.beginPath()
            ctx!.moveTo(xNL, yN)
            ctx!.lineTo(xNR, yN)
            ctx!.lineTo(xFR, yF)
            ctx!.lineTo(xFL, yF)
            ctx!.closePath()
            ctx!.fillStyle = 'rgba(255,242,214,' + 0.5 * s * s + ')'
            ctx!.fill()
          }
          ctx!.strokeStyle = 'rgba(255,255,255,' + (0.05 + 0.16 * b) + ')'
          ctx!.lineWidth = 1
          ctx!.beginPath()
          ctx!.moveTo(xFL, yF)
          ctx!.lineTo(xFR, yF)
          ctx!.stroke()
        }
      }

      // vignetta in primo piano
      const fg = ctx!.createLinearGradient(0, H * 0.6, 0, H)
      fg.addColorStop(0, 'rgba(4,7,13,0)')
      fg.addColorStop(1, 'rgba(4,7,13,0.5)')
      ctx!.fillStyle = fg
      ctx!.fillRect(0, H * 0.6, W, H * 0.4)
    }

    let raf = 0
    let t0 = 0
    function tick(t: number) {
      if (!t0) t0 = t
      const load = c01((t - t0) / 2600)
      scena(t, load)
      raf = requestAnimationFrame(tick)
    }

    layout()
    if (reduce) scena(0, 1)
    else raf = requestAnimationFrame(tick)

    let rz: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(rz)
      rz = setTimeout(() => {
        layout()
        if (reduce) scena(0, 1)
      }, 120)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      clearTimeout(rz)
    }
  }, [])

  const accenno = variante === 'accenno'
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <canvas
        ref={ref}
        className="h-full w-full"
        style={accenno ? { opacity: 0.9 } : undefined}
      />
      <div
        className="absolute inset-0"
        style={{
          background: accenno
            ? // banner: velo forte a sinistra (il saluto ci sta sopra), luce a
              // destra dove non c'è testo — stessa regola di contrasto del login
              'linear-gradient(90deg, rgba(4,7,13,0.86) 0%, rgba(4,7,13,0.5) 44%, rgba(4,7,13,0.12) 72%),' +
              'linear-gradient(180deg, rgba(4,7,13,0.42) 0%, transparent 34%, transparent 58%, rgba(4,7,13,0.72) 100%)'
            : 'radial-gradient(58% 52% at 50% 46%, rgba(4,7,13,0.55), transparent 72%),' +
              'linear-gradient(180deg, rgba(4,7,13,0.34) 0%, transparent 28%, transparent 66%, rgba(4,7,13,0.62) 100%)',
        }}
      />
    </div>
  )
}
