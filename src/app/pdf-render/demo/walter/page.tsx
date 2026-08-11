import type { Metadata } from 'next'
import { QuoteDocument } from '@/lib/pdf/html/preventivo-documento'
import { WALTER_RICCI_HTML_FIXTURE } from '@/lib/pdf/html/fixture-walter'

export const metadata: Metadata = {
  title: 'Walter Ricci - Preventivo HTML EcoSolare',
  robots: { index: false, follow: false },
}

export default function WalterRicciHtmlPreview() {
  return <QuoteDocument dati={WALTER_RICCI_HTML_FIXTURE} />
}
