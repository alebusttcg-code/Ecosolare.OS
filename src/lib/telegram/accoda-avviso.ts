import { getDb } from '@/db'
import { accoda } from '@/lib/outbox'
import { getStatoSalute, problemiLeggibili } from '@/lib/queries/salute'
import { telegramConfigurato } from './client'
import { TIPO_AVVISO_SALUTE } from './gestori'

/**
 * Accoda l'avviso agli amministratori, se c'è qualcosa da dire.
 *
 * **Al massimo uno al giorno**, garantito dalla chiave di deduplica che
 * contiene la data: un guasto che dura una settimana non deve produrre
 * duecento messaggi, perché al terzo si smette di leggerli e da lì in poi il
 * sistema di avvisi è peggio che inutile — dà l'impressione di essere
 * sorvegliati mentre nessuno guarda più.
 *
 * L'avviso passa dalla coda invece di essere inviato subito: così anche
 * l'avviso stesso viene ritentato se Telegram è irraggiungibile, e non si
 * perde proprio nel momento in cui serve.
 *
 * Restituisce se c'era qualcosa da segnalare — non se è stato accodato davvero:
 * il secondo avviso dello stesso giorno viene scartato dalla deduplica, ed è
 * proprio quello che si vuole.
 */
export async function accodaAvvisoSalute(adesso = new Date()): Promise<boolean> {
  if (!telegramConfigurato()) return false

  const stato = await getStatoSalute(adesso)
  const problemi = problemiLeggibili(stato)
  if (problemi.length === 0) return false

  // Data in fuso italiano: la chiave deve cambiare a mezzanotte di Roma, non
  // di Londra, altrimenti il secondo avviso arriva a un'ora imprevedibile.
  const giorno = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
  }).format(adesso)

  await accoda(getDb(), {
    type: TIPO_AVVISO_SALUTE,
    payload: { problemi },
    dedupKey: `${TIPO_AVVISO_SALUTE}:${giorno}`,
  })

  return true
}
