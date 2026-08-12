import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { env } from '@/env'
import { guard } from '@/lib/auth/session'
import { QuoteDocument } from '@/lib/pdf/html/preventivo-documento'
import { arricchisciPlanimetriaConOrtofoto } from '@/lib/pdf/ortofoto-moduli-pdf'
import {
  caricaDocumentiTecnici,
  espandiPagineTecniche,
} from '@/lib/pdf/premium/documenti-tecnici'
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

  let planimetria = bundle.dati.planimetria
  if (
    planimetria &&
    bundle.studio &&
    !planimetria.fotoSenzaModuliDataUri
  ) {
    planimetria = await arricchisciPlanimetriaConOrtofoto(
      planimetria,
      bundle.studio,
      env().GOOGLE_MAPS_API_KEY,
    )
  }

  const documentiCaricati = await caricaDocumentiTecnici(bundle.documentiTecnici)
  const pagineTecniche = await espandiPagineTecniche(documentiCaricati)

  return (
    <QuoteDocument
      dati={{ ...bundle.dati, planimetria }}
      pagineTecniche={pagineTecniche}
    />
  )
}
