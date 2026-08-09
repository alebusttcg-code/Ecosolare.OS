import { elaboraOutbox, riprovaFalliti, type EsitoElaborazione } from '@/lib/outbox'
import { accodaReminderFollowUpScaduti } from './accoda-reminder'
import { gestoriTelegram } from './gestori'
import { telegramConfigurato } from './client'

export interface OpzioniSmaltimentoTelegram {
  readonly ripristinaFalliti?: boolean
}

/**
 * Accoda i reminder del giorno e smaltisce gli eventi Telegram in coda.
 */
export async function smaltisciCodaTelegram(
  opzioni: OpzioniSmaltimentoTelegram = {},
): Promise<EsitoElaborazione & { readonly accodati: number }> {
  if (!telegramConfigurato()) {
    return { elaborati: 0, completati: 0, rimandati: 0, falliti: 0, accodati: 0 }
  }

  if (opzioni.ripristinaFalliti) {
    await riprovaFalliti()
  }

  const accodati = await accodaReminderFollowUpScaduti()
  const esito = await elaboraOutbox(gestoriTelegram())
  return { ...esito, accodati }
}
