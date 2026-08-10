import { describe, expect, it } from 'vitest'
import { DSM_INVALIDO, type GrigliaDsm } from './griglia-dsm'
import { meshFaldaDaDsm, profiloSezioneDsm, spostaMetri } from './sezione-dsm'

function grigliaPianoInclinato(): GrigliaDsm {
  const width = 20
  const height = 20
  const quote: number[] = []
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      // Quota cresce verso Est (colonna).
      quote.push(10 + c * 0.5)
    }
  }
  return {
    width,
    height,
    quote,
    bounds: {
      north: 45.001,
      south: 45.0,
      west: 9.0,
      east: 9.001,
    },
    imageryQuality: 'HIGH',
    mask: null,
  }
}

describe('spostaMetri', () => {
  it('sposta ~100 m a Est', () => {
    const p = spostaMetri({ latitude: 45, longitude: 9 }, 90, 100)
    expect(p.latitude).toBeCloseTo(45, 3)
    expect(p.longitude).toBeGreaterThan(9)
  })
})

describe('profiloSezioneDsm', () => {
  it('campiona quote lungo il poligono', () => {
    const g = grigliaPianoInclinato()
    const poligono = [
      { latitude: 45.0002, longitude: 9.0002 },
      { latitude: 45.0002, longitude: 9.0008 },
      { latitude: 45.0008, longitude: 9.0008 },
      { latitude: 45.0008, longitude: 9.0002 },
    ]
    const profilo = profiloSezioneDsm(g, poligono, 90, 24)
    expect(profilo).not.toBeNull()
    expect(profilo!.punti.length).toBeGreaterThan(3)
    expect(profilo!.quotaMaxM).toBeGreaterThan(profilo!.quotaMinM)
    expect(profilo!.pitchMedioDegrees).not.toBeNull()
  })

  it('ritorna null su poligono troppo piccolo o fuori griglia', () => {
    const g = grigliaPianoInclinato()
    expect(profiloSezioneDsm(g, [], 0)).toBeNull()
    const fuori = [
      { latitude: 46, longitude: 10 },
      { latitude: 46.001, longitude: 10 },
      { latitude: 46.001, longitude: 10.001 },
    ]
    expect(profiloSezioneDsm(g, fuori, 0)).toBeNull()
  })
})

describe('meshFaldaDaDsm', () => {
  it('produce vertici e triangoli', () => {
    const g = grigliaPianoInclinato()
    // Forza alcuni invaldi.
    const quote = [...g.quote]
    quote[0] = DSM_INVALIDO
    const g2 = { ...g, quote }
    const poligono = [
      { latitude: 45.0001, longitude: 9.0001 },
      { latitude: 45.0001, longitude: 9.0009 },
      { latitude: 45.0009, longitude: 9.0009 },
      { latitude: 45.0009, longitude: 9.0001 },
    ]
    const mesh = meshFaldaDaDsm(g2, poligono, 1)
    expect(mesh).not.toBeNull()
    expect(mesh!.vertici.length).toBeGreaterThan(10)
    expect(mesh!.indici.length).toBeGreaterThanOrEqual(3)
    expect(Math.min(...mesh!.vertici.map((v) => v.z))).toBeCloseTo(0, 5)
  })
})
