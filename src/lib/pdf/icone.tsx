import { Path, Svg, Circle, Line, Rect } from '@react-pdf/renderer'
import { COLORE } from './design'

/**
 * Icone delle metriche.
 *
 * Nel dossier di riferimento ogni risultato della simulazione ha la sua icona,
 * e non è decorazione: dieci numeri incolonnati senza segni distintivi sono
 * una tabella che nessuno legge, dieci numeri con un pittogramma sopra sono
 * una scheda tecnica che si scorre.
 *
 * Disegnate a mano in SVG e non prese da una libreria per tre motivi: pesano
 * zero, hanno tutte lo stesso tratto — che è ciò che le fa sembrare una
 * famiglia — e non introducono una dipendenza nella catena di generazione del
 * PDF, dove ogni pacchetto in più è un rischio di rottura al deploy.
 *
 * Tutte disegnate su una griglia 24×24 con tratto 1,8: cambiare quel numero in
 * una sola icona la fa immediatamente sembrare di un altro insieme.
 */

const TRATTO = 1.8
const RIQUADRO = 24

export type NomeIcona =
  | 'pannello'
  | 'inverter'
  | 'produzione'
  | 'co2'
  | 'albero'
  | 'potenza'
  | 'rapporto'
  | 'rendimento'
  | 'batteria'
  | 'casa'
  | 'rete'
  | 'euro'
  | 'tempo'
  | 'calendario'

export function Icona({
  nome,
  dimensione = 16,
  colore = COLORE.blu,
}: {
  nome: NomeIcona
  dimensione?: number
  colore?: string
}) {
  const comune: Comune = {
    stroke: colore,
    strokeWidth: TRATTO,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  }

  return (
    <Svg
      width={dimensione}
      height={dimensione}
      viewBox={`0 0 ${RIQUADRO} ${RIQUADRO}`}
    >
      {disegno(nome, comune)}
    </Svg>
  )
}

type Comune = {
  stroke: string
  strokeWidth: number
  strokeLinecap: 'round'
  strokeLinejoin: 'round'
  fill: 'none'
}

