import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { documentFiles } from '@/db/schema'
import { AuthorizationError } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import { getArchivio } from '@/lib/storage'

/**
 * Servizio dei documenti caricati.
 *
 * I file non sono mai raggiungibili per percorso: si passa sempre da qui, e qui
 * si verificano i permessi. È la ragione per cui l'archivio sta fuori dalla
 * cartella pubblica.
 *
 * Le tre intestazioni in fondo non sono formalità:
 *  - `nosniff` impedisce al browser di indovinare un tipo diverso da quello
 *    dichiarato, che è il modo classico per far eseguire un file caricato;
 *  - la `Content-Security-Policy` con `sandbox` isola il contenuto anche se
 *    qualcosa sfuggisse alla validazione;
 *  - `no-store` evita che un documento riservato resti in cache condivise.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await guard('read', 'document')
  } catch (errore) {
    if (errore instanceof AuthorizationError) {
      return NextResponse.json({ errore: 'Accesso non consentito.' }, { status: 403 })
    }
    throw errore
  }

  const { id } = await params

  const file = await getDb().query.documentFiles.findFirst({
    where: eq(documentFiles.id, id),
  })
  if (!file) {
    return NextResponse.json({ errore: 'Documento non trovato.' }, { status: 404 })
  }

  const contenuto = await getArchivio().leggi(file.storageKey)
  if (contenuto === null) {
    return NextResponse.json({ errore: 'File non più disponibile.' }, { status: 410 })
  }

  // Il nome viene ripulito al caricamento, ma le virgolette si eliminano
  // comunque qui: finisce dentro un'intestazione HTTP.
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
