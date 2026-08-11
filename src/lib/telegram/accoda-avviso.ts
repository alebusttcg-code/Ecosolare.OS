import { and, eq, isNotNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { users } from '@/db/schema'
import { accoda } from '@/lib/outbox'
import { getStatoSalute, problemiLeggibili } from '@/lib/queries/salute'
import { telegramConfigurato } from './client'
import { TIPO_AVVISO_SALUTE } from './gestori'

/**
 * Accoda l'avviso agli amministratori, se c'è qualcosa da dire.
 *
 * **Al massimo uno al giorno per destinatario**, garantito dalla chiave di
 * deduplica che contiene data e chat: un guasto che dura una settimana non
 * deve produrre duecento messaggi, perché al terzo si smette di leggerli.
 *
 * Un evento per chat (non uno per tutti): se Telegram fallisce a metà lista,
 * il retry non reinoltra a chi aveva già ricevuto.
 *
 * Restituisce se c'era qualcosa da segnalare — non se è stato accodato davvero:
 * il secondo avviso dello stesso giorno viene scartato dalla deduplica.
 */
export async function accodaAvvisoSalute(adesso = new Date()): Promise<boolean> {
  if (!telegramConfigurato()) return false

  const stato = await getStatoSalute(adesso)
  const problemi = problemiLeggibili(stato)
  if (problemi.length === 0) return false

  const giorno = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
  }).format(adesso)

  const db = getDb()
  const destinatari = await db
    .select({ chatId: users.telegramChatId })
    .from(users)
    .where(
      and(
        eq(users.role, 'amministratore'),
        eq(users.isActive, true),
        isNotNull(users.telegramChatId),
      ),
    )

  if (destinatari.length === 0) {
    console.warn('[salute] nessun amministratore collegato a Telegram')
    return true
  }

  for (const destinatario of destinatari) {
    if (!destinatario.chatId) continue
    await accoda(db, {
      type: TIPO_AVVISO_SALUTE,
      payload: { problemi, chatId: destinatario.chatId },
      dedupKey: `${TIPO_AVVISO_SALUTE}:${giorno}:${destinatario.chatId}`,
    })
  }

  return true
}
