import { describe, expect, it } from 'vitest'
import {
  distribuisciProduzioneMensile,
  fattoreOmbra,
  fattoreOrientamento,
  PESI_MENSILI_FV_ITALIA,
  resaBaseDaLatitudine,
  scostamentoDaSud,
  stimaProduzioneFalda,
} from './produzione-fv'

/**
 * I test di prima erano tutti ordinali — «sud rende più di nord», «latitudine
 * bassa rende più di alta» — e restavano verdi mentre il modello sottostimava
 * i tre dossier di riferimento del 21%, 23% e 34%. Un test che verifica solo
 * l'ordine non sorveglia un modello numerico: sorveglia il segno.
 *
 * Qui i valori sono fissati. Se qualcuno ritocca la tabella, questi test
 * dicono di quanto e su quale caso.
 */

describe('scostamento da sud', () => {
  it('misura la distanza angolare, in entrambi i versi', () => {
    expect(scostamentoDaSud(180)).toBe(0)
    expect(scostamentoDaSud(90)).toBe(90)
    expect(scostamentoDaSud(270)).toBe(90)
    expect(scostamentoDaSud(0)).toBe(180)
    expect(scostamentoDaSud(360)).toBe(180)
    expect(scostamentoDaSud(-90)).toBe(90)
  })
})

describe('fattore di orientamento', () => {
  it('su un tetto piano l’esposizione non conta', () => {
    // Non è taratura, è fisica: il piano dei moduli è orizzontale, e verso
    // dove «guarda» la falda non cambia nulla. Il modello separabile di prima
    // penalizzava del 20% un tetto quasi piano esposto a sud-ovest.
    const piano = [0, 90, 180, 270].map((az) => fattoreOrientamento(0, az))
    expect(new Set(piano).size).toBe(1)
  })

  it('riproduce i valori di riferimento per l’Italia settentrionale', () => {
    // Rispetto al punto ottimo (sud, ~30°).
    expect(fattoreOrientamento(30, 180)).toBeCloseTo(1.0, 2)
    expect(fattoreOrientamento(30, 90)).toBeCloseTo(0.86, 2) // est
    expect(fattoreOrientamento(30, 270)).toBeCloseTo(0.86, 2) // ovest
    expect(fattoreOrientamento(30, 0)).toBeCloseTo(0.67, 2) // nord
    expect(fattoreOrientamento(90, 180)).toBeCloseTo(0.7, 2) // parete a sud
  })

  it('est e ovest si equivalgono', () => {
    for (const pitch of [0, 15, 30, 45]) {
      expect(fattoreOrientamento(pitch, 90)).toBeCloseTo(
        fattoreOrientamento(pitch, 270),
        6,
      )
    }
  })

  it('non cresce mai allontanandosi da sud', () => {
    for (const pitch of [0, 10, 20, 30, 45, 60, 90]) {
      let precedente = Infinity
      for (let dev = 0; dev <= 180; dev += 10) {
        const valore = fattoreOrientamento(pitch, 180 - dev)
        expect(valore).toBeLessThanOrEqual(precedente + 1e-9)
        precedente = valore
      }
    }
  })

  it('interpola fra i nodi invece di saltare', () => {
    const a = fattoreOrientamento(20, 180)
    const b = fattoreOrientamento(25, 180)
    expect(a).toBeGreaterThan(fattoreOrientamento(15, 180))
    expect(b).toBeGreaterThan(a)
    expect(b).toBeLessThan(fattoreOrientamento(30, 180))
  })

  it('regge i valori fuori scala senza rompersi', () => {
    expect(fattoreOrientamento(-10, 180)).toBe(fattoreOrientamento(0, 180))
    expect(fattoreOrientamento(120, 180)).toBe(fattoreOrientamento(90, 180))
  })
})

describe('resa di base per latitudine', () => {
  it('è ancorata a 1.446 kWh/kWp a 45°N', () => {
    // È la media implicata dai tre dossier con il fattore di orientamento.
    expect(resaBaseDaLatitudine(45)).toBe(1446)
  })

  it('a latitudini più basse rende di più, entro l’escursione italiana', () => {
    expect(resaBaseDaLatitudine(37)).toBeGreaterThan(resaBaseDaLatitudine(46))
    expect(resaBaseDaLatitudine(36.5) - resaBaseDaLatitudine(47.5)).toBeCloseTo(385, 0)
  })

  it('non estrapola fuori dall’Italia', () => {
    expect(resaBaseDaLatitudine(10)).toBe(resaBaseDaLatitudine(36.5))
    expect(resaBaseDaLatitudine(60)).toBe(resaBaseDaLatitudine(47.5))
  })
})

/**
 * La verifica che conta: il modello deve riprodurre i tre impianti che abbiamo
 * davvero venduto, con le loro geometrie vere.
 */
