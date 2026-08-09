/**
 * Smaltisce la coda degli effetti esterni una volta sola.
 *
 *   npm run outbox
 *
 * In produzione ci pensano il cron di Vercel e lo smaltimento avviato dopo
 * ogni upload/firma. In locale nessuno chiama l'endpoint, quindi senza questo
 * comando gli eventi resterebbero in attesa.
 */
import { smaltisciCodaDrive } from '../src/lib/drive/smaltisci'
import { driveConfigurato } from '../src/lib/drive/client'
import { smaltisciCodaTelegram } from '../src/lib/telegram/smaltisci'
import { telegramConfigurato } from '../src/lib/telegram/client'

async function main(): Promise<void> {
  if (!driveConfigurato() && !telegramConfigurato()) {
    console.log(
      'Né Google Drive né Telegram sono configurati: niente da smaltire.\n' +
        'Drive: GOOGLE_DRIVE_ID + credenziali. Telegram: TELEGRAM_BOT_TOKEN.',
    )
    process.exit(0)
  }

  if (driveConfigurato()) {
    const esito = await smaltisciCodaDrive({ ripristinaFalliti: true })
    console.log(
      `Drive — elaborati ${esito.elaborati}: ${esito.completati} completati, ` +
        `${esito.rimandati} rimandati, ${esito.falliti} falliti.`,
    )
  }

  if (telegramConfigurato()) {
    const esito = await smaltisciCodaTelegram({ ripristinaFalliti: true })
    console.log(
      `Telegram — accodati ${esito.accodati}, elaborati ${esito.elaborati}: ` +
        `${esito.completati} completati, ${esito.rimandati} rimandati, ${esito.falliti} falliti.`,
    )
  }

  process.exit(0)
}

main().catch((errore: unknown) => {
  console.error(errore)
  process.exit(1)
})
