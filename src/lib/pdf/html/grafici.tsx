import type { SimulazionePdf } from '@/lib/pdf/dati-preventivo'

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

export function BarraEnergia({
  valoreA,
  valoreB,
  coloreA,
  coloreB,
}: {
  readonly valoreA: number
  readonly valoreB: number
  readonly coloreA: string
  readonly coloreB: string
}) {
  const totale = Math.max(1, valoreA + valoreB)
  const pctA = Math.max(0, Math.min(100, (valoreA / totale) * 100))
  return (
    <div className="energia-barra" aria-hidden="true">
      <span style={{ width: `${pctA}%`, background: coloreA }} />
      <span style={{ width: `${100 - pctA}%`, background: coloreB }} />
    </div>
  )
}

export function GraficoMensile({ valori }: { readonly valori: readonly number[] }) {
  const dati = valori.length === 12 ? valori : Array.from({ length: 12 }, () => 0)
  const massimo = Math.max(1, ...dati)
  const width = 960
  const height = 430
  const top = 28
  const bottom = 62
  const left = 62
  const right = 18
  const plotH = height - top - bottom
  const plotW = width - left - right
  const step = plotW / 12
  const barW = step * 0.72

  return (
    <svg className="grafico-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Produzione mensile stimata">
      {[0, 0.25, 0.5, 0.75, 1].map((quota) => {
        const y = top + plotH * (1 - quota)
        return (
          <g key={quota}>
            <line x1={left} y1={y} x2={width - right} y2={y} stroke="#d7dfeb" strokeWidth="1" />
            <text x={left - 10} y={y + 4} textAnchor="end" className="grafico-asse">
              {Math.round(massimo * quota).toLocaleString('it-IT')}
            </text>
          </g>
        )
      })}
      {dati.map((valore, indice) => {
        const h = (valore / massimo) * plotH
        const x = left + indice * step + (step - barW) / 2
        const y = top + plotH - h
        return (
          <g key={MESI[indice]}>
            <rect x={x} y={y} width={barW} height={h} rx="4" fill="#2f9f70" />
            <text x={x + barW / 2} y={height - 24} textAnchor="middle" className="grafico-mese">
              {MESI[indice]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function GraficoCashflow({ punti }: { readonly punti: SimulazionePdf['cumulato'] }) {
  const dati = punti.length > 1 ? punti : [{ anno: 0, cumulatoEur: 0 }, { anno: 1, cumulatoEur: 0 }]
  const width = 960
  const height = 400
  const top = 30
  const bottom = 52
  const left = 72
  const right = 24
  const plotH = height - top - bottom
  const plotW = width - left - right
  const min = Math.min(0, ...dati.map((p) => p.cumulatoEur))
  const max = Math.max(1, ...dati.map((p) => p.cumulatoEur))
  const range = Math.max(1, max - min)
  const zeroY = top + ((max - 0) / range) * plotH
  const step = plotW / dati.length
  const barW = Math.max(7, step * 0.64)
  const rientro = dati.find((p) => p.cumulatoEur >= 0 && p.anno > 0)?.anno ?? null

  return (
    <svg className="grafico-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Flusso di cassa cumulato">
      {[min, 0, max].map((valore) => {
        const y = top + ((max - valore) / range) * plotH
        return (
          <g key={valore}>
            <line x1={left} y1={y} x2={width - right} y2={y} stroke="#d7dfeb" strokeWidth="1" />
            <text x={left - 12} y={y + 4} textAnchor="end" className="grafico-asse">
              {Math.round(valore / 1000)}k
            </text>
          </g>
        )
      })}
      {dati.map((punto, indice) => {
        const x = left + indice * step + (step - barW) / 2
        const yVal = top + ((max - punto.cumulatoEur) / range) * plotH
        const y = Math.min(zeroY, yVal)
        const h = Math.max(1, Math.abs(zeroY - yVal))
        return (
          <rect
            key={punto.anno}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx="2"
            fill={punto.cumulatoEur >= 0 ? '#2f9f70' : '#e47834'}
          />
        )
      })}
      {rientro != null ? (
        <text x={left + (rientro / Math.max(1, dati.length - 1)) * plotW + 8} y={top + 14} className="grafico-nota">
          rientro - anno {rientro}
        </text>
      ) : null}
      <text x={left} y={height - 18} className="grafico-mese">0</text>
      <text x={width - right} y={height - 18} textAnchor="end" className="grafico-mese">
        {dati.at(-1)?.anno ?? 0} anni
      </text>
    </svg>
  )
}
