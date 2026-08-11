import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { paymentMilestones, paymentReceipts } from '@/db/schema'
import { AuthorizationError } from '@/lib/auth/policy'
import { assertCommessaInScope } from '@/lib/auth/scope-query'
import { guard } from '@/lib/auth/session'
import { getArchivio } from '@/lib/storage'

/**
 * Servizio delle contabili di pagamento.
 *
 * Stesso modello dei documenti di cantiere: mai un path pubblico, sempre
 * permesso + scope sulla commessa.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params

  try {
    const utente = await guard('read', 'invoice')

    // Nel cestino significa eliminata: non si serve (D-017).
    const file = await getDb().query.paymentReceipts.findFirst({
      where: and(eq(paymentReceipts.id, id), isNull(paymentReceipts.deletedAt)),
    })
    if (!file) {
      return NextResponse.json({ errore: 'Contabile non trovata.' }, { status: 404 })
    }

    const scadenza = await getDb().query.paymentMilestones.findFirst({
      where: eq(paymentMilestones.id, file.milestoneId),
      columns: { projectId: true },
    })
    if (!scadenza) {
      return NextResponse.json({ errore: 'Contabile non trovata.' }, { status: 404 })
    }

    await assertCommessaInScope(utente, scadenza.projectId)

    const contenuto = await getArchivio().leggi(file.storageKey)
    if (contenuto === null) {
      return NextResponse.json({ errore: 'File non più disponibile.' }, { status: 410 })
    }

    const nome = file.filename.replace(/["\\]/g, '')

    return new NextResponse(new Uint8Array(contenuto), {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(contenuto.byteLength),
        'Content-Disposition': `inline; filename="${nome}"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox; style-src 'unsafe-inline'",
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (errore) {
    if (errore instanceof AuthorizationError) {
      return NextResponse.json({ errore: 'Accesso non consentito.' }, { status: 403 })
    }
    throw errore
  }
}
