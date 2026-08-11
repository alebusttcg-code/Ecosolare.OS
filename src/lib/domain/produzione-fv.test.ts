import { describe, expect, it } from 'vitest'
import {
  distribuisciProduzioneMensile,
  fattoreAzimut,
  fattoreTilt,
  PESI_MENSILI_FV_ITALIA,
  resaBaseDaLatitudine,
  stimaProduzioneFalda,
} from './produzione-fv'

describe('produzione FV sito-specifica', () => {
  it('a sud rende più che a nord, a parità di tutto', () => {
    const sud = stimaProduzioneFalda({
      kWp: 6,
      latitudine: 45.1,
      pitchDegrees: 20,
      azimuthDegrees: 180,
    })
    const nord = stimaProduzioneFalda({
      kWp: 6,
      latitudine: 45.1,
      pitchDegrees: 20,
      azimuthDegrees: 0,
    })
    expect(sud.produzioneKwh).toBeGreaterThan(nord.produzioneKwh)
    expect(fattoreAzimut(180)).toBeGreaterThan(fattoreAzimut(0))
  })

  it('a latitudini più basse rende di più', () => {
    const nord = resaBaseDaLatitudine(45.5)
    const sud = resaBaseDaLatitudine(40.5)
    expect(sud).toBeGreaterThan(nord)
  })

  it('tilt vicino all’ottimo batte un tetto piatto', () => {
    const ottimo = fattoreTilt(30, 45)
    const piatto = fattoreTilt(4, 45)
    expect(ottimo).toBeGreaterThan(piatto)
  })

  it('differenzia i tre profili dossier (stesso kWp, geometrie diverse)', () => {
    // Profili tipici Riboldi / Ricci / Tarantola (falda principale)
    const riboldi = stimaProduzioneFalda({
      kWp: 6,
      latitudine: 45.2,
      pitchDegrees: 4,
      azimuthDegrees: 174,
    })
    const ricci = stimaProduzioneFalda({
      kWp: 6,
      latitudine: 45.0,
      pitchDegrees: 8,
      azimuthDegrees: 203,
    })
    const tarantola = stimaProduzioneFalda({
      kWp: 4,
      latitudine: 44.8,
      pitchDegrees: 7,
      azimuthDegrees: 239,
    })
    expect(riboldi.produzioneKwh).not.toBe(ricci.produzioneKwh)
    expect(tarantola.produzioneKwh).toBeLessThan(riboldi.produzioneKwh)
    // Ordine di grandezza dei dossier (~5–8 MWh), non costante 1320×kWp
    expect(riboldi.resaSpecificaKwhKwp).toBeGreaterThan(1000)
    expect(riboldi.resaSpecificaKwhKwp).toBeLessThan(1600)
  })

  it('ripartisce la produzione mensile con pesi che sommano 1', () => {
    const sommaPesi = PESI_MENSILI_FV_ITALIA.reduce((a, b) => a + b, 0)
    expect(sommaPesi).toBeCloseTo(1, 3)
    const mesi = distribuisciProduzioneMensile(7890)
    expect(mesi).toHaveLength(12)
    expect(mesi.reduce((a, b) => a + b, 0)).toBe(7890)
    expect(mesi[6]!).toBeGreaterThan(mesi[0]!) // luglio > gennaio
  })
})
