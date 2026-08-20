import { describe, expect, it } from 'vitest'
import { calcolaFrameFoto, clamp, clampPan } from './designer-geometria'

describe('clamp', () => {
  it('limita entro [min, max]', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(42, 0, 10)).toBe(10)
  })
})

describe('clampPan', () => {
  it('con immagine molto più piccola blocca il pan al centro', () => {
    // (dw-w)/2 + 48 < 0 → maxX = 0: niente pan, resta centrata.
    const p = clampPan(400, 300, 200, 150, { x: 999, y: -999 })
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0)
  })

  it('appena più piccola consente il pan fino allo sfrido residuo', () => {
    // (350-400)/2 + 48 = 23.
    const p = clampPan(400, 300, 350, 260, { x: 999, y: -999 })
    expect(p.x).toBe(23)
    expect(p.y).toBe(-28)
  })

  it('con immagine più grande consente di scorrere fino al bordo + sfrido', () => {
    const p = clampPan(400, 300, 1000, 700, { x: 999, y: 999 })
    expect(p.x).toBe((1000 - 400) / 2 + 48)
    expect(p.y).toBe((700 - 300) / 2 + 48)
  })
})

describe('calcolaFrameFoto', () => {
  const falda = [
    { latitude: 45.0, longitude: 9.0 },
    { latitude: 45.0, longitude: 9.0002 },
    { latitude: 45.00015, longitude: 9.0002 },
    { latitude: 45.00015, longitude: 9.0 },
  ]

  it('null se il poligono non è valido', () => {
    expect(calcolaFrameFoto(null, 1280, 840, 2)).toBeNull()
    expect(calcolaFrameFoto([falda[0]!, falda[1]!], 1280, 840, 2)).toBeNull()
  })

  it('centro = centroide e zoom un livello sotto il fit esatto', () => {
    const frame = calcolaFrameFoto(falda, 1280, 840, 2)!
    expect(frame).not.toBeNull()
    // centroide del rettangolo
    expect(frame.centro.latitude).toBeCloseTo(45.000075, 6)
    expect(frame.centro.longitude).toBeCloseTo(9.0001, 6)
    // zoom intero nel range Solar, mai sotto zoomMin
    expect(Number.isInteger(frame.zoom)).toBe(true)
    expect(frame.zoom).toBeGreaterThanOrEqual(17)
    expect(frame.zoom).toBeLessThanOrEqual(21)
  })
})
