import { describe, expect, it } from 'vitest'
import { zoomAnteprimaModuli } from '@/app/(app)/sviluppo/anteprima-moduli'

describe('zoomAnteprimaModuli', () => {
  it('sceglie uno zoom alto per punti vicini', () => {
    const centro = { latitude: 44.1, longitude: 9.8 }
    const punti = [
      { latitude: 44.10001, longitude: 9.80001 },
      { latitude: 44.10002, longitude: 9.80002 },
      { latitude: 44.100015, longitude: 9.800015 },
    ]
    const z = zoomAnteprimaModuli(punti, centro)
    expect(z).toBeGreaterThanOrEqual(18)
    expect(z).toBeLessThanOrEqual(21)
  })
})
