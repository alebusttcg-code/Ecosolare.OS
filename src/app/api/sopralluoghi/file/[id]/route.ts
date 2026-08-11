import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { surveyFiles } from '@/db/schema'
import { AuthorizationError } from '@/lib/auth/policy'
import { assertFotoSopralluogoInScope } from '@/lib/auth/scope-query'
import { guard } from '@/lib/auth/session'
import { getArchivio } from '@/lib/storage'

/**
 * Servizio delle fotografie di sopralluogo.
 *
 * Stesse precauzioni del servizio documenti: permessi verificati qui, file
 * mai esposti per percorso diretto.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params

  try {
    const utente = await guard('read', 'survey')
    await assertFotoSopralluogoInScope(utente, id)
  } catch (errore) {
    if (errore instanceof AuthorizationError) {
      return NextResponse.json({ errore: 'Accesso non consentito.' }, { status: 403 })
    }
    throw errore
  }

  // Nel cestino significa eliminata: non si serve (D-017).
  const file = await getDb().query.surveyFiles.findFirst({
    where: and(eq(surveyFiles.id, id), isNull(surveyFiles.deletedAt)),
  })
  if (!file) {
    return NextResponse.json({ errore: 'Fotografia non trovata.' }, { status: 404 })
  }

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
}
