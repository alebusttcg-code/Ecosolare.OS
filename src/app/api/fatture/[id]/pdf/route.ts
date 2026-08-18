import { NextResponse } from 'next/server'
import { env } from '@/env'
import { AuthorizationError } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import { generaPdfFattura } from '@/lib/pdf/genera-fattura'
import { getFatturaPerPdf } from '@/lib/queries/fatture'

export const runtime = 'nodejs'
/** Playwright + stampa A4 possono superare i 10s del piano Hobby. */
export const maxDuration = 60

/**
 * PDF di cortesia di una fattura emessa. Stessa meccanica del preventivo:
 * la route HTML interna la stampa Playwright, protetta da MAINTENANCE_TOKEN.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params

  try {
    await guard('read', 'invoice')

    const tokenInterno = env().MAINTENANCE_TOKEN
    if (!tokenInterno) {
      return NextResponse.json(
        {
          errore: 'Stampa PDF non configurata.',
          dettaglio: 'Imposta MAINTENANCE_TOKEN su Vercel (stesso valore di CRON_SECRET).',
        },
        { status: 503 },
      )
    }

    const bundle = await getFatturaPerPdf(id)
    if (!bundle || bundle.fattura.status === 'bozza') {
      return NextResponse.json(
        { errore: 'Fattura non trovata o non ancora emessa.' },
        { status: 404 },
      )
    }

    const bypassProtezione = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    const pdf = await generaPdfFattura(
      new URL(`/pdf-render/interno/fatture/${id}`, request.url).toString(),
      {
        'x-pdf-interno': tokenInterno,
        ...(bypassProtezione ? { 'x-vercel-protection-bypass': bypassProtezione } : {}),
      },
    )

    const numero = (bundle.fattura.displayNumber ?? id).replace(/[/\\]/g, '-')
    const nome = `fattura-${numero}.pdf`

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
    const messaggio =
      errore instanceof Error ? errore.message : 'Errore sconosciuto in generazione PDF.'
    console.error('[fattura-pdf]', errore)
    return NextResponse.json(
      { errore: 'Generazione PDF non riuscita.', dettaglio: messaggio },
      { status: 503 },
    )
  }
}
