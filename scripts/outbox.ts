/**
 * Smaltisce la coda degli effetti esterni una volta sola.
 *
 *   npm run outbox
 *
 * In produzione ci pensano il cron di Vercel e lo smaltimento avviato dopo
 * ogni upload/firma. In locale nessuno chiama l'endpoint, quindi senza questo
 * comando (o senza Drive configurato) gli eventi resterebbero in attesa.
 */
import { smaltisciCodaDrive } from '../src/lib/drive/smaltisci'
import { driveConfigurato } from '../src/lib/drive/client'

async function main(): Promise<void> {
  if (!driveConfigurato()) {
    console.log(
      'Google Drive non è configurato: gli eventi restano in coda.\n' +
        'Compila GOOGLE_DRIVE_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_SERVICE_ACCOUNT_KEY.',
    )
    process.exit(0)
  }

  const esito = await smaltisciCodaDrive({ ripristinaFalliti: true })
  console.log(
    `Elaborati ${esito.elaborati}: ${esito.completati} completati, ` +
      `${esito.rimandati} rimandati, ${esito.falliti} falliti.`,
  )
  process.exit(0)
}

main().catch((errore: unknown) => {
  console.error(errore)
  process.exit(1)
})
