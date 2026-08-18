/**
 * Numerazione progressiva delle fatture, **gapless**.
 *
 * Un numero saltato è un problema col fisco. Il numero si assegna incrementando
 * il contatore per (sezionale, anno) nella **stessa transazione** dell'emissione:
 * se l'emissione fallisce e la transazione torna indietro, torna indietro anche
 * il contatore, e non resta un buco. La riga di contatore si blocca per la durata
 * della transazione, quindi due emissioni simultanee si serializzano — che è
 * esattamente ciò che la numerazione progressiva richiede.
 */

import { sql } from 'drizzle-orm'
import type { Esecutore } from '@/db'
import { invoiceNumberSequences } from '@/db/schema'

export interface NumeroFattura {
  readonly sezionale: string
  readonly year: number
  readonly number: number
  /** Come si scrive sul documento. */
  readonly displayNumber: string
}

/** «2026/0001», oppure «SEZ/2026/0001» quando c'è un sezionale. */
export function formattaNumeroFattura(
  sezionale: string,
  year: number,
  number: number,
): string {
  const progressivo = String(number).padStart(4, '0')
  return sezionale ? `${sezionale}/${year}/${progressivo}` : `${year}/${progressivo}`
}

/**
 * Il prossimo numero per (sezionale, anno). Da chiamare **dentro** la transazione
 * che emette la fattura, mai da sola: il valore ha senso solo se la fattura che
 * lo usa viene scritta nella stessa transazione.
 */
export async function prossimoNumeroFattura(
  tx: Esecutore,
  sezionale: string,
  year: number,
): Promise<NumeroFattura> {
  const [riga] = await tx
    .insert(invoiceNumberSequences)
    .values({ sezionale, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [invoiceNumberSequences.sezionale, invoiceNumberSequences.year],
      set: { lastNumber: sql`${invoiceNumberSequences.lastNumber} + 1` },
    })
    .returning({ number: invoiceNumberSequences.lastNumber })

  const number = riga!.number
  return {
    sezionale,
    year,
    number,
    displayNumber: formattaNumeroFattura(sezionale, year, number),
  }
}
