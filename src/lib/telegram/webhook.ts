import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { activities, users } from '@/db/schema'
import { completaAttivitaCore } from '@/lib/activities/completa'
import { inviaMessaggioTelegram } from './client'

interface MessaggioTelegram {
  readonly message_id: number
  readonly text?: string
  readonly chat: { readonly id: number }
  readonly from?: { readonly id: number; readonly username?: string }
  readonly reply_to_message?: { readonly message_id: number }
}

interface UpdateTelegram {
  readonly update_id: number
  readonly message?: MessaggioTelegram
}

/**
 * Elabora un update Telegram. Restituisce sempre (non solleva): errori → risposta
 * all'utente; la webhook deve rispondere 200 per evitare ritentativi inutili.
 */
export async function elaboraUpdateTelegram(update: UpdateTelegram): Promise<void> {
  const messaggio = update.message
  if (!messaggio?.text) return

  const chatId = String(messaggio.chat.id)
  const testo = messaggio.text.trim()

  if (testo.startsWith('/start')) {
    await gestisciStart(chatId, testo)
    return
  }

  if (testo === '/scollega' || testo.startsWith('/scollega ')) {
    await gestisciScollega(chatId)
    return
  }

  if (messaggio.reply_to_message?.message_id != null) {
    await gestisciReplyFollowUp(chatId, messaggio.reply_to_message.message_id, testo)
    return
  }

  await inviaSicuro(
    chatId,
    'Per smarcare un follow-up, rispondi al messaggio di reminder. Per collegare l’account: /start CODICE',
  )
}

async function gestisciStart(chatId: string, testo: string): Promise<void> {
  const pezzi = testo.split(/\s+/).filter(Boolean)
  const codice = pezzi[1]?.trim().toLowerCase()
  if (!codice) {
    await inviaSicuro(
      chatId,
      'Per collegare EcoSolare OS, genera un codice in Follow-up o in Utenti e invia: /start CODICE',
    )
    return
  }

  const db = getDb()
  const utente = await db.query.users.findFirst({
    where: and(eq(users.telegramLinkCode, codice), eq(users.isActive, true)),
    columns: {
      id: true,
      name: true,
      email: true,
      telegramLinkExpiresAt: true,
      telegramChatId: true,
    },
  })

  if (!utente) {
    await inviaSicuro(chatId, 'Codice non valido. Generane uno nuovo dall’app.')
    return
  }

  if (!utente.telegramLinkExpiresAt || utente.telegramLinkExpiresAt.getTime() < Date.now()) {
    await inviaSicuro(chatId, 'Codice scaduto. Generane uno nuovo dall’app (valido 15 minuti).')
    return
  }

  // Se un’altra chat aveva già questo utente, o questa chat era di un altro: sovrascrivi.
  const giaUsata = await db.query.users.findFirst({
    where: and(eq(users.telegramChatId, chatId)),
    columns: { id: true },
  })
  if (giaUsata && giaUsata.id !== utente.id) {
    await db
      .update(users)
      .set({
        telegramChatId: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, giaUsata.id))
  }

  await db
    .update(users)
    .set({
      telegramChatId: chatId,
      telegramLinkCode: null,
      telegramLinkExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, utente.id))

  const chi = utente.name ?? utente.email
  await inviaSicuro(
    chatId,
    `Collegato a EcoSolare OS come ${chi}.\nRiceverai i reminder dei follow-up in scadenza. Rispondi a quei messaggi per smarcare e salvare le note.\nPer scollegare: /scollega`,
  )
}

async function gestisciScollega(chatId: string): Promise<void> {
  const db = getDb()
  const utente = await db.query.users.findFirst({
    where: eq(users.telegramChatId, chatId),
    columns: { id: true },
  })
  if (!utente) {
    await inviaSicuro(chatId, 'Questa chat non è collegata a nessun utente.')
    return
  }

  await db
    .update(users)
    .set({
      telegramChatId: null,
      telegramLinkCode: null,
      telegramLinkExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, utente.id))

  await inviaSicuro(chatId, 'Chat scollegata. Non riceverai più reminder follow-up.')
}

async function gestisciReplyFollowUp(
  chatId: string,
  replyMessageId: number,
  note: string,
): Promise<void> {
  const db = getDb()
  const utente = await db.query.users.findFirst({
    where: eq(users.telegramChatId, chatId),
    columns: { id: true, email: true, name: true },
  })
  if (!utente) {
    await inviaSicuro(
      chatId,
      'Chat non collegata. Genera un codice in Follow-up e invia /start CODICE.',
    )
    return
  }

  const attivita = await db.query.activities.findFirst({
    where: and(
      eq(activities.telegramReminderMessageId, String(replyMessageId)),
      eq(activities.assignedTo, utente.id),
    ),
    columns: {
      id: true,
      subject: true,
      completedAt: true,
      opportunityId: true,
    },
  })

  if (!attivita) {
    await inviaSicuro(
      chatId,
      'Non trovo un follow-up collegato a quel messaggio. Rispondi al reminder del follow-up.',
    )
    return
  }

  if (attivita.completedAt) {
    await inviaSicuro(chatId, `«${attivita.subject}» è già stato smarcato.`)
    return
  }

  if (!note.trim()) {
    await inviaSicuro(chatId, 'Scrivi almeno una riga di note nella risposta.')
    return
  }

  const esito = await completaAttivitaCore({
    activityId: attivita.id,
    actorId: utente.id,
    actorLabel: utente.email,
    notes: note.trim().slice(0, 4000),
    outcome: 'via_telegram',
    prossimaDiDefaultSeManca: true,
  })

  if (!esito.ok) {
    if (esito.codice === 'gia_completata') {
      await inviaSicuro(chatId, `«${attivita.subject}» è già stato smarcato.`)
      return
    }
    await inviaSicuro(chatId, `Non sono riuscito a smarcare: ${esito.errore}`)
    return
  }

  // Conferma fuori dalla transazione (ADR-005).
  await inviaSicuro(
    chatId,
    `Follow-up smarcato: ${attivita.subject}\nNote salvate nel CRM.`,
  )
}

async function inviaSicuro(chatId: string, testo: string): Promise<void> {
  try {
    await inviaMessaggioTelegram({ chatId, testo })
  } catch (errore) {
    console.error('[telegram] invio fallito', {
      chatId,
      errore: errore instanceof Error ? errore.message : String(errore),
    })
  }
}

/** Type guard / parse grezzo dell’update. */
export function comeUpdateTelegram(body: unknown): UpdateTelegram | null {
  if (!body || typeof body !== 'object') return null
  const u = body as UpdateTelegram
  if (typeof u.update_id !== 'number') return null
  return u
}
