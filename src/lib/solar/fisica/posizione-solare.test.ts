import { describe, expect, it } from 'vitest'
import {
  irraggiamentoExtraterrestre,
  posizioneSolare,
} from './posizione-solare'

const LAT = 44.11
const LNG = 9.96

/** Scansiona il giorno e trova l'ora UTC di massima elevazione (mezzogiorno solare). */
function mezzogiornoSolare(giorno: number) {
  let migliore = { elevazioneDeg: -90, zenitDeg: 180, azimutDeg: 0 }
  for (let ora = 0; ora <= 24; ora += 0.05) {
    const p = posizioneSolare(LAT, LNG, giorno, ora)
    if (p.elevazioneDeg > migliore.elevazioneDeg) migliore = p
  }
  return migliore
}

describe('posizione solare', () => {
  it('a mezzogiorno il sole è a sud (azimut ~180°)', () => {
    for (const giorno of [80, 172, 356]) {
      expect(mezzogiornoSolare(giorno).azimutDeg).toBeCloseTo(180, -0.5)
    }
  })

  it('l’elevazione a mezzogiorno segue la declinazione: 90 − lat ± 23,44°', () => {
    // Solstizio d'estate (giorno 172): 90 − 44,11 + 23,44 ≈ 69,3°.
    expect(mezzogiornoSolare(172).elevazioneDeg).toBeCloseTo(69.3, 0)
    // Solstizio d'inverno (giorno 356): 90 − 44,11 − 23,44 ≈ 22,45°.
    expect(mezzogiornoSolare(356).elevazioneDeg).toBeCloseTo(22.4, 0)
    // Equinozio (giorno ~80): 90 − 44,11 ≈ 45,9°.
    expect(mezzogiornoSolare(80).elevazioneDeg).toBeCloseTo(45.9, 0)
  })

  it('zenit ed elevazione sono complementari', () => {
    const p = posizioneSolare(LAT, LNG, 172, 12)
    expect(p.zenitDeg + p.elevazioneDeg).toBeCloseTo(90, 6)
  })

  it('mattino a est, pomeriggio a ovest', () => {
    // Cerco un'ora di mattina e una di pomeriggio col sole alto.
    const mattino = posizioneSolare(LAT, LNG, 172, 7) // ~09:00 locali
    const pomeriggio = posizioneSolare(LAT, LNG, 172, 15) // ~17:00 locali
    expect(mattino.elevazioneDeg).toBeGreaterThan(0)
    expect(pomeriggio.elevazioneDeg).toBeGreaterThan(0)
    expect(mattino.azimutDeg).toBeLessThan(180) // verso est
    expect(pomeriggio.azimutDeg).toBeGreaterThan(180) // verso ovest
  })

  it('di notte il sole è sotto l’orizzonte', () => {
    // Mezzanotte solare ≈ 23 UTC per longitudine ~10°.
    expect(posizioneSolare(LAT, LNG, 172, 23).elevazioneDeg).toBeLessThan(0)
    expect(posizioneSolare(LAT, LNG, 356, 1).elevazioneDeg).toBeLessThan(0)
  })

  it('l’irraggiamento extraterrestre oscilla ~±3,3% sull’anno', () => {
    // Massimo a inizio gennaio (perielio), minimo a inizio luglio.
    const gennaio = irraggiamentoExtraterrestre(3)
    const luglio = irraggiamentoExtraterrestre(185)
    expect(gennaio).toBeGreaterThan(luglio)
    expect(gennaio).toBeCloseTo(1361 * 1.033, -1)
    expect(luglio).toBeCloseTo(1361 * 0.967, -1)
  })
})
