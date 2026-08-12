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

/**
 * Parametri energetici / incentivi / simulazione (A18).
 *
 * I valori vivono in `app_settings`; i motori di dominio li ricevono come
 * input e non contengono aliquote normative.
 */
export const CHIAVI_SIMULAZIONE = {
  tariffaImportEurKwh: 'energia.tariffa_import_eur_kwh',
  tariffaExportEurKwh: 'energia.tariffa_export_eur_kwh',
  /**
   * Prezzo del gas usato quando il preventivo non ne porta uno proprio.
   *
   * Senza, un preventivo con pompa di calore in cui nessuno aveva compilato il
   * campo usciva con il termico come pura voce di spesa: il costo dentro, il
   * risparmio fuori, e il rientro peggiore del vero senza un avviso.
   */
  prezzoGasEurSmc: 'energia.prezzo_gas_eur_smc',
  frazioneAutoconsumoDefault: 'energia.frazione_autoconsumo_default',
  detrazioneFvPct: 'incentivi.detrazione_fv_pct',
  detrazioneFvAnni: 'incentivi.detrazione_fv_anni',
  orizzonteAnni: 'simulazione.orizzonte_anni',
  inflazioneEnergiaPct: 'simulazione.inflazione_energia_pct',
  tassoScontoPct: 'simulazione.tasso_sconto_pct',
  degradazionePctAnno: 'simulazione.degradazione_pct_anno',
} as const