function disegno(nome: NomeIcona, c: Comune) {
  switch (nome) {
    /** Modulo fotovoltaico visto in pianta, con le celle. */
    case 'pannello':
      return (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={1} {...c} />
          <Line x1={9} y1={5} x2={9} y2={19} {...c} />
          <Line x1={15} y1={5} x2={15} y2={19} {...c} />
          <Line x1={3} y1={12} x2={21} y2={12} {...c} />
        </>
      )

    /** Inverter: cassa con l'onda della conversione CC → CA. */
    case 'inverter':
      return (
        <>
          <Rect x={4} y={3} width={16} height={18} rx={2} {...c} />
          <Path d="M7 13 Q 9.5 8, 12 13 T 17 13" {...c} />
          <Line x1={8} y1={17} x2={16} y2={17} {...c} />
        </>
      )

    /** Sole: la produzione. */
    case 'produzione':
      return (
        <>
          <Circle cx={12} cy={12} r={4.2} {...c} />
          <Line x1={12} y1={2.5} x2={12} y2={5} {...c} />
          <Line x1={12} y1={19} x2={12} y2={21.5} {...c} />
          <Line x1={2.5} y1={12} x2={5} y2={12} {...c} />
          <Line x1={19} y1={12} x2={21.5} y2={12} {...c} />
          <Line x1={5.3} y1={5.3} x2={7} y2={7} {...c} />
          <Line x1={17} y1={17} x2={18.7} y2={18.7} {...c} />
          <Line x1={5.3} y1={18.7} x2={7} y2={17} {...c} />
          <Line x1={17} y1={7} x2={18.7} y2={5.3} {...c} />
        </>
      )

    /** Nuvola di emissioni evitate. */
    case 'co2':
      return (
        <>
          <Path d="M7 17 A 4 4 0 0 1 7 9 A 5.5 5.5 0 0 1 17.5 10 A 3.5 3.5 0 0 1 17 17 Z" {...c} />
          <Line x1={9.5} y1={20.5} x2={10.5} y2={19} {...c} />
          <Line x1={14} y1={20.5} x2={15} y2={19} {...c} />
        </>
      )

    /** Albero: la CO₂ in termini che si capiscono. */
    case 'albero':
      return (
        <>
          <Path d="M12 3 L 6.5 11 L 9.5 11 L 5.5 17 L 18.5 17 L 14.5 11 L 17.5 11 Z" {...c} />
          <Line x1={12} y1={17} x2={12} y2={21} {...c} />
        </>
      )

    /** Fulmine: potenza. */
    case 'potenza':
      return <Path d="M13.5 2.5 L 5.5 13.5 L 11 13.5 L 10.5 21.5 L 18.5 10.5 L 13 10.5 Z" {...c} />

    /** Bilancia: un rapporto fra due grandezze. */
    case 'rapporto':
      return (
        <>
          <Line x1={12} y1={4} x2={12} y2={20} {...c} />
          <Line x1={5} y1={20} x2={19} y2={20} {...c} />
          <Line x1={4} y1={8} x2={20} y2={8} {...c} />
          <Path d="M4 8 L 1.5 14 L 6.5 14 Z" {...c} />
          <Path d="M20 8 L 17.5 14 L 22.5 14 Z" {...c} />
        </>
      )

    /** Quadrante: rendimento, performance. */
    case 'rendimento':
      return (
        <>
          <Path d="M3.5 17 A 9 9 0 0 1 20.5 17" {...c} />
          <Line x1={12} y1={17} x2={16.5} y2={11.5} {...c} />
          <Circle cx={12} cy={17} r={1.3} {...c} />
        </>
      )

    /** Batteria con il livello di carica. */
    case 'batteria':
      return (
        <>
          <Rect x={2.5} y={7} width={17} height={10} rx={1.5} {...c} />
          <Line x1={21.5} y1={10.5} x2={21.5} y2={13.5} {...c} />
          <Line x1={6} y1={10.5} x2={6} y2={13.5} {...c} />
          <Line x1={10} y1={10.5} x2={10} y2={13.5} {...c} />
          <Line x1={14} y1={10.5} x2={14} y2={13.5} {...c} />
        </>
      )

    /** Casa: l'energia che resta in casa. */
    case 'casa':
      return (
        <>
          <Path d="M3.5 11 L 12 4 L 20.5 11" {...c} />
          <Path d="M5.5 10 L 5.5 20 L 18.5 20 L 18.5 10" {...c} />
          <Line x1={10} y1={20} x2={10} y2={14.5} {...c} />
          <Line x1={14} y1={20} x2={14} y2={14.5} {...c} />
          <Line x1={10} y1={14.5} x2={14} y2={14.5} {...c} />
        </>
      )

    /** Traliccio: la rete elettrica. */
    case 'rete':
      return (
        <>
          <Path d="M6 21 L 9 4 L 15 4 L 18 21" {...c} />
          <Line x1={7.5} y1={12.5} x2={16.5} y2={12.5} {...c} />
          <Line x1={8.4} y1={8} x2={15.6} y2={8} {...c} />
          <Line x1={9} y1={4} x2={15} y2={12.5} {...c} />
          <Line x1={15} y1={4} x2={9} y2={12.5} {...c} />
        </>
      )

    case 'euro':
      return (
        <>
          <Path d="M17 6.5 A 7 7 0 1 0 17 17.5" {...c} />
          <Line x1={4} y1={10.5} x2={13} y2={10.5} {...c} />
          <Line x1={4} y1={13.5} x2={13} y2={13.5} {...c} />
        </>
      )

    /** Orologio: il tempo di rientro. */
    case 'tempo':
      return (
        <>
          <Circle cx={12} cy={12} r={8.5} {...c} />
          <Path d="M12 7 L 12 12 L 15.5 14" {...c} />
        </>
      )

    case 'calendario':
      return (
        <>
          <Rect x={3.5} y={5} width={17} height={16} rx={2} {...c} />
          <Line x1={3.5} y1={10} x2={20.5} y2={10} {...c} />
          <Line x1={8} y1={2.5} x2={8} y2={7} {...c} />
          <Line x1={16} y1={2.5} x2={16} y2={7} {...c} />
        </>
      )
  }
}
