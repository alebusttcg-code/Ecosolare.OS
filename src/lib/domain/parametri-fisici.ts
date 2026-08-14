/**
 * I parametri fisici del motore di producibilità, come dato invece che come
 * costante (ADR-016, tappa 7a).
 *
 * Le assunzioni di sistema — perdite, albedo, temperatura, inverter, guadagno
 * bifacciale — vivevano come costanti sparse nei moduli fisici. Qui diventano un
 * oggetto unico, con un default dichiarato e un assemblatore che le compone dai
 * valori di configurazione. Il default resta la **fonte unica** dei numeri: li
 * riusa dai moduli fisici, non li ricopia.
 *
 * Questo modulo è puro: l'assemblatore prende valori grezzi (numeri o niente) e
 * riempie i buchi col default. Il caricamento da `app_settings` sta in
 * `queries/parametri-fisici.ts`.
 */

import type { SistemaFv } from '@/lib/domain/produzione-oraria'
import {
  EFFICIENZA_INVERTER_DEFAULT,
  PERDITE_STANDARD,
  type PerditeSistema,
} from '@/lib/solar/fisica/perdite'
import {
  COEFF_TEMPERATURA_DEFAULT,
  NOCT_DEFAULT,
} from '@/lib/solar/fisica/temperatura'
import { ALBEDO_DEFAULT } from '@/lib/solar/fisica/trasposizione'

export interface ParametriFisici {
  /** Guadagno bifacciale, punti percentuali sulla resa CC. */
  readonly guadagnoBifaccialePct: number
  readonly albedo: number
  readonly noct: number
  readonly coeffTemperatura: number
  readonly efficienzaInverter: number
  readonly perdite: PerditeSistema
}

/**
 * Il default dichiarato dell'impianto-tipo EcoSolare. Riusa le costanti dei
 * moduli fisici (perdite, NOCT, coeff. temperatura, albedo, inverter): cambiarle
 * lì cambia il default qui, senza due verità. Il bifacciale a +6% è la proprietà
 * dei moduli doppio-vetro che l'azienda installa.
 */
export const PARAMETRI_FISICI_PREDEFINITI: ParametriFisici = {
  guadagnoBifaccialePct: 6,
  albedo: ALBEDO_DEFAULT,
  noct: NOCT_DEFAULT,
  coeffTemperatura: COEFF_TEMPERATURA_DEFAULT,
  efficienzaInverter: EFFICIENZA_INVERTER_DEFAULT,
  perdite: PERDITE_STANDARD,
}

/** Un numero valido, oppure il fallback. Vale per number, stringa, o `{valore}`. */
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

/** I valori grezzi di configurazione, ciascuno opzionale. */
export interface ParametriFisiciGrezzi {
  readonly guadagnoBifaccialePct?: unknown
  readonly albedo?: unknown
  readonly noct?: unknown
  readonly coeffTemperatura?: unknown
  readonly efficienzaInverter?: unknown
  readonly perditaSporcamento?: unknown
  readonly perditaOhmicheCc?: unknown
  readonly perditaMismatch?: unknown
  readonly perditaDegradazioneIniziale?: unknown
  readonly perditaRiflessioneSpettro?: unknown
}

/**
 * Compone i parametri fisici dai valori grezzi, riempiendo ogni buco col
 * default. Una configurazione mancante non spegne il motore: usa il default.
 */
export function assemblaParametriFisici(
  grezzi: ParametriFisiciGrezzi = {},
): ParametriFisici {
  const d = PARAMETRI_FISICI_PREDEFINITI
  return {
    guadagnoBifaccialePct: numero(grezzi.guadagnoBifaccialePct, d.guadagnoBifaccialePct),
    albedo: numero(grezzi.albedo, d.albedo),
    noct: numero(grezzi.noct, d.noct),
    coeffTemperatura: numero(grezzi.coeffTemperatura, d.coeffTemperatura),
    efficienzaInverter: numero(grezzi.efficienzaInverter, d.efficienzaInverter),
    perdite: {
      sporcamento: numero(grezzi.perditaSporcamento, d.perdite.sporcamento),
      ohmicheCc: numero(grezzi.perditaOhmicheCc, d.perdite.ohmicheCc),
      mismatch: numero(grezzi.perditaMismatch, d.perdite.mismatch),
      degradazioneIniziale: numero(
        grezzi.perditaDegradazioneIniziale,
        d.perdite.degradazioneIniziale,
      ),
      riflessioneSpettro: numero(
        grezzi.perditaRiflessioneSpettro,
        d.perdite.riflessioneSpettro,
      ),
    },
  }
}

/**
 * Il sistema fisico completo, dai parametri più la potenza CA degli inverter del
 * preventivo (che è l'unico dato specifico dell'impianto, non della flotta).
 */
export function sistemaDaParametri(
  potenzaAcMaxKw: number,
  parametri: ParametriFisici,
): SistemaFv {
  return {
    potenzaAcMaxKw,
    guadagnoBifaccialePct: parametri.guadagnoBifaccialePct,
    albedo: parametri.albedo,
    noct: parametri.noct,
    coeffTemperatura: parametri.coeffTemperatura,
    efficienzaInverter: parametri.efficienzaInverter,
    perdite: parametri.perdite,
  }
}
