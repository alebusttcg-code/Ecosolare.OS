'use client'

import { useMemo } from 'react'
import type { ProfiloSezione } from '@/lib/solar'

export function SezioneFalda({
  profilo,
  pitchSolar,
}: {
  profilo: ProfiloSezione | null
  pitchSolar: number
}) {
  const svg = useMemo(() => {
    if (!profilo || profilo.punti.length < 2) return null
    const W = 420
    const H = 180
    const pad = { l: 44, r: 16, t: 20, b: 32 }
    const iw = W - pad.l - pad.r
    const ih = H - pad.t - pad.b
    const maxD = Math.max(...profilo.punti.map((p) => p.distanzaM), 1)
    const maxZ = Math.max(...profilo.punti.map((p) => p.quotaRelM), 0.5)

    const pts = profilo.punti.map((p) => {
      const x = pad.l + (p.distanzaM / maxD) * iw
      const y = pad.t + ih - (p.quotaRelM / maxZ) * ih
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    const baseY = pad.t + ih
    const poly = [
      `${pad.l},${baseY}`,
      ...pts,
      `${pad.l + iw},${baseY}`,
    ].join(' ')

    return { W, H, pad, iw, ih, maxD, maxZ, pts, poly, baseY }
  }, [profilo])

  if (!profilo || !svg) {
    return (
      <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
        Sezione DSM non disponibile per questo poligono (fuori copertura o quote
        mancanti).
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium">Sezione (DSM)</h4>
        <p className="text-xs tabular-nums" style={{ color: 'var(--testo-tenue)' }}>
          Δz {(profilo.quotaMaxM - profilo.quotaMinM).toFixed(1)} m
          {profilo.pitchMedioDegrees != null
            ? ` · pitch profilo ~${profilo.pitchMedioDegrees.toFixed(1)}°`
            : null}
          {' · '}Solar {pitchSolar.toFixed(1)}°
        </p>
      </div>
      <svg
        viewBox={`0 0 ${svg.W} ${svg.H}`}
        className="w-full max-w-xl rounded-lg border"
        style={{
          borderColor: 'var(--bordo)',
          background: 'rgba(5,10,20,0.55)',
        }}
        role="img"
        aria-label="Profilo sezione falda da DSM"
      >
        <line
          x1={svg.pad.l}
          y1={svg.baseY}
          x2={svg.pad.l + svg.iw}
          y2={svg.baseY}
          stroke="rgba(142,163,189,0.35)"
          strokeWidth={1}
        />
        <polygon points={svg.poly} fill="rgba(217,164,65,0.18)" />
        <polyline
          points={svg.pts.join(' ')}
          fill="none"
          stroke="#e8c765"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <text
          x={svg.pad.l}
          y={svg.H - 10}
          fill="#5c7595"
          fontSize={10}
        >
          0 m
        </text>
        <text
          x={svg.pad.l + svg.iw}
          y={svg.H - 10}
          fill="#5c7595"
          fontSize={10}
          textAnchor="end"
        >
          {svg.maxD.toFixed(0)} m
        </text>
        <text
          x={12}
          y={svg.pad.t + 4}
          fill="#5c7595"
          fontSize={10}
        >
          +{svg.maxZ.toFixed(1)} m
        </text>
      </svg>
    </div>
  )
}
