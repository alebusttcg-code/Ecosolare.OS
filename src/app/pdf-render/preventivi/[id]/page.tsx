import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { guard } from '@/lib/auth/session'
import { QuoteDocument } from '@/lib/pdf/html/preventivo-documento'
import { preparaRenderPreventivo } from '@/lib/pdf/prepara-render-preventivo'
import { getQuoteVersionPerPdf } from '@/lib/queries/quotes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Anteprima preventivo EcoSolare',
  robots: { index: false, follow: false },
}

export default async function PreventivoHtmlPage({
  params,
}: {
  readonly params: Promise<{ id: string }>
}) {
  await guard('read', 'quote')
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
