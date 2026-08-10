import { describe, expect, it } from 'vitest'
import { formattaMetri, latiRettangolo, metriFra } from './geo'

describe('metriFra', () => {
  it('misura circa 111 km su un grado di latitudine', () => {
    const m = metriFra(
      { latitude: 45, longitude: 9 },
      { latitude: 46, longitude: 9 },
    )
    expect(m).toBeGreaterThan(110_000)
    expect(m).toBeLessThan(112_000)
  })
})

describe('latiRettangolo', () => {
  it('restituisce 4 lati con lunghezze positive', () => {
    const lati = latiRettangolo({
      sw: { latitude: 45.46, longitude: 9.18 },
      ne: { latitude: 45.461, longitude: 9.182 },
    })
    expect(lati).toHaveLength(4)
    for (const lato of lati) {
      expect(lato.metri).toBeGreaterThan(0)
      expect(lato.etichetta).toMatch(/m$/)
    }
  })
})

describe('formattaMetri', () => {
  it('usa la virgola sotto i 10 m', () => {
    expect(formattaMetri(3.4)).toBe('3,4 m')
  })
})
