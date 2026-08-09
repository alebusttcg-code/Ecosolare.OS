import { env } from '@/env'

export function telegramConfigurato(): boolean {
  const token = env().TELEGRAM_BOT_TOKEN
  return Boolean(token && token.length > 0)
}

function tokenBot(): string {
  const token = env().TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN non configurato.')
  return token
}

interface RispostaTelegram {
  readonly ok: boolean
  readonly description?: string
  readonly result?: { readonly message_id?: number }
}

async function chiamaTelegram(
  metodo: string,
  corpo: Record<string, unknown>,
): Promise<RispostaTelegram> {
  const res = await fetch(`https://api.telegram.org/bot${tokenBot()}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const dati = (await res.json()) as RispostaTelegram
  if (!dati.ok) {
    throw new Error(dati.description ?? `Telegram ${metodo} fallito.`)
  }
  return dati
}

/** Invia un messaggio di testo. Restituisce il message_id. */
export async function inviaMessaggioTelegram(input: {
  readonly chatId: string
  readonly testo: string
  readonly replyToMessageId?: number
}): Promise<number> {
  const dati = await chiamaTelegram('sendMessage', {
    chat_id: input.chatId,
    text: input.testo,
    disable_web_page_preview: true,
    ...(input.replyToMessageId != null
      ? { reply_to_message_id: input.replyToMessageId }
      : {}),
  })
  const id = dati.result?.message_id
  if (id == null) throw new Error('Telegram non ha restituito message_id.')
  return id
}

export function usernameBot(): string | undefined {
  const u = env().TELEGRAM_BOT_USERNAME
  return u && u.length > 0 ? u.replace(/^@/, '') : undefined
}
