import { elaboraOutbox, riprovaFalliti, type EsitoElaborazione } from '@/lib/outbox'
import { accodaAvvisoSalute } from './accoda-avviso'
import { accodaReminderFollowUpScaduti } from './accoda-reminder'
import { gestoriTelegram } from './gestori'
import { telegramConfigurato } from './client'

export interface OpzioniSmaltimentoTelegram {
  readonly ripristinaFalliti?: boolean
  /** Controlla lo stato di salute e avvisa gli amministratori. Solo dal cron. */
  readonly controllaSalute?: boolean
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

  // L'avviso si accoda PRIMA di elaborare, così parte nello stesso giro invece
  // di aspettare il passaggio successivo — che con un cron giornaliero
  // significherebbe saperlo domani.
  if (opzioni.controllaSalute) {
    await accodaAvvisoSalute()
  }

  const esito = await elaboraOutbox(gestoriTelegram())
  return { ...esito, accodati }
}
