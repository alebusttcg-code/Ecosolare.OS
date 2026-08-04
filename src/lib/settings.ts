import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { appSettings } from '@/db/schema'

/**
 * Lettura delle configurazioni applicative.
 *
 * Ogni valore ha un fallback esplicito: se la chiave non esiste ancora — perche'
 * il seed non e' stato eseguito o perche' e' stata aggiunta in un rilascio
 * successivo — il sistema funziona comunque. Una configurazione mancante non
 * deve mai essere un errore fatale.
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const riga = await getDb().query.appSettings.findFirst({
      where: eq(appSettings.key, key),
      columns: { value: true },
    })
    return (riga?.value as T | undefined) ?? fallback
  } catch {
    return fallback
  }
}

export const CHIAVI = {
  slaPrimaRispostaMinuti: 'sla.prima_risposta_minuti',
  giorniDefaultProssimaAzione: 'pipeline.giorni_default_prossima_azione',
  giorniAlertOpportunitaFerma: 'pipeline.giorni_alert_opportunita_ferma',
} as const

export const CHIAVI_MARGINE = {
  /** Percentuale minima sotto la quale un preventivo richiede approvazione. */
  sogliaMarginePct: 'preventivi.soglia_margine_pct',
  giorniValidita: 'preventivi.giorni_validita',
} as const
