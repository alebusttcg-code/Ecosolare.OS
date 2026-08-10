import { describe, expect, it } from 'vitest'
import { layoutModuliInFalda } from './layout-moduli'
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
})