describe('riproduzione dei dossier di riferimento', () => {
  const CASI = [
    { nome: 'Riboldi', kWp: 6, lat: 45.2, pitch: 4, azimut: 174, dichiarata: 8066 },
    { nome: 'Ricci', kWp: 6, lat: 45.0, pitch: 8, azimut: 203, dichiarata: 7960 },
    { nome: 'Tarantola', kWp: 4, lat: 44.8, pitch: 7, azimut: 239, dichiarata: 5235 },
  ] as const

  for (const caso of CASI) {
    it(`${caso.nome} entro il 5% del dossier consegnato`, () => {
      const stima = stimaProduzioneFalda({
        kWp: caso.kWp,
        latitudine: caso.lat,
        pitchDegrees: caso.pitch,
        azimuthDegrees: caso.azimut,
      })
      const scarto = Math.abs(stima.produzioneKwh / caso.dichiarata - 1)
      expect(scarto).toBeLessThan(0.05)
    })
  }

  it('un tetto a est non viene punito come se fosse a nord', () => {
    // Il difetto che costava vendite: 6 kWp a est davano 4.515 kWh/anno,
    // circa il 28% meno del vero, e il rientro si allungava di anni.
    const est = stimaProduzioneFalda({
      kWp: 6,
      latitudine: 44.5,
      pitchDegrees: 30,
      azimuthDegrees: 90,
    })
    expect(est.produzioneKwh).toBeGreaterThan(7000)
    expect(est.produzioneKwh).toBeLessThan(7900)
  })
})

describe('ripartizione mensile', () => {
  it('usa pesi che sommano 1 e conserva il totale', () => {
    const sommaPesi = PESI_MENSILI_FV_ITALIA.reduce((a, b) => a + b, 0)
    expect(sommaPesi).toBeCloseTo(1, 3)
    const mesi = distribuisciProduzioneMensile(7890)
    expect(mesi).toHaveLength(12)
    expect(mesi.reduce((a, b) => a + b, 0)).toBe(7890)
    expect(mesi[6]!).toBeGreaterThan(mesi[0]!) // luglio > gennaio
  })
})

/**
 * I numeri sono quelli veri dell'unico studio in archivio: otto falde, ore di
 * sole da 803 a 1.325. È il caso su cui si vede che il modello di prima
 * comprimeva un ventaglio del 39% dentro un ±12%.
 */
describe('ombra letta dai dati di Google', () => {
  const FALDE = [1325, 1000, 1274, 1150, 1230, 1232, 1155, 803]
  const MIGLIORE = Math.max(...FALDE)

  it('la falda meno ombreggiata vale 1, o la taratura si sposta', () => {
    // La resa di base è ancorata ai dossier con questo fattore a 1: se la
    // migliore valesse più o meno di 1, tutti i preventivi cambierebbero.
    expect(fattoreOmbra(MIGLIORE, MIGLIORE)).toBe(1)
  })

  it('non gonfia mai: nessuna falda può battere il riferimento', () => {
    expect(fattoreOmbra(1500, MIGLIORE)).toBe(1)
  })

  it('l’ombra vera arriva a schermo invece di essere compressa', () => {
    // Falda 7: 803 ore contro 1.325. Prima perdeva il 12%, ora il 39%.
    expect(fattoreOmbra(803, MIGLIORE)).toBeCloseTo(0.61, 2)
    // Falda 1, esposta a nord-ovest e in ombra: 25% invece di 12%.
    expect(fattoreOmbra(1000, MIGLIORE)).toBeCloseTo(0.75, 2)
  })

  it('non scende sotto metà: più giù è una falda da non coprire', () => {
    expect(fattoreOmbra(100, MIGLIORE)).toBe(0.5)
  })

  it('senza dati resta neutro invece di inventare un’ombra', () => {
    expect(fattoreOmbra(null, MIGLIORE)).toBe(1)
    expect(fattoreOmbra(1000, null)).toBe(1)
    expect(fattoreOmbra(1000, 0)).toBe(1)
  })

  it('entra nella produzione della falda', () => {
    const libera = stimaProduzioneFalda({
      kWp: 6,
      latitudine: 44.5,
      pitchDegrees: 20,
      azimuthDegrees: 180,
      sunshineMedio: MIGLIORE,
      sunshineMigliore: MIGLIORE,
    })
    const ombreggiata = stimaProduzioneFalda({
      kWp: 6,
      latitudine: 44.5,
      pitchDegrees: 20,
      azimuthDegrees: 180,
      sunshineMedio: 803,
      sunshineMigliore: MIGLIORE,
    })
    expect(ombreggiata.produzioneKwh).toBeLessThan(libera.produzioneKwh * 0.65)
    expect(libera.fattoreOmbra).toBe(1)
  })
})
