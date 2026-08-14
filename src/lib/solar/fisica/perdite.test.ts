import { describe, expect, it } from 'vitest'
import {
  applicaInverter,
  fattorePerditeSistema,
  PERDITE_STANDARD,
} from './perdite'
import {
  fattoreTemperatura,
  temperaturaCella,
} from './temperatura'

describe('temperatura di cella', () => {
  it('a 800 W/m² la cella sta NOCT gradi sopra il riferimento', () => {
    // NOCT 45, aria 20 → cella 45 esatti.
    expect(temperaturaCella(20, 800, 45)).toBeCloseTo(45, 6)
  })

  it('senza sole la cella è alla temperatura dell’aria', () => {
    expect(temperaturaCella(12, 0)).toBe(12)
  })

  it('il derating è 1 a 25°C, cala se calda, cresce se fredda', () => {
    expect(fattoreTemperatura(25)).toBeCloseTo(1, 6)
    expect(fattoreTemperatura(45)).toBeCloseTo(0.93, 6) // −0,35%/°C × 20
    expect(fattoreTemperatura(5)).toBeCloseTo(1.07, 6)
  })

  it('una cella rovente non produce potenza negativa', () => {
    expect(fattoreTemperatura(1000)).toBe(0)
  })
})

describe('perdite di sistema', () => {
  it('si compongono in modo moltiplicativo (PR standard ~0,90)', () => {
    expect(fattorePerditeSistema(PERDITE_STANDARD)).toBeCloseTo(0.899, 3)
  })

  it('meno perdite → fattore più alto', () => {
    const meno = fattorePerditeSistema({
      sporcamento: 0.01,
      ohmicheCc: 0.01,
      mismatch: 0.01,
      degradazioneIniziale: 0.01,
      riflessioneSpettro: 0.01,
    })
    expect(meno).toBeGreaterThan(fattorePerditeSistema(PERDITE_STANDARD))
  })
})

describe('inverter con clipping', () => {
  it('un campo 6 kWp su inverter 5 kW tronca il picco', () => {
    const r = applicaInverter(6, 5, 0.97)
    expect(r.potenzaAcKw).toBeCloseTo(5, 6)
    expect(r.clippingKw).toBeCloseTo(6 * 0.97 - 5, 6) // 0,82 kW
  })

  it('sotto il limite non tronca nulla', () => {
    const r = applicaInverter(3, 5, 0.97)
    expect(r.potenzaAcKw).toBeCloseTo(2.91, 6)
    expect(r.clippingKw).toBe(0)
  })

  it('niente potenza in continua → niente in alternata', () => {
    const r = applicaInverter(0, 5)
    expect(r.potenzaAcKw).toBe(0)
    expect(r.clippingKw).toBe(0)
  })
})
