import { NextResponse } from 'next/server'
import { AuthorizationError } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import { renderDocumentoPreventivoCompleto } from '@/lib/pdf/html/render-documento-completo'
import { nomeFilePreventivo } from '@/lib/pdf/dati-preventivo'
import { generaPdfPreventivo } from '@/lib/pdf/genera-preventivo'
import { preparaRenderPreventivo } from '@/lib/pdf/prepara-render-preventivo'
import { getQuoteVersionPerPdf } from '@/lib/queries/quotes'

export const runtime = 'nodejs'
/** Playwright + stampa A4 possono superare i 10s del piano Hobby. */
export const maxDuration = 60

/**
 * Download del PDF cliente per una versione di preventivo.
 *
 * `[id]` è l'identificativo di `quote_versions`, come nella pagina dettaglio.
 * I costi di acquisto non entrano mai nel documento.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params

  try {
    await guard('read', 'quote')

    const bundle = await getQuoteVersionPerPdf(id)
    if (!bundle) {
      return NextResponse.json(
        { errore: 'Preventivo non trovato o senza righe da stampare.' },
        { status: 404 },
      )
    }

    const preparato = await preparaRenderPreventivo(bundle)
    const html = renderDocumentoPreventivoCompleto(
      preparato.dati,
      preparato.pagineTecniche,
      request.url,
    )

    const pdf = await generaPdfPreventivo(preparato.dati, {
      html,
      documentiTecnici: bundle.documentiTecnici,
    })
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
  } catch (errore) {
    if (errore instanceof AuthorizationError) {
      return NextResponse.json({ errore: 'Accesso non consentito.' }, { status: 403 })
    }

    console.error('[preventivo-pdf]', errore)
    return NextResponse.json(
      {
        errore:
          'Generazione PDF non riuscita. Se il problema persiste, contattare il supporto tecnico.',
      },
      { status: 503 },
    )
  }
}
