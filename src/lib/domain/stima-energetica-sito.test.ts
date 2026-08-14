import { describe, expect, it, vi } from 'vitest'
import { stimaEnergeticaSito } from './stima-energetica-sito'
import {
  PARAMETRI_FISICI_PREDEFINITI,
  sistemaDaParametri,
} from './parametri-fisici'
import { FAMIGLIA_1_2 } from './profili-carico'
import {
  chiaveSito,
  type ArchivioClimatologia,
} from '@/lib/solar/clima'
import type { Climatologia } from '@/lib/solar/clima/climatologia'

/** Climatologia sintetica a cielo diffuso, deterministica (come produzione-oraria.test). */
function climaDiffusa(lat: number, lng: number, ghiDiurno = 400): Climatologia {
  const ghi = Array.from({ length: 12 }, () =>
    Array.from({ length: 24 }, (_, h) => (h >= 8 && h < 16 ? ghiDiurno : 0)),
  )
  return {
    fonte: 'PVGIS-TMY',
    lat,
    lng,
    elevazioneM: 10,
    ghiAnnuoKwhM2: 1450,
    ghi,
    dni: Array.from({ length: 12 }, () => new Array<number>(24).fill(0)),
    dhi: ghi.map((r) => [...r]),
    temperatura: Array.from({ length: 12 }, () => new Array<number>(24).fill(15)),
  }
}

function archivioConSito(lat: number, lng: number): ArchivioClimatologia {
  const dati = new Map<string, Climatologia>()
  dati.set(chiaveSito(lat, lng), climaDiffusa(lat, lng))
  return {
    leggi: async (k) => dati.get(k) ?? null,
    scrivi: async (k, c) => {
      dati.set(k, c)
    },
  }
}

const LAT = 44.11
const LNG = 9.96

describe('stima energetica del sito (porta d’ingresso del motore)', () => {
  it('compone produzione e autoconsumo, senza toccare la rete', async () => {
    const archivio = archivioConSito(LAT, LNG)
    // Un fetch che esplode: se la cache è calda, non deve mai partire.
    const fetchImpl = vi.fn(async () => {
      throw new Error('la rete non deve essere toccata')
    })

    const stima = await stimaEnergeticaSito(
      {
        lat: LAT,
        lng: LNG,
        falde: [{ kWp: 6, tiltDeg: 8, azimutDeg: 180 }],
        sistema: sistemaDaParametri(5, PARAMETRI_FISICI_PREDEFINITI),
        consumoAnnuoKwh: 4000,
        profilo: FAMIGLIA_1_2,
      },
      { archivio, fetchImpl },
    )

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(stima.fonteClima).toBe('PVGIS-TMY')
    expect(stima.produzione.produzioneAnnuaKwh).toBeGreaterThan(0)
  })

  it('il bilancio conserva l’energia e l’autoconsumo è parziale', async () => {
    const archivio = archivioConSito(LAT, LNG)
    const stima = await stimaEnergeticaSito(
      {
        lat: LAT,
        lng: LNG,
        falde: [{ kWp: 6, tiltDeg: 8, azimutDeg: 180 }],
        sistema: sistemaDaParametri(5, PARAMETRI_FISICI_PREDEFINITI),
        consumoAnnuoKwh: 4000,
        profilo: FAMIGLIA_1_2,
      },
      { archivio },
    )

    const b = stima.bilancio
    expect(b.autoconsumoKwh + b.exportKwh).toBeCloseTo(b.produzioneKwh, 3)
    expect(b.autoconsumoKwh).toBeLessThanOrEqual(b.consumoKwh)
    // Produzione di giorno, consumo serale: l'autoconsumo non è né zero né totale.
    expect(b.frazioneAutoconsumo).toBeGreaterThan(0)
    expect(b.frazioneAutoconsumo).toBeLessThan(1)
  })

  it('più consumo, più autoconsumo (a parità di impianto)', async () => {
    const archivio = archivioConSito(LAT, LNG)
    const base = {
      lat: LAT,
      lng: LNG,
      falde: [{ kWp: 6, tiltDeg: 8, azimutDeg: 180 }],
      sistema: sistemaDaParametri(5, PARAMETRI_FISICI_PREDEFINITI),
      profilo: FAMIGLIA_1_2,
    }
    const poco = await stimaEnergeticaSito({ ...base, consumoAnnuoKwh: 2000 }, { archivio })
    const molto = await stimaEnergeticaSito({ ...base, consumoAnnuoKwh: 6000 }, { archivio })
    expect(molto.bilancio.autoconsumoKwh).toBeGreaterThan(poco.bilancio.autoconsumoKwh)
  })
})
