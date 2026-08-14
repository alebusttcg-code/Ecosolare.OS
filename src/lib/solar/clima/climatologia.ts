/**
 * Climatologia compatta di un sito: il TMY orario ridotto a **giorno-tipo
 * mensile**.
 *
 * Il TMY sono 8.760 ore. Non le teniamo tutte: per un motore a giorno-tipo
 * mensile bastano, per ogni variabile, dodici mesi × ventiquattro ore — la media
 * dell'ora `h` nel mese `m` su tutti i giorni di quel mese. È la riduzione
 * standard, compatta (288 numeri per variabile, non 8.760) e sufficiente: la
 * produzione si calcola sul giorno tipico e si moltiplica per i giorni del mese.
 *
 * La riduzione è **pura**: prende le righe già scaricate e non tocca la rete,
 * così si valida numero per numero con una fixture.
 */

import type { RigaTmy } from './pvgis'

export interface Climatologia {
  readonly fonte: 'PVGIS-TMY'
  readonly lat: number
  readonly lng: number
  readonly elevazioneM: number | null
  /** GHI annuo sul piano orizzontale, kWh/m² — la sintesi che si confronta a colpo d'occhio. */
  readonly ghiAnnuoKwhM2: number
  /** Irraggiamento globale orizzontale medio, W/m², [mese 0-11][ora 0-23]. */
  readonly ghi: number[][]
  /** Diretto normale medio, W/m², [mese][ora]. */
  readonly dni: number[][]
  /** Diffuso orizzontale medio, W/m², [mese][ora]. */
  readonly dhi: number[][]
  /** Temperatura dell'aria a 2 m media, °C, [mese][ora]. */
  readonly temperatura: number[][]
}

function matriceZero(): number[][] {
  return Array.from({ length: 12 }, () => new Array<number>(24).fill(0))
}

/** Mese [0-11] e ora [0-23] da un timestamp PVGIS «YYYYMMDD:HHMM». */
function meseOra(timeUtc: string): { mese: number; ora: number } | null {
  // Es. "20080101:0000" → mese 0 (gennaio), ora 0.
  const m = /^\d{4}(\d{2})\d{2}:(\d{2})\d{2}$/.exec(timeUtc)
  if (!m) return null
  const mese = Number(m[1]) - 1
  const ora = Number(m[2])
  if (mese < 0 || mese > 11 || ora < 0 || ora > 23) return null
  return { mese, ora }
}

/**
 * Riduce le righe orarie TMY a una climatologia compatta.
 *
 * Media per cella (mese × ora) di GHI, DNI, DHI e temperatura; GHI annuo come
 * somma di tutte le ore (W/m² per un'ora = Wh/m²) diviso mille. Le righe con
 * timestamp illeggibile si scartano invece di inquinare una media.
 */
export function riduciTmyAClimatologia(
  righe: readonly RigaTmy[],
  posizione: { lat: number; lng: number; elevazioneM?: number | null },
): Climatologia {
  const ghi = matriceZero()
  const dni = matriceZero()
  const dhi = matriceZero()
  const temperatura = matriceZero()
  const conteggio = matriceZero()

  let ghiAnnuoWhM2 = 0

  for (const r of righe) {
    const mo = meseOra(r['time(UTC)'])
    if (!mo) continue
    const { mese, ora } = mo
    ghi[mese]![ora]! += r['G(h)']
    dni[mese]![ora]! += r['Gb(n)']
    dhi[mese]![ora]! += r['Gd(h)']
    temperatura[mese]![ora]! += r['T2m']
    conteggio[mese]![ora]! += 1
    ghiAnnuoWhM2 += r['G(h)']
  }

  for (let m = 0; m < 12; m += 1) {
    for (let h = 0; h < 24; h += 1) {
      const n = conteggio[m]![h]!
      if (n === 0) continue
      ghi[m]![h]! /= n
      dni[m]![h]! /= n
      dhi[m]![h]! /= n
      temperatura[m]![h]! /= n
    }
  }

  return {
    fonte: 'PVGIS-TMY',
    lat: posizione.lat,
    lng: posizione.lng,
    elevazioneM: posizione.elevazioneM ?? null,
    ghiAnnuoKwhM2: Math.round(ghiAnnuoWhM2 / 1000),
    ghi,
    dni,
    dhi,
    temperatura,
  }
}
