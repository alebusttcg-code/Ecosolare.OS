import { describe, expect, it } from 'vitest'
import {
  areaPoligonoMetri2,
  formattaMetri,
  latiPoligono,
  latiRettangolo,
  metriFra,
  perimetroPoligonoMetri,
  poligoniQuasiUguali,
  verticiDaRettangolo,
} from './geo'

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

describe('verticiDaRettangolo / latiPoligono', () => {
  const box = {
    sw: { latitude: 45.46, longitude: 9.18 },
    ne: { latitude: 45.461, longitude: 9.182 },
  }

  it('produce 4 vertici SW–SE–NE–NW', () => {
    const v = verticiDaRettangolo(box)
    expect(v).toHaveLength(4)
    expect(v[0]).toEqual(box.sw)
    expect(v[2]).toEqual(box.ne)
  })

  it('allinea i lati al rettangolo', () => {
    expect(latiPoligono(verticiDaRettangolo(box))).toEqual(latiRettangolo(box))
  })
})

describe('areaPoligonoMetri2', () => {
  it('stimata coerente con un rettangolo ~111×157 m', () => {
    // 0.001° lat ≈ 111 m; 0.002° lng a 45° ≈ 157 m
    const area = areaPoligonoMetri2(
      verticiDaRettangolo({
        sw: { latitude: 45, longitude: 9 },
        ne: { latitude: 45.001, longitude: 9.002 },
      }),
    )
    expect(area).toBeGreaterThan(15_000)
    expect(area).toBeLessThan(20_000)
  })
})

describe('perimetroPoligonoMetri', () => {
  it('somma i lati', () => {
    const v = verticiDaRettangolo({
      sw: { latitude: 45.46, longitude: 9.18 },
      ne: { latitude: 45.461, longitude: 9.182 },
    })
    const peri = perimetroPoligonoMetri(v)
    const somma = latiPoligono(v).reduce((s, l) => s + l.metri, 0)
    expect(peri).toBeCloseTo(somma, 5)
  })
})

describe('poligoniQuasiUguali', () => {
  it('rileva differenze di vertici', () => {
    const a = verticiDaRettangolo({
      sw: { latitude: 45, longitude: 9 },
      ne: { latitude: 45.001, longitude: 9.001 },
    })
    const b = a.map((p, i) =>
      i === 0 ? { ...p, latitude: p.latitude + 0.001 } : p,
    )
    expect(poligoniQuasiUguali(a, a)).toBe(true)
    expect(poligoniQuasiUguali(a, b)).toBe(false)
  })
})

describe('formattaMetri', () => {
  it('usa la virgola sotto i 10 m', () => {
    expect(formattaMetri(3.4)).toBe('3,4 m')
  })
})
