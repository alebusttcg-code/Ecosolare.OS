import React from 'react'
import { Line, Rect, Svg, Text as SvgText } from '@react-pdf/renderer'
import { COLORE } from './design'

/**
 * Il flusso di cassa cumulato: il grafico che vende l'impianto.
 *
 * Il precedente mostrava dodici barre verdi quasi identiche, senza asse e senza
 * zero. Diceva «ogni anno risparmi qualcosa», che il cliente sapeva già.
 *
 * Questo mostra un'altra cosa: le prime barre stanno **sotto** la linea dello
 * zero — sono i soldi ancora da recuperare — e a un certo punto la
 * attraversano. Quel punto è il momento in cui l'impianto si è ripagato, e il
 * cliente lo vede senza che nessuno glielo spieghi. È l'unico grafico del
 * dossier che risponde alla domanda che si sta davvero facendo.
 *
 * Disegnato in SVG a mano: React-PDF non ha grafici, e le librerie che li
 * generano producono nodi che il suo motore non sa impaginare.
 */

export interface PuntoCashflow {
  readonly anno: number
  /** Flusso cumulato a fine anno, in euro. Negativo prima del rientro. */
  readonly cumulatoEur: number
}

/** Passi ammessi per la scala verticale: solo numeri che una persona legge. */
const PASSI = [500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000]

function passoScala(intervallo: number, divisioniDesiderate: number): number {
  const grezzo = intervallo / divisioniDesiderate
  return PASSI.find((p) => p >= grezzo) ?? PASSI[PASSI.length - 1]!
}

function formattaMigliaia(valore: number): string {
  const arrotondato = Math.round(valore)
  if (Math.abs(arrotondato) >= 1000) {
    return `${(arrotondato / 1000).toLocaleString('it-IT', { maximumFractionDigits: 0 })}k`
  }
  return arrotondato.toLocaleString('it-IT')
}

