import { after } from 'next/server'
import { smaltisciCodaDrive } from './smaltisci'

/**
 * Avvia lo smaltimento dopo la risposta all’utente (firma, upload, …).
 * La copia su Drive non deve bloccare l’operazione; deve però partire subito,
 * non aspettare il cron.
 */
export function avviaSmaltimentoOutbox(): void {
  after(async () => {
    try {
      await smaltisciCodaDrive()
    } catch (errore) {
      console.error('[outbox] smaltimento in background fallito', {
        errore: errore instanceof Error ? errore.message : errore,
      })
    }
  })
}
