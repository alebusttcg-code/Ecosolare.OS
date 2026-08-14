/**
 * Orchestratore fisico: dalla climatologia alla produzione.
 *
 * Mette in fila gli anelli — posizione del sole, trasposizione al piano dei
 * moduli, temperatura di cella, perdite, inverter — e li fa girare su ogni ora
 * del giorno-tipo di ogni mese, per ogni falda. Il risultato è la produzione
 * vera del sito, non una resa calibrata: cambia da tetto a tetto perché cambiano
 * la geometria, l'irraggiamento e la temperatura.
 *
 * L'uscita `produzioneMensileOraria` (12 × 24, kWh) è **la stessa forma** che
 * `autoconsumoDaMatching` vuole sul lato produzione: i due pezzi si incastrano
 * senza adattatori.
 */

import type { Climatologia } from '@/lib/solar/clima/climatologia'
import {
  GIORNO_RAPPRESENTATIVO,
  irraggiamentoExtraterrestre,
  posizioneSolare,
} from '@/lib/solar/fisica/posizione-solare'
import { trasponiHayDavies } from '@/lib/solar/fisica/trasposizione'
import {
  fattoreTemperatura,
  temperaturaCella,
} from '@/lib/solar/fisica/temperatura'
import {
  applicaInverter,
  fattorePerditeSistema,
  type PerditeSistema,
} from '@/lib/solar/fisica/perdite'
import { GIORNI_MESE } from '@/lib/domain/profili-carico'

export interface FaldaFv {
  readonly kWp: number
  readonly tiltDeg: number
  /** Azimut da Nord, gradi (180 = sud), come nei dossier. */
  readonly azimutDeg: number
}

export interface SistemaFv {
  /** Potenza CA nominale complessiva degli inverter, kW (per il clipping). */
  readonly potenzaAcMaxKw: number
  /**
   * Guadagno bifacciale, punti percentuali sulla resa CC. Zero per moduli
   * monofacciali; ~5–8% per i doppio-vetro bifacciali. È una proprietà del
   * modulo, dichiarata, non un fattore di taratura nascosto.
   */
  readonly guadagnoBifaccialePct?: number
  readonly albedo?: number
  readonly perdite?: PerditeSistema
  readonly noct?: number
  readonly coeffTemperatura?: number
  readonly efficienzaInverter?: number
}

export interface ProduzioneOraria {
  readonly kWpTotale: number
  readonly produzioneAnnuaKwh: number
  readonly resaSpecificaKwhKwp: number
  /** Irraggiamento sul piano, media pesata per potenza, kWh/m²·anno. */
  readonly poaAnnuoKwhM2: number
  /** Resa reale / resa di riferimento (POA): cattura tutte le perdite. */
  readonly performanceRatio: number
  readonly clippingKwh: number
  readonly clippingPct: number
  /** Energia per (mese, ora), kWh — pronta per il matching dell'autoconsumo. */
  readonly produzioneMensileOraria: number[][]
  readonly produzioneMensileKwh: number[]
}

function matriceZero(): number[][] {
  return Array.from({ length: 12 }, () => new Array<number>(24).fill(0))
}

