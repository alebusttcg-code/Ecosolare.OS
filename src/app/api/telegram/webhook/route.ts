import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { env } from '@/env'
import { telegramConfigurato } from '@/lib/telegram/client'
import { comeUpdateTelegram, elaboraUpdateTelegram } from '@/lib/telegram/webhook'

export const dynamic = 'force-dynamic'

function confrontoSicuro(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}

/**
 * Webhook Telegram (D-015): /start per collegare, reply per smarcare FU.
 * Autenticato con X-Telegram-Bot-Api-Secret-Token.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!telegramConfigurato()) {
    return NextResponse.json({ errore: 'Telegram non configurato.' }, { status: 503 })
  }

  const atteso = env().TELEGRAM_WEBHOOK_SECRET
  if (!atteso) {
    return NextResponse.json({ errore: 'Webhook non configurato.' }, { status: 503 })
  }

  const fornito = request.headers.get('x-telegram-bot-api-secret-token') ?? ''
  if (!confrontoSicuro(fornito, atteso)) {
    return NextResponse.json({ errore: 'Non autorizzato.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ errore: 'JSON non valido.' }, { status: 400 })
  }

  const update = comeUpdateTelegram(body)
  if (!update) {
    return NextResponse.json({ ok: true })
  }

  try {
    await elaboraUpdateTelegram(update)
  } catch (errore) {
    console.error('[telegram] webhook', {
      errore: errore instanceof Error ? errore.message : String(errore),
    })
  }

  // Sempre 200: altrimenti Telegram ritenta e può duplicare effetti.
  return NextResponse.json({ ok: true })
}
