'use server'

import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { users } from '@/db/schema'
import { guard, requireUser } from '@/lib/auth/session'
import { telegramConfigurato, usernameBot } from '@/lib/telegram/client'
import type { ActionResult } from './opportunities'

const CODICE_TTL_MS = 15 * 60 * 1000

function errori(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) out[issue.path.join('.') || '_'] ??= issue.message
  return out
}

function generaCodice(): string {
  return randomBytes(4).toString('hex')
}

export interface StatoTelegram {
  readonly configurato: boolean
  readonly collegato: boolean
  readonly botUsername: string | undefined
  readonly codiceAttivo: string | null
  readonly codiceScadeAt: Date | null
  readonly istruzioniStart: string | null
}

/** Stato Telegram dell'utente corrente (self-service). */
export async function statoTelegramCorrente(): Promise<StatoTelegram> {
  const utente = await requireUser()
  const riga = await getDb().query.users.findFirst({
    where: eq(users.id, utente.id),
    columns: {
      telegramChatId: true,
      telegramLinkCode: true,
      telegramLinkExpiresAt: true,
    },
  })

  const codice =
    riga?.telegramLinkCode &&
    riga.telegramLinkExpiresAt &&
    riga.telegramLinkExpiresAt.getTime() > Date.now()
      ? riga.telegramLinkCode
      : null

  const bot = usernameBot()
  return {
    configurato: telegramConfigurato(),
    collegato: Boolean(riga?.telegramChatId),
    botUsername: bot,
    codiceAttivo: codice,
    codiceScadeAt: codice ? (riga?.telegramLinkExpiresAt ?? null) : null,
    istruzioniStart: codice
      ? bot
        ? `Apri @${bot} e invia: /start ${codice}`
        : `Apri il bot Telegram EcoSolare e invia: /start ${codice}`
      : null,
  }
}

/**
 * Genera un codice one-time per collegare Telegram.
 * L'utente può generarlo per sé; l'admin anche per altri.
 */
export async function generaCodiceCollegamentoTelegram(
  input: { userId?: string } = {},
): Promise<ActionResult<{ codice: string; scadeAt: Date; istruzioni: string }>> {
  const parsed = z.object({ userId: z.uuid().optional() }).safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  if (!telegramConfigurato()) {
    return {
      ok: false,
      errors: { _: 'Telegram non è configurato (manca TELEGRAM_BOT_TOKEN).' },
    }
  }

  const corrente = await requireUser()
  const bersaglioId = parsed.data.userId ?? corrente.id

  if (bersaglioId !== corrente.id) {
    await guard('update', 'user')
  }

  const db = getDb()
  const bersaglio = await db.query.users.findFirst({
    where: eq(users.id, bersaglioId),
    columns: { id: true, isActive: true },
  })
  if (!bersaglio || !bersaglio.isActive) {
    return { ok: false, errors: { _: 'Utente non trovato.' } }
  }

  const codice = generaCodice()
  const scadeAt = new Date(Date.now() + CODICE_TTL_MS)

  await db
    .update(users)
    .set({
      telegramLinkCode: codice,
      telegramLinkExpiresAt: scadeAt,
      updatedAt: new Date(),
      updatedBy: corrente.id,
    })
    .where(eq(users.id, bersaglioId))

  const bot = usernameBot()
  const istruzioni = bot
    ? `Apri @${bot} e invia: /start ${codice}`
    : `Apri il bot Telegram EcoSolare e invia: /start ${codice}`

  revalidatePath('/follow-up')
  revalidatePath('/amministrazione/utenti')
  return { ok: true, data: { codice, scadeAt, istruzioni } }
}

/** Scollega Telegram dall'utente corrente (o da un altro se admin). */
export async function scollegaTelegram(
  input: { userId?: string } = {},
): Promise<ActionResult> {
  const parsed = z.object({ userId: z.uuid().optional() }).safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  const corrente = await requireUser()
  const bersaglioId = parsed.data.userId ?? corrente.id
  if (bersaglioId !== corrente.id) {
    await guard('update', 'user')
  }

  await getDb()
    .update(users)
    .set({
      telegramChatId: null,
      telegramLinkCode: null,
      telegramLinkExpiresAt: null,
      updatedAt: new Date(),
      updatedBy: corrente.id,
    })
    .where(eq(users.id, bersaglioId))

  revalidatePath('/follow-up')
  revalidatePath('/amministrazione/utenti')
  return { ok: true, data: undefined }
}
