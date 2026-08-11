import { NextResponse } from 'next/server'
import { AuthorizationError } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import { nomeFilePreventivo } from '@/lib/pdf/dati-preventivo'
import { generaPdfPreventivo } from '@/lib/pdf/genera-preventivo'
import { getQuoteVersionPerPdf } from '@/lib/queries/quotes'

/**
 * Download del PDF cliente per una versione di preventivo.
 *
 * `[id]` è l'identificativo di `quote_versions`, come nella pagina dettaglio.
 * I costi di acquisto non entrano mai nel documento.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params

  try {
    await guard('read', 'quote')
  } catch (errore) {
    if (errore instanceof AuthorizationError) {
      return NextResponse.json({ errore: 'Accesso non consentito.' }, { status: 403 })
    }
    throw errore
  }

  const bundle = await getQuoteVersionPerPdf(id)
  if (!bundle) {
    return NextResponse.json(
      { errore: 'Preventivo non trovato o senza righe da stampare.' },
      { status: 404 },
    )
  }

  const pdf = await generaPdfPreventivo(bundle.dati, { studio: bundle.studio })
  const nome = nomeFilePreventivo(bundle.dati.codice, bundle.dati.versione)

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.byteLength),
      'Content-Disposition': `attachment; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