export function calcolaProduzioneOraria(
  clima: Climatologia,
  falde: readonly FaldaFv[],
  sistema: SistemaFv,
): ProduzioneOraria {
  const kWpTotale = falde.reduce((s, f) => s + Math.max(0, f.kWp), 0)
  const fattorePerdite = fattorePerditeSistema(sistema.perdite)
  const bifacciale = 1 + (sistema.guadagnoBifaccialePct ?? 0) / 100

  const produzioneMensileOraria = matriceZero()
  let produzioneAnnuaKwh = 0
  let clippingKwh = 0
  let poaPesatoAnnuoWhM2 = 0 // Σ poa·kWp·giorni, poi /kWpTotale/1000 = kWh/kWp di riferimento

  if (kWpTotale <= 0) {
    return {
      kWpTotale: 0,
      produzioneAnnuaKwh: 0,
      resaSpecificaKwhKwp: 0,
      poaAnnuoKwhM2: 0,
      performanceRatio: 0,
      clippingKwh: 0,
      clippingPct: 0,
      produzioneMensileOraria,
      produzioneMensileKwh: new Array<number>(12).fill(0),
    }
  }

  for (let m = 0; m < 12; m += 1) {
    const giorno = GIORNO_RAPPRESENTATIVO[m]!
    const giorniMese = GIORNI_MESE[m]!
    const e0 = irraggiamentoExtraterrestre(giorno)

    for (let h = 0; h < 24; h += 1) {
      const ghi = clima.ghi[m]?.[h] ?? 0
      const dni = clima.dni[m]?.[h] ?? 0
      const dhi = clima.dhi[m]?.[h] ?? 0
      const tAria = clima.temperatura[m]?.[h] ?? 15
      if (ghi <= 0 && dni <= 0 && dhi <= 0) continue

      const sole = posizioneSolare(clima.lat, clima.lng, giorno, h)

      let potenzaDcKw = 0
      let poaPesatoOra = 0
      for (const falda of falde) {
        const kWp = Math.max(0, falda.kWp)
        if (kWp <= 0) continue
        const { poa } = trasponiHayDavies({
          ghi,
          dni,
          dhi,
          e0,
          zenitDeg: sole.zenitDeg,
          azimutSoleDeg: sole.azimutDeg,
          tiltDeg: falda.tiltDeg,
          azimutModuloDeg: falda.azimutDeg,
          albedo: sistema.albedo,
        })
        const tCella = temperaturaCella(tAria, poa, sistema.noct)
        const fT = fattoreTemperatura(tCella, sistema.coeffTemperatura)
        potenzaDcKw += kWp * (poa / 1000) * fT * bifacciale
        poaPesatoOra += poa * kWp
      }

      const dcDopoPerdite = potenzaDcKw * fattorePerdite
      const { potenzaAcKw, clippingKw } = applicaInverter(
        dcDopoPerdite,
        sistema.potenzaAcMaxKw,
        sistema.efficienzaInverter,
      )

      // La cella (mese, ora) accumula l'energia dell'ora ripetuta ogni giorno del mese.
      const energiaKwh = potenzaAcKw * giorniMese
      produzioneMensileOraria[m]![h] = energiaKwh
      produzioneAnnuaKwh += energiaKwh
      clippingKwh += clippingKw * giorniMese
      poaPesatoAnnuoWhM2 += poaPesatoOra * giorniMese
    }
  }

  const produzioneMensileKwh = produzioneMensileOraria.map((riga) =>
    riga.reduce((s, v) => s + v, 0),
  )
  const resaSpecificaKwhKwp = produzioneAnnuaKwh / kWpTotale
  // POA di riferimento: media pesata per potenza, in kWh/m² → anche kWh/kWp equivalenti.
  const poaAnnuoKwhM2 = poaPesatoAnnuoWhM2 / kWpTotale / 1000
  const performanceRatio =
    poaAnnuoKwhM2 > 0 ? resaSpecificaKwhKwp / poaAnnuoKwhM2 : 0
  const generatoLordoKwh = produzioneAnnuaKwh + clippingKwh

  return {
    kWpTotale,
    produzioneAnnuaKwh: Math.round(produzioneAnnuaKwh),
    resaSpecificaKwhKwp: Math.round(resaSpecificaKwhKwp),
    poaAnnuoKwhM2: Math.round(poaAnnuoKwhM2),
    performanceRatio,
    clippingKwh: Math.round(clippingKwh),
    clippingPct: generatoLordoKwh > 0 ? (clippingKwh / generatoLordoKwh) * 100 : 0,
    produzioneMensileOraria,
    produzioneMensileKwh: produzioneMensileKwh.map((v) => Math.round(v)),
  }
}
