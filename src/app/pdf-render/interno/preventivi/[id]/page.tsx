import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { env } from '@/env'
import { QuoteDocument } from '@/lib/pdf/html/preventivo-documento'
import { preparaRenderPreventivo } from '@/lib/pdf/prepara-render-preventivo'
import { getQuoteVersionPerPdf } from '@/lib/queries/quotes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Stampa interna preventivo',
  robots: { index: false, follow: false },
}

/**
 * Anteprima HTML usata solo da Playwright in generazione PDF.
 * Non passa dal login: richiede l'header `x-pdf-interno` con MAINTENANCE_TOKEN.
 */
export default async function PreventivoInternoPage({
  params,
}: {
  readonly params: Promise<{ id: string }>
}) {
  const segreto = env().MAINTENANCE_TOKEN
  const header = (await headers()).get('x-pdf-interno')
  if (!segreto || header !== segreto) notFound()

  const { id } = await params
  const bundle = await getQuoteVersionPerPdf(id)
  if (!bundle) notFound()

  const preparato = await preparaRenderPreventivo(bundle)

  return (
    <QuoteDocument
      dati={preparato.dati}
      pagineTecniche={preparato.pagineTecniche}
    />
  )
}
