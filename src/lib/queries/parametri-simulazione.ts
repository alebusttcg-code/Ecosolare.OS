import type { ParametriSimulazioneFv } from '@/lib/domain/simulazione-fv'
import { CHIAVI_SIMULAZIONE, getSetting } from '@/lib/settings'

/**
 * Fallback operativi se il seed non ha ancora scritto le chiavi.
 * Non sono usati dai motori direttamente: solo da questo loader.
 */
const FALLBACK: ParametriSimulazioneFv & {
  tariffaImportEurKwh: number
  tariffaExportEurKwh: number
  prezzoGasEurSmc: number
} = {
  tariffaImportEurKwh: 0.3,
  tariffaExportEurKwh: 0.1,
  /** Prezzo medio del gas domestico: si affina da configurazione. */
  prezzoGasEurSmc: 1.1,
  frazioneAutoconsumoDefault: 0.4,
  detrazionePct: 50,
  detrazioneAnni: 10,
  orizzonteAnni: 25,
  inflazioneEnergiaPct: 3,
  tassoScontoPct: 5,
  degradazioneProduzionePctAnno: 0.5,
}

function numero(valore: unknown, fallback: number): number {
  if (typeof valore === 'number' && Number.isFinite(valore)) return valore
  if (typeof valore === 'string' && valore.trim() !== '') {
    const n = Number.parseFloat(valore.replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  if (valore && typeof valore === 'object' && 'valore' in valore) {
    return numero((valore as { valore: unknown }).valore, fallback)
  }
  return fallback
}

/** Carica i parametri di simulazione vigenti da `app_settings`. */
export async function getParametriSimulazioneFv(): Promise<
  ParametriSimulazioneFv & {
    tariffaImportEurKwh: number
    tariffaExportEurKwh: number
    prezzoGasEurSmc: number
  }
> {
  const [
    tariffaImportEurKwh,
    tariffaExportEurKwh,
    prezzoGasEurSmc,
    frazioneAutoconsumoDefault,
    detrazionePct,
    detrazioneAnni,
    orizzonteAnni,
    inflazioneEnergiaPct,
    tassoScontoPct,
    degradazioneProduzionePctAnno,
  ] = await Promise.all([
    getSetting(CHIAVI_SIMULAZIONE.tariffaImportEurKwh, FALLBACK.tariffaImportEurKwh),
    getSetting(CHIAVI_SIMULAZIONE.tariffaExportEurKwh, FALLBACK.tariffaExportEurKwh),
    getSetting(CHIAVI_SIMULAZIONE.prezzoGasEurSmc, FALLBACK.prezzoGasEurSmc),
    getSetting(
      CHIAVI_SIMULAZIONE.frazioneAutoconsumoDefault,
      FALLBACK.frazioneAutoconsumoDefault,
    ),
    getSetting(CHIAVI_SIMULAZIONE.detrazioneFvPct, FALLBACK.detrazionePct),
    getSetting(CHIAVI_SIMULAZIONE.detrazioneFvAnni, FALLBACK.detrazioneAnni),
    getSetting(CHIAVI_SIMULAZIONE.orizzonteAnni, FALLBACK.orizzonteAnni),
    getSetting(
      CHIAVI_SIMULAZIONE.inflazioneEnergiaPct,
      FALLBACK.inflazioneEnergiaPct,
    ),
    getSetting(CHIAVI_SIMULAZIONE.tassoScontoPct, FALLBACK.tassoScontoPct),
    getSetting(
      CHIAVI_SIMULAZIONE.degradazionePctAnno,
      FALLBACK.degradazioneProduzionePctAnno,
    ),
  ])

  return {
    tariffaImportEurKwh: numero(tariffaImportEurKwh, FALLBACK.tariffaImportEurKwh),
    tariffaExportEurKwh: numero(tariffaExportEurKwh, FALLBACK.tariffaExportEurKwh),
    prezzoGasEurSmc: numero(prezzoGasEurSmc, FALLBACK.prezzoGasEurSmc),
    frazioneAutoconsumoDefault: numero(
      frazioneAutoconsumoDefault,
      FALLBACK.frazioneAutoconsumoDefault,
    ),
    detrazionePct: numero(detrazionePct, FALLBACK.detrazionePct),
    detrazioneAnni: numero(detrazioneAnni, FALLBACK.detrazioneAnni),
    orizzonteAnni: numero(orizzonteAnni, FALLBACK.orizzonteAnni),
    inflazioneEnergiaPct: numero(
      inflazioneEnergiaPct,
      FALLBACK.inflazioneEnergiaPct,
    ),
    tassoScontoPct: numero(tassoScontoPct, FALLBACK.tassoScontoPct),
    degradazioneProduzionePctAnno: numero(
      degradazioneProduzionePctAnno,
      FALLBACK.degradazioneProduzionePctAnno,
    ),
  }
}
