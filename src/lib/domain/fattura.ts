/**
 * Composizione di una fattura: imponibile, IVA per aliquota, totale.
 *
 * Funzione pura e in aritmetica intera (centesimi), come tutto il denaro del
 * progetto (vedere money.ts). Riusa la **stessa regola dei preventivi**: si
 * arrotonda l'imposta a livello di riga e poi si raggruppa per aliquota, così il
 * totale coincide con la somma delle righe stampate sul documento — la prassi
 * della fatturazione italiana.
 *
 * Regge anche le **note di credito**: con imponibili negativi l'imposta esce
 * negativa (`dividiArrotondando` arrotonda away-from-zero apposta), e il totale
 * è la resa in negativo della fattura che corregge.
 */

import { dividiArrotondando, SCALA_PERCENTUALE } from './money'

export interface RigaFattura {
  readonly descrizione: string
  /** Imponibile della riga, centesimi. Negativo su una nota di credito. */
  readonly imponibileCents: number
  /** Aliquota IVA in centesimi di punto (scala 100): 1000 = 10%, 2200 = 22%. */
  readonly aliquotaIva: number
  /** Natura IVA per le righe esenti/non imponibili (N1…N7). Opzionale. */
  readonly natura?: string | null
}

export interface RigaFatturaCalcolata extends RigaFattura {
  readonly impostaCents: number
}

export interface RipartizioneIvaFattura {
  readonly aliquota: number
  readonly imponibile: number
  readonly imposta: number
}

export interface TotaliFattura {
  readonly imponibileCents: number
  readonly impostaCents: number
  readonly totaleCents: number
  readonly ripartizioneIva: readonly RipartizioneIvaFattura[]
  readonly righe: readonly RigaFatturaCalcolata[]
}

/** Imposta di una riga: imponibile × aliquota, arrotondata una volta sola. */
function impostaDiRiga(imponibileCents: number, aliquotaIva: number): number {
  return dividiArrotondando(imponibileCents * aliquotaIva, SCALA_PERCENTUALE * 100)
}

export function componiFattura(righe: readonly RigaFattura[]): TotaliFattura {
  const calcolate: RigaFatturaCalcolata[] = righe.map((r) => ({
    ...r,
    impostaCents: impostaDiRiga(Math.round(r.imponibileCents), r.aliquotaIva),
  }))

  // Raggruppamento per aliquota, come nei preventivi: il documento espone una
  // riga di riepilogo IVA per ciascuna aliquota presente.
  const perAliquota = new Map<number, { imponibile: number; imposta: number }>()
  for (const r of calcolate) {
    const corrente = perAliquota.get(r.aliquotaIva) ?? { imponibile: 0, imposta: 0 }
    perAliquota.set(r.aliquotaIva, {
      imponibile: corrente.imponibile + Math.round(r.imponibileCents),
      imposta: corrente.imposta + r.impostaCents,
    })
  }

  const imponibileCents = calcolate.reduce((s, r) => s + Math.round(r.imponibileCents), 0)
  const impostaCents = calcolate.reduce((s, r) => s + r.impostaCents, 0)

  return {
    imponibileCents,
    impostaCents,
    totaleCents: imponibileCents + impostaCents,
    ripartizioneIva: [...perAliquota.entries()]
      .map(([aliquota, v]) => ({ aliquota, imponibile: v.imponibile, imposta: v.imposta }))
      .sort((a, b) => a.aliquota - b.aliquota),
    righe: calcolate,
  }
}

/**
 * La bozza di fattura per una tranche del piano pagamenti.
 *
 * Una milestone porta il suo imponibile (`amountNet`); l'aliquota arriva dalla
 * configurazione (10% agevolata sul fotovoltaico, di norma) e la descrizione dal
 * suo `label`. Una riga sola: l'acconto o il saldo di quella tranche.
 */
export function componiFatturaDaMilestone(input: {
  readonly importoNetCents: number
  readonly aliquotaIva: number
  readonly descrizione: string
  readonly natura?: string | null
}): TotaliFattura {
  return componiFattura([
    {
      descrizione: input.descrizione,
      imponibileCents: Math.round(input.importoNetCents),
      aliquotaIva: input.aliquotaIva,
      natura: input.natura ?? null,
    },
  ])
}
