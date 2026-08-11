import { describe, expect, it } from 'vitest'
import {
  puntiRicercaEdificio,
  RAGGIO_MAX_EDIFICIO_SOLAR_M,
} from './building-insights'
import { metriFra } from './geo'

describe('puntiRicercaEdificio', () => {
  const origine = { latitude: 45.0, longitude: 9.0 }

  it('include l’origine e resta entro ~200 m', () => {
    const punti = puntiRicercaEdificio(origine)
    expect(punti[0]).toEqual(origine)
    expect(punti.length).toBeGreaterThan(1)
    for (const p of punti) {
      expect(metriFra(origine, p)).toBeLessThanOrEqual(
        RAGGIO_MAX_EDIFICIO_SOLAR_M + 2,
      )
    }
  })

  it('rispetta un raggio più stretto', () => {
    const punti = puntiRicercaEdificio(origine, 60)
    expect(punti).toHaveLength(1 + 6) // origine + un anello a 55 m
    for (const p of punti) {
      expect(metriFra(origine, p)).toBeLessThanOrEqual(62)
    }
  })
})
