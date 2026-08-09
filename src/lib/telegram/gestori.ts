import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { activities, contacts, opportunities, users } from '@/db/schema'
import { etichettaFase } from '@/lib/domain/follow-up'
import type { Gestore } from '@/lib/outbox'
import { env } from '@/env'
import { inviaMessaggioTelegram, telegramConfigurato } from './client'

export const TIPO_FU_REMINDER = 'telegram.fu_reminder'

function baseUrlApp(): string {
  const daEnv = env().APP_BASE_URL
  if (daEnv && daEnv.length > 0) return daEnv.replace(/\/$/, '')
  return 'https://app.ecosolare.it'
}

async function reminderFollowUp(payload: Record<string, unknown>): Promise<void> {
  const activityId = String(payload.activityId ?? '')
  if (!activityId) throw new Error('activityId mancante nel payload Telegram.')

  const db = getDb()
  const riga = await db
    .select({
      id: activities.id,
      subject: activities.subject,
      phase: activities.followUpPhase,
      step: activities.followUpStep,
      dueAt: activities.dueAt,
      completedAt: activities.completedAt,
      remindedAt: activities.telegramRemindedAt,
      opportunityId: opportunities.id,
      opportunityCode: opportunities.code,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
      chatId: users.telegramChatId,
    })
    .from(activities)
    .innerJoin(opportunities, eq(opportunities.id, activities.opportunityId))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .innerJoin(users, eq(users.id, activities.assignedTo))
    .where(and(eq(activities.id, activityId), isNull(activities.completedAt)))
    .limit(1)
    .then((rows) => rows[0])

  // Già chiuso o già reminded: successo idempotente, non ritentare.
  if (!riga) return
  if (riga.remindedAt) return
  if (!riga.chatId) return

  const cliente = [riga.clienteNome, riga.clienteCognome].filter(Boolean).join(' ')
  const fase = riga.phase ? etichettaFase(riga.phase) : 'Follow-up'
  const link = `${baseUrlApp()}/lead/${riga.opportunityId}`
  const testo = [
    `Follow-up in scadenza`,
    ``,
    `${riga.subject}`,
    `${fase} · passo ${riga.step ?? '?'}/2`,
    `Cliente: ${cliente || '—'} (${riga.opportunityCode})`,
    `Scheda: ${link}`,
    ``,
    `Rispondi a questo messaggio con le note per smarcare il follow-up nel CRM.`,
  ].join('\n')

  const messageId = await inviaMessaggioTelegram({
    chatId: riga.chatId,
    testo,
  })

  await db
    .update(activities)
    .set({
      telegramRemindedAt: new Date(),
      telegramReminderMessageId: String(messageId),
      updatedAt: new Date(),
    })
    .where(eq(activities.id, activityId))
}

export function gestoriTelegram(): Record<string, Gestore> {
  if (!telegramConfigurato()) return {}
  return {
    [TIPO_FU_REMINDER]: reminderFollowUp,
  }
}