export function GraficoCashflowCumulato({
  punti,
  larghezza,
  altezza = 190,
}: {
  punti: readonly PuntoCashflow[]
  larghezza: number
  altezza?: number
}) {
  if (punti.length === 0) return null

  const margineSinistro = 34
  const margineDestro = 6
  const margineSuperiore = 8
  const margineInferiore = 20

  const areaLarghezza = larghezza - margineSinistro - margineDestro
  const areaAltezza = altezza - margineSuperiore - margineInferiore

  const valori = punti.map((p) => p.cumulatoEur)
  const minimo = Math.min(0, ...valori)
  const massimo = Math.max(0, ...valori)

  const passo = passoScala(massimo - minimo, 5)
  const basso = Math.floor(minimo / passo) * passo
  const alto = Math.ceil(massimo / passo) * passo
  const intervallo = alto - basso || 1

  const y = (valore: number): number =>
    margineSuperiore + areaAltezza * (1 - (valore - basso) / intervallo)

  const yZero = y(0)

  const passoX = areaLarghezza / punti.length
  const larghezzaBarra = Math.max(2, passoX * 0.62)

  /** Il primo anno in positivo: è il momento del rientro. */
  const indiceRientro = punti.findIndex((p) => p.cumulatoEur >= 0)

  const tacche: number[] = []
  for (let v = basso; v <= alto + 0.5; v += passo) tacche.push(v)

  return (
    <Svg width={larghezza} height={altezza}>
      {/* Griglia orizzontale: leggera, sotto tutto il resto. */}
      {tacche.map((v) => (
        <Line
          key={`g${v}`}
          x1={margineSinistro}
          y1={y(v)}
          x2={larghezza - margineDestro}
          y2={y(v)}
          stroke={v === 0 ? COLORE.lineaForte : COLORE.linea}
          strokeWidth={v === 0 ? 1 : 0.5}
        />
      ))}

      {tacche.map((v) => (
        <SvgText
          key={`t${v}`}
          x={margineSinistro - 4}
          y={y(v) + 2.4}
          style={{ fontSize: 6, fill: COLORE.inchiostroTenue, textAnchor: 'end' }}
        >
          {formattaMigliaia(v)}
        </SvgText>
      ))}

      {punti.map((p, i) => {
        const positivo = p.cumulatoEur >= 0
        const x = margineSinistro + passoX * i + (passoX - larghezzaBarra) / 2
        const cima = positivo ? y(p.cumulatoEur) : yZero
        const altezzaBarra = Math.max(0.8, Math.abs(y(p.cumulatoEur) - yZero))

        return (
          <Rect
            key={p.anno}
            x={x}
            y={cima}
            width={larghezzaBarra}
            height={altezzaBarra}
            // Arancio finché si è in perdita, verde da quando si è rientrati:
            // il cambio di colore fa il lavoro di una legenda.
            fill={positivo ? COLORE.verde : COLORE.arancio}
          />
        )
      })}

      {/* Etichette degli anni: una ogni cinque, o si accavallano. */}
      {punti.map((p, i) =>
        p.anno % 5 === 0 || i === 0 ? (
          <SvgText
            key={`a${p.anno}`}
            x={margineSinistro + passoX * i + passoX / 2}
            y={altezza - 8}
            style={{ fontSize: 6, fill: COLORE.inchiostroTenue, textAnchor: 'middle' }}
          >
            {String(p.anno)}
          </SvgText>
        ) : null,
      )}

      {/* La linea del rientro, con l'anno scritto sopra. */}
      {indiceRientro > 0 ? (
        <>
          <Line
            x1={margineSinistro + passoX * indiceRientro}
            y1={margineSuperiore}
            x2={margineSinistro + passoX * indiceRientro}
            y2={altezza - margineInferiore}
            stroke={COLORE.bluScuro}
            strokeWidth={0.8}
            strokeDasharray="2 2"
          />
          <SvgText
            x={margineSinistro + passoX * indiceRientro + 3}
            y={margineSuperiore + 7}
            style={{ fontSize: 6.5, fill: COLORE.bluScuro }}
          >
            {`rientro · anno ${punti[indiceRientro]!.anno}`}
          </SvgText>
        </>
      ) : null}
    </Svg>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Barra a segmenti con la percentuale scritta dentro.
 *
 * La versione precedente metteva i colori nella barra e i numeri in una legenda
 * sotto: per sapere quanto valesse il segmento verde bisognava spostare gli
 * occhi e ricostruire l'abbinamento. Scrivere la percentuale dentro il
 * segmento toglie quel passaggio — che è esattamente ciò che fa il dossier di
 * riferimento.
 */
export interface SegmentoBarra {
  readonly valore: number
  readonly colore: string
  readonly etichetta: string
}

export function BarraSegmentata({
  segmenti,
  larghezza,
  altezza = 26,
}: {
  segmenti: readonly SegmentoBarra[]
  larghezza: number
  altezza?: number
}) {
  const totale = segmenti.reduce((s, x) => s + Math.max(0, x.valore), 0)
  if (totale <= 0) return null

  /*
   * Le ascisse si calcolano prima del render: mutare un accumulatore dentro
   * `map` è il tipo di scrittura che funziona finché qualcuno non riordina i
   * segmenti, e allora sbaglia in silenzio.
   */
  const disposti = segmenti.reduce<
    { readonly x: number; readonly larghezza: number; readonly quota: number; readonly colore: string }[]
  >((acc, s) => {
    const quota = Math.max(0, s.valore) / totale
    const precedente = acc[acc.length - 1]
    const x = precedente ? precedente.x + precedente.larghezza : 0
    return [...acc, { x, larghezza: larghezza * quota, quota, colore: s.colore }]
  }, [])

  return (
    <Svg width={larghezza} height={altezza}>
      {disposti.map((s, i) => {
        const larghezzaSegmento = s.larghezza
        const x = s.x
        const percentuale = Math.round(s.quota * 100)

        return (
          <React.Fragment key={i}>
            <Rect
              x={x}
              y={0}
              width={larghezzaSegmento}
              height={altezza}
              fill={s.colore}
            />
            {/* Sotto i 26 punti di larghezza il numero non ci sta: meglio
                niente che una cifra tagliata a metà. */}
            {larghezzaSegmento > 26 ? (
              <SvgText
                x={x + larghezzaSegmento / 2}
                y={altezza / 2 + 3}
                style={{
                  fontSize: 8.5,
                  fill: COLORE.carta,
                  textAnchor: 'middle',
                  fontWeight: 700,
                }}
              >
                {`${percentuale}%`}
              </SvgText>
            ) : null}
          </React.Fragment>
        )
      })}
    </Svg>
  )
}
