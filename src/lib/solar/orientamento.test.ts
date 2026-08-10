import { describe, expect, it } from 'vitest'
import { etichettaAzimuth } from './orientamento'

describe('etichettaAzimuth', () => {
  it('mappa i punti cardinali principali', () => {
    expect(etichettaAzimuth(0)).toBe('N')
    expect(etichettaAzimuth(90)).toBe('E')
    expect(etichettaAzimuth(180)).toBe('S')
    expect(etichettaAzimuth(270)).toBe('O')
  })

  it('normalizza valori fuori da 0–360', () => {
    expect(etichettaAzimuth(-90)).toBe('O')
    expect(etichettaAzimuth(450)).toBe('E')
  })
})
