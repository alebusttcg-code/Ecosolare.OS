import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { env } from '@/env'
import { gestoriDrive } from '@/lib/drive/gestori'
import { elaboraOutbox } from '@/lib/outbox'

/**
 * Smaltisce la coda degli effetti esterni (ADR-005).
 *
 * Da chiamare a intervalli regolari — su Vercel con un cron, in locale a mano.
 * È sicuro chiamarla in parallelo: gli eventi si prendono con `skip locked`,
 * quindi due esecuzioni sovrapposte non elaborano mai la stessa riga.
 *
 * Protetto da un token e non dalla sessione, perché chi lo chiama è un
 * pianificatore, non una persona collegata.
 */

export const dynamic = 'force-dynamic'

function confrontoSicuro(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}

export async function POST(request: Request): Promise<NextResponse> {
  const atteso = env().MAINTENANCE_TOKEN

  // Senza token configurato l'endpoint è disattivo, non aperto: un endpoint
  // che elabora la coda senza autenticazione è un modo per far chiamare Google
  // a nostro nome quante volte si vuole.
  if (!atteso) {
    return NextResponse.json({ errore: 'Endpoint non configurato.' }, { status: 503 })
  }

  // Vercel Cron manda `authorization: Bearer <CRON_SECRET>`; un chiamante
  // esterno può usare l'intestazione dedicata. Entrambe portano allo stesso
  // confronto in tempo costante.
  const fornito =
    request.headers.get('x-maintenance-token') ??
    request.headers.get('authorization')?.replace(/^Bearer /, '') ??
    ''

  if (!confrontoSicuro(fornito, atteso)) {
    return NextResponse.json({ errore: 'Non autorizzato.' }, { status: 401 })
  }

  const esito = await elaboraOutbox({ ...gestoriDrive() })
  return NextResponse.json(esito)
}
