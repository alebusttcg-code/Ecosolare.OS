import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { activities, opportunities, users } from '@/db/schema'
import { accoda } from '@/lib/outbox'
import { telegramConfigurato } from './client'
import { eOraDiReminderFollowUp } from './tempo'
import { TIPO_FU_REMINDER } from './gestori'

/**
 * Accoda i reminder Telegram per i FU in scadenza oggi (Europe/Rome).
 * Idempotente grazie a dedupKey e a telegram_reminded_at.
 */
export async function accodaReminderFollowUpScaduti(): Promise<number> {
  if (!telegramConfigurato()) return 0

  const db = getDb()
  const adesso = new Date()

  const candidati = await db
    .select({
      id: activities.id,
      dueAt: activities.dueAt,
      remindedAt: activities.telegramRemindedAt,
      chatId: users.telegramChatId,
    })
    .from(activities)
    .innerJoin(users, eq(users.id, activities.assignedTo))
    .innerJoin(opportunities, eq(opportunities.id, activities.opportunityId))
    .where(
      and(
        isNotNull(activities.followUpPhase),
        isNull(activities.completedAt),
        isNull(activities.telegramRemindedAt),
        isNotNull(users.telegramChatId),
        eq(users.isActive, true),
        isNull(opportunities.deletedAt),
        isNull(opportunities.closedAt),
      ),
    )
    .limit(100)

  let accodati = 0
  for (const riga of candidati) {
    if (!eOraDiReminderFollowUp(riga.dueAt, adesso)) continue
    if (!riga.chatId) continue

    await accoda(db, {
      type: TIPO_FU_REMINDER,
      payload: { activityId: riga.id },
      dedupKey: `${TIPO_FU_REMINDER}:${riga.id}`,
    })
    accodati += 1
  }

  return accodati
}
