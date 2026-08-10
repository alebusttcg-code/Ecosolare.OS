import { describe, expect, it } from 'vitest'
import { layoutModuliInFalda, moduloDaCentro, ruotaModulo } from './layout-moduli'
import { FORMATI_MODULO_FV } from './moduli-fv'

describe('layoutModuliInFalda', () => {
  const falda = [
    { latitude: 45.0, longitude: 9.0 },
    { latitude: 45.0, longitude: 9.0002 },
    { latitude: 45.00015, longitude: 9.0002 },
    { latitude: 45.00015, longitude: 9.0 },
  ]

  it('colloca al più la quantità richiesta', () => {
    const layout = layoutModuliInFalda({
      poligono: falda,
      formato: FORMATI_MODULO_FV[0]!,
      quantita: 4,
      azimuthDegrees: 180,
    })
    expect(layout.richiesti).toBe(4)
    expect(layout.collocati).toBeLessThanOrEqual(4)
    expect(layout.collocati).toBeGreaterThan(0)
    expect(layout.moduli).toHaveLength(layout.collocati)
    expect(layout.kWp).toBeCloseTo(
      (layout.collocati * FORMATI_MODULO_FV[0]!.wattPicco) / 1000,
      5,
    )
  })

  it('zero se quantità 0', () => {
    const layout = layoutModuliInFalda({
      poligono: falda,
      formato: FORMATI_MODULO_FV[0]!,
      quantita: 0,
      azimuthDegrees: 180,
    })
    expect(layout.collocati).toBe(0)
  })

  it('moduloDaCentro ricostruisce 4 angoli attorno al centro', () => {
    const origine = { latitude: 45.000075, longitude: 9.0001 }
    const m = moduloDaCentro({
      centro: origine,
      formato: FORMATI_MODULO_FV[0]!,
      azimuthDegrees: 180,
      landscape: true,
      origineProiezione: origine,
    })
    expect(m.angoli).toHaveLength(4)
    expect(m.centro.latitude).toBeCloseTo(origine.latitude, 6)
    expect(m.rotazioneDegrees).toBe(0)
  })

  it('rotazione cambia gli angoli mantenendo il centro', () => {
    const origine = { latitude: 45.000075, longitude: 9.0001 }
    const m0 = moduloDaCentro({
      centro: origine,
      formato: FORMATI_MODULO_FV[0]!,
      azimuthDegrees: 180,
      landscape: true,
      origineProiezione: origine,
    })
    const m90 = ruotaModulo(
      m0,
      90,
      FORMATI_MODULO_FV[0]!,
      180,
      true,
      origine,
    )
    expect(m90.rotazioneDegrees).toBe(90)
    expect(m90.centro.latitude).toBeCloseTo(m0.centro.latitude, 6)
    expect(m90.angoli[0]!.latitude).not.toBeCloseTo(m0.angoli[0]!.latitude, 6)
  })
})
