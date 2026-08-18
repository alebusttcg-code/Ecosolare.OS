import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { env } from '@/env'
import { FatturaDocument, type DatiFatturaPdf } from '@/lib/pdf/html/fattura-documento'
import { getFatturaPerPdf } from '@/lib/queries/fatture'
import type { SnapshotCliente } from '@/lib/fatture/snapshot'
import { CHIAVI_FATTURA, getSetting } from '@/lib/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Stampa interna fattura',
  robots: { index: false, follow: false },
}

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const dataIt = new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeZone: 'Europe/Rome' })

function importo(numerico: string): string {
  return euro.format(Number.parseFloat(numerico) || 0)
}

function rigaCitta(s: Partial<SnapshotCliente>): string | null {
  const parti = [s.cap, s.citta, s.provincia ? `(${s.provincia})` : null].filter(Boolean)
  return parti.length > 0 ? parti.join(' ') : null
}

/**
 * Anteprima HTML della fattura, usata solo da Playwright. Non passa dal login:
 * richiede l'header `x-pdf-interno` con MAINTENANCE_TOKEN.
 */
export default async function FatturaInternaPage({
  params,
}: {
  readonly params: Promise<{ id: string }>
}) {
  const segreto = env().MAINTENANCE_TOKEN
  const header = (await headers()).get('x-pdf-interno')?.trim()
  if (!segreto || header !== segreto) notFound()

  const { id } = await params
  const bundle = await getFatturaPerPdf(id)
  if (!bundle || bundle.fattura.status === 'bozza') notFound()

  const { fattura, righe } = bundle
  const snap = (fattura.clienteSnapshot ?? {}) as Partial<SnapshotCliente>
  const vat = (fattura.vatBreakdown ?? []) as ReadonlyArray<{
    aliquota: number
    imponibile: string
    imposta: string
  }>
  const aziendaPartitaIva =
    String((await getSetting(CHIAVI_FATTURA.aziendaPartitaIva, '')) ?? '').trim() || null

  const dati: DatiFatturaPdf = {
    numero: fattura.displayNumber ?? '—',
    data: fattura.dataDocumento ? dataIt.format(fattura.dataDocumento) : '',
    tipo: fattura.type,
    causale: fattura.causale,
    cliente: {
      denominazione: snap.denominazione ?? '',
      codiceFiscale: snap.codiceFiscale ?? null,
      partitaIva: snap.partitaIva ?? null,
      indirizzo: snap.indirizzo ?? null,
      cittaRiga: rigaCitta(snap),
    },
    righe: righe.map((r) => ({
      descrizione: r.descrizione,
      imponibile: importo(r.imponibile),
      aliquota: `${Number.parseFloat(r.aliquotaIva)}%`,
      imposta: importo(r.imposta),
    })),
    ripartizione: vat.map((r) => ({
      aliquota: `${r.aliquota}%`,
      imponibile: importo(r.imponibile),
      imposta: importo(r.imposta),
    })),
    imponibile: importo(fattura.imponibile),
    imposta: importo(fattura.imposta),
    totale: importo(fattura.totale),
    aziendaPartitaIva,
  }

  return <FatturaDocument dati={dati} />
}
