import { describe, expect, it } from 'vitest'
import {
  autoconsumoDaMatching,
  FAMIGLIA_1_2,
  fasciaPerOra,
  matriceConsumoMensileOraria,
  PESI_MENSILI_FULL_ELECTRIC_PDC,
  PROFILI_CARICO,
  quotaOrariaConsumo,
} from './profili-carico'

const somma = (a: readonly number[]) => a.reduce((s, x) => s + x, 0)

describe('fasce orarie', () => {
  it('mappa ogni ora nella fascia giusta, ai confini', () => {
    expect(fasciaPerOra(0)).toBe('notte')
    expect(fasciaPerOra(5)).toBe('notte')
    expect(fasciaPerOra(6)).toBe('mattina')
    expect(fasciaPerOra(10)).toBe('mezzogiorno')
    expect(fasciaPerOra(13)).toBe('mezzogiorno')
    expect(fasciaPerOra(14)).toBe('pomeriggio')
    expect(fasciaPerOra(18)).toBe('sera')
    expect(fasciaPerOra(23)).toBe('sera')
  })

  it('gestisce ore fuori intervallo senza rompersi', () => {
    expect(fasciaPerOra(24)).toBe('notte')
    expect(fasciaPerOra(-1)).toBe('sera')
  })
})

describe('conservazione dei profili', () => {
  it('ogni profilo ha pesi mensili e giornalieri che sommano a 1', () => {
    for (const p of PROFILI_CARICO) {
      expect(p.pesiMensili).toHaveLength(12)
      expect(somma(p.pesiMensili)).toBeCloseTo(1, 3)
      expect(somma(Object.values(p.pesiGiornalieri))).toBeCloseTo(1, 3)
    }
  })

  it('anche i pesi mensili grezzi della pompa di calore sommano a 1', () => {
    expect(PESI_MENSILI_FULL_ELECTRIC_PDC).toHaveLength(12)
    expect(somma(PESI_MENSILI_FULL_ELECTRIC_PDC)).toBeCloseTo(1, 3)
  })

  it('la pompa di calore pesa sull’inverno, la famiglia no', () => {
    // Gen+Dic della PdC devono superare di gran lunga il luglio.
    const pdcInverno = PESI_MENSILI_FULL_ELECTRIC_PDC[0]! + PESI_MENSILI_FULL_ELECTRIC_PDC[11]!
    const pdcLuglio = PESI_MENSILI_FULL_ELECTRIC_PDC[6]!
    expect(pdcInverno).toBeGreaterThan(pdcLuglio * 4)
  })
})

describe('quota oraria del consumo', () => {
  it('somma a 1 e riflette la giornata «serale» della famiglia', () => {
    const ore = quotaOrariaConsumo(FAMIGLIA_1_2)
    expect(ore).toHaveLength(24)
    expect(somma(ore)).toBeCloseTo(1, 6)
    // Mezzogiorno (10-14) è basso, la sera (18-24) è alta: in controfase col FV.
    const mezzogiorno = somma(ore.slice(10, 14))
    const sera = somma(ore.slice(18, 24))
    expect(mezzogiorno).toBeCloseTo(0.06, 6)
    expect(sera).toBeCloseTo(0.41, 6)
    expect(sera).toBeGreaterThan(mezzogiorno)
  })
})

describe('matrice consumo mese × ora', () => {
  it('conserva il consumo annuo, distribuito', () => {
    const m = matriceConsumoMensileOraria(5000, FAMIGLIA_1_2)
    expect(m).toHaveLength(12)
    expect(m[0]).toHaveLength(24)
    const totale = m.reduce((s, riga) => s + somma(riga), 0)
    expect(totale).toBeCloseTo(5000, 6)
  })

  it('luglio consuma meno di gennaio (vacanze)', () => {
    const m = matriceConsumoMensileOraria(5000, FAMIGLIA_1_2)
    expect(somma(m[6]!)).toBeLessThan(somma(m[0]!))
  })

  it('un consumo nullo o assurdo diventa una matrice di zeri', () => {
    const m = matriceConsumoMensileOraria(0, FAMIGLIA_1_2)
    expect(m.reduce((s, r) => s + somma(r), 0)).toBe(0)
    const n = matriceConsumoMensileOraria(Number.NaN, FAMIGLIA_1_2)
    expect(n.reduce((s, r) => s + somma(r), 0)).toBe(0)
  })
})

describe('autoconsumo dal matching cella per cella', () => {
  /** Matrice 12×24 con lo stesso valore in ogni ora indicata, resto zero. */
  function matriceSuOre(valorePerCella: number, ore: number[]): number[][] {
    return Array.from({ length: 12 }, () =>
      Array.from({ length: 24 }, (_, h) => (ore.includes(h) ? valorePerCella : 0)),
    )
  }

  it('conserva l’energia: autoconsumo + export = produzione, + prelievo = consumo', () => {
    const prod = matriceSuOre(1, [11, 12, 13])
    const cons = matriceSuOre(1, [12, 19, 20])
    const b = autoconsumoDaMatching(prod, cons)
    expect(b.autoconsumoKwh + b.exportKwh).toBeCloseTo(b.produzioneKwh, 6)
    expect(b.autoconsumoKwh + b.prelievoKwh).toBeCloseTo(b.consumoKwh, 6)
  })

  it('produzione a mezzogiorno e consumo di sera: autoconsumo basso', () => {
    // 3 kWh/giorno prodotti a mezzogiorno, 3 consumati di sera: si incontrano
    // solo nell'ora 12, dove entrambi valgono 1.
    const prod = matriceSuOre(1, [11, 12, 13])
    const cons = matriceSuOre(1, [12, 19, 20])
    const b = autoconsumoDaMatching(prod, cons)
    // Coincidono solo all'ora 12: 1 kWh × 12 mesi.
    expect(b.autoconsumoKwh).toBeCloseTo(12, 6)
    expect(b.produzioneKwh).toBeCloseTo(36, 6)
    expect(b.frazioneAutoconsumo).toBeCloseTo(12 / 36, 6)
  })

  it('produzione e consumo allineati: autoconsumo pieno fino al limite minore', () => {
    const prod = matriceSuOre(2, [12, 13])
    const cons = matriceSuOre(1, [12, 13])
    const b = autoconsumoDaMatching(prod, cons)
    // Il consumo (1) limita: autoconsumo = consumo, il resto è export.
    expect(b.autoconsumoKwh).toBeCloseTo(b.consumoKwh, 6)
    expect(b.prelievoKwh).toBeCloseTo(0, 6)
    expect(b.exportKwh).toBeCloseTo(b.produzioneKwh - b.consumoKwh, 6)
  })

  it('senza produzione, frazione di autoconsumo nulla e tutto da rete', () => {
    const cons = matriceSuOre(1, [19, 20])
    const b = autoconsumoDaMatching(matriceSuOre(0, []), cons)
    expect(b.autoconsumoKwh).toBe(0)
    expect(b.frazioneAutoconsumo).toBe(0)
    expect(b.prelievoKwh).toBeCloseTo(b.consumoKwh, 6)
  })
})
