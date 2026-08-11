import { after } from 'next/server'
import { smaltisciCodaTelegram } from '@/lib/telegram/smaltisci'
import { smaltisciCodaDrive } from './smaltisci'

/**
 * Smaltisce le code dopo aver risposto all'utente (firma, caricamento, …).
 *
 * `after()` esegue il lavoro a risposta già inviata: la copia su Drive non
 * rallenta di un millisecondo l'operazione che l'ha generata, ma parte subito
 * invece di aspettare il cron.
 *
 * **Su Vercel Hobby il cron può girare una volta al giorno**, quindi questa non
 * è un'ottimizzazione: è il meccanismo principale. Il cron resta come rete di
 * sicurezza per ciò che nessuna attività umana andrebbe a toccare — gli eventi
 * falliti da rimettere in coda, i reminder di una giornata senza accessi.
 *
 * Entrambe le code, non solo Drive: un promemoria di follow-up che arriva il
 * giorno dopo è un promemoria inutile.
 */
export function avviaSmaltimentoOutbox(): void {
  after(async () => {
    try {
      await smaltisciCodaDrive()
    } catch (errore) {
      console.error('[outbox] smaltimento Drive in background fallito', {
        errore: errore instanceof Error ? errore.message : errore,
      })
    }

    try {
      // Senza `controllaSalute`: il controllo interroga più tabelle e ha senso
      // una volta al giorno dal cron, non a ogni caricamento di un documento.
      await smaltisciCodaTelegram()
    } catch (errore) {
      console.error('[outbox] smaltimento Telegram in background fallito', {
        errore: errore instanceof Error ? errore.message : errore,
      })
    }
  })
}
