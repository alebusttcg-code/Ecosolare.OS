import { describe, expect, it } from 'vitest'
import { normalizzaQuantita, unitaRichiedeIntero } from './unita'

describe('unitaRichiedeIntero', () => {
  it('tratta pz e kit come quantità intere', () => {
    expect(unitaRichiedeIntero('pz')).toBe(true)
    expect(unitaRichiedeIntero('PZ')).toBe(true)
    expect(unitaRichiedeIntero('kit')).toBe(true)
  })

  it('lascia decimali su unità continue', () => {
    expect(unitaRichiedeIntero('kWp')).toBe(false)
    expect(unitaRichiedeIntero('m')).toBe(false)
    expect(unitaRichiedeIntero('mq')).toBe(false)
  })
})

describe('normalizzaQuantita', () => {
  it('arrotonda i pezzi a intero', () => {
    expect(normalizzaQuantita(6.002, 'pz')).toBe(6)
    expect(normalizzaQuantita(6.6, 'pz')).toBe(7)
  })

  it('non altera le quantità decimali su altre unità', () => {
    expect(normalizzaQuantita(6.002, 'kWp')).toBe(6.002)
  })
})
