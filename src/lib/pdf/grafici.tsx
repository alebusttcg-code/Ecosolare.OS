import { G, Path, Rect, Svg, Text } from '@react-pdf/renderer'
import { ECOSOLARE } from '@/lib/brand/ecosolare'
import { ETICHETTE_MESI_IT } from '@/lib/domain/produzione-fv'

const P = ECOSOLARE.pdf

const etichettaSvg = {
  fontSize: 6.5,
  fill: P.inchiostroMorbido,
  fontFamily: 'Helvetica',
} as const

function maxPositivo(valori: readonly number[]): number {
  let m = 0
  for (const v of valori) if (v > m) m = v
  return m > 0 ? m : 1
}

/** Barre verticali produzione mensile (12 mesi). */
export function BarreMensili({
  valori,
  width = 500,
  height = 152,
}: {
  readonly valori: readonly number[]
  readonly width?: number
  readonly height?: number
}) {
  const mesi =
    valori.length >= 12
      ? valori.slice(0, 12)
      : [...valori, ...Array(12 - valori.length).fill(0)]
  const max = maxPositivo(mesi)
  const padL = 36
  const padR = 10
  const padB = 24
  const padT = 14
  const plotW = width - padL - padR
  const plotH = height - padB - padT
  const gap = 5
  const barW = (plotW - gap * 11) / 12

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect
        x={padL}
        y={padT}
        width={plotW}
        height={plotH}
        fill={P.cartaSoft}
        rx={2}
      />
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = padT + plotH * (1 - f)
        const tick = Math.round(max * f)
        return (
          <G key={f}>
            <Path
              d={`M ${padL} ${y} L ${width - padR} ${y}`}
              stroke={P.linea}
              strokeWidth={0.7}
            />
            <Text
              x={padL - 4}
              y={y + 2}
              style={{ ...etichettaSvg, fontSize: 5.5, textAnchor: 'end' }}
            >
              {tick.toLocaleString('it-IT')}
            </Text>
          </G>
        )
      })}
      {mesi.map((v, i) => {
        const h = (v / max) * plotH
        const x = padL + i * (barW + gap)
        const y = padT + plotH - h
        return (
          <G key={i}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 1)}
              fill={P.verde}
              rx={1.5}
            />
            <Text
              x={x + barW / 2}
              y={height - 7}
              style={{ ...etichettaSvg, textAnchor: 'middle' }}
            >
              {ETICHETTE_MESI_IT[i]}
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}

/** Barra orizzontale stacked a due segmenti. */
export function BarraStackedOrizzontale({
  a,
  b,
  coloreA,
  coloreB,
  width = 500,
  height = 16,
}: {
  readonly a: number
  readonly b: number
  readonly coloreA: string
  readonly coloreB: string
  readonly width?: number
  readonly height?: number
}) {
  const tot = a + b
  if (!(tot > 0)) {
    return (
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Rect x={0} y={0} width={width} height={height} fill={P.linea} rx={3} />
      </Svg>
    )
  }
  const wA = Math.max(2, (a / tot) * width)
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect x={0} y={0} width={width} height={height} fill={coloreB} rx={3} />
      <Rect x={0} y={0} width={wA} height={height} fill={coloreA} rx={3} />
    </Svg>
  )
}

/** Barre verticali cashflow (centesimi). */
export function BarreCashflow({
  valoriCents,
  width = 500,
  height = 128,
}: {
  readonly valoriCents: readonly number[]
  readonly width?: number
  readonly height?: number
}) {
  const max = maxPositivo(valoriCents.map((v) => Math.abs(v)))
  const padL = 10
  const padR = 10
  const padB = 20
  const padT = 10
  const plotW = width - padL - padR
  const plotH = height - padB - padT
  const n = Math.max(valoriCents.length, 1)
  const gap = 4
  const barW = (plotW - gap * (n - 1)) / n
  const zeroY = padT + plotH

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect
        x={padL}
        y={padT}
        width={plotW}
        height={plotH}
        fill={P.cartaSoft}
        rx={2}
      />
      <Path
        d={`M ${padL} ${zeroY} L ${width - padR} ${zeroY}`}
        stroke={P.linea}
        strokeWidth={1}
      />
      {valoriCents.map((c, i) => {
        const h = (Math.abs(c) / max) * plotH * 0.9
        const x = padL + i * (barW + gap)
        const positivo = c >= 0
        const y = positivo ? zeroY - h : zeroY
        return (
          <G key={i}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 1)}
              fill={positivo ? P.verde : P.arancio}
              rx={1.5}
            />
            <Text
              x={x + barW / 2}
              y={height - 5}
              style={{ ...etichettaSvg, fontSize: 6, textAnchor: 'middle' }}
            >
              {String(i + 1)}
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}
