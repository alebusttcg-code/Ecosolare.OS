/**
 * Smaltisce la coda degli effetti esterni una volta sola.
 *
 *   npm run outbox
 *
 * In produzione ci pensa il cron di Vercel (`vercel.json`). In locale nessuno
 * chiama l'endpoint, quindi senza questo comando gli eventi resterebbero in
 * attesa e la cartella su Drive non comparirebbe mai — con la spiacevole
 * conseguenza di far credere che l'integrazione non funzioni.
 */
import { gestoriDrive } from '../src/lib/drive/gestori'
import { elaboraOutbox } from '../src/lib/outbox'

async function main(): Promise<void> {
  const gestori = gestoriDrive()

  if (Object.keys(gestori).length === 0) {
    console.log(
      'Google Drive non è configurato: gli eventi in coda verranno segnati come falliti.\n' +
        'Compila GOOGLE_DRIVE_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_SERVICE_ACCOUNT_KEY.',
    )
  }

  const esito = await elaboraOutbox(gestori)
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
