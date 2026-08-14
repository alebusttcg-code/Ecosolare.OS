import {
  assemblaParametriFisici,
  type ParametriFisici,
} from '@/lib/domain/parametri-fisici'
import { CHIAVI_FISICA, getSetting } from '@/lib/settings'

/**
 * Carica i parametri fisici vigenti da `app_settings`.
 *
 * Ogni chiave ha come fallback il default dichiarato nel dominio: se
 * l'azienda non ha scritto nulla, il motore usa i suoi valori e funziona.
 * L'assemblaggio (e i fallback) vivono nella funzione pura `assemblaParametriFisici`,
 * così la regola si prova senza database; qui si fa solo la lettura.
 */
export async function getParametriFisici(): Promise<ParametriFisici> {
  const [
    guadagnoBifaccialePct,
    albedo,
    noct,
    coeffTemperatura,
    efficienzaInverter,
    perditaSporcamento,
    perditaOhmicheCc,
    perditaMismatch,
    perditaDegradazioneIniziale,
    perditaRiflessioneSpettro,
  ] = await Promise.all([
    getSetting<unknown>(CHIAVI_FISICA.guadagnoBifaccialePct, undefined),
    getSetting<unknown>(CHIAVI_FISICA.albedo, undefined),
    getSetting<unknown>(CHIAVI_FISICA.noct, undefined),
    getSetting<unknown>(CHIAVI_FISICA.coeffTemperatura, undefined),
    getSetting<unknown>(CHIAVI_FISICA.efficienzaInverter, undefined),
    getSetting<unknown>(CHIAVI_FISICA.perditaSporcamento, undefined),
    getSetting<unknown>(CHIAVI_FISICA.perditaOhmicheCc, undefined),
    getSetting<unknown>(CHIAVI_FISICA.perditaMismatch, undefined),
    getSetting<unknown>(CHIAVI_FISICA.perditaDegradazioneIniziale, undefined),
    getSetting<unknown>(CHIAVI_FISICA.perditaRiflessioneSpettro, undefined),
  ])

  return assemblaParametriFisici({
    guadagnoBifaccialePct,
    albedo,
    noct,
    coeffTemperatura,
    efficienzaInverter,
    perditaSporcamento,
    perditaOhmicheCc,
    perditaMismatch,
    perditaDegradazioneIniziale,
    perditaRiflessioneSpettro,
  })
}
