import { describe, expect, it } from 'vitest'
import { componiFattura, componiFatturaDaMilestone } from './fattura'

describe('composizione della fattura', () => {
  it('applica l’aliquota all’imponibile (10% agevolato FV)', () => {
    // 1.000,00 € imponibile al 10% → 100,00 € IVA → 1.100,00 € totale.
    const f = componiFattura([{ descrizione: 'Acconto', imponibileCents: 100_000, aliquotaIva: 1000 }])
    expect(f.imponibileCents).toBe(100_000)
    expect(f.impostaCents).toBe(10_000)
    expect(f.totaleCents).toBe(110_000)
  })

  it('raggruppa per aliquota, ordinato', () => {
    const f = componiFattura([
      { descrizione: 'Impianto FV', imponibileCents: 100_000, aliquotaIva: 1000 },
      { descrizione: 'Voce ordinaria', imponibileCents: 50_000, aliquotaIva: 2200 },
    ])
    expect(f.ripartizioneIva).toEqual([
      { aliquota: 1000, imponibile: 100_000, imposta: 10_000 },
      { aliquota: 2200, imponibile: 50_000, imposta: 11_000 },
    ])
    expect(f.totaleCents).toBe(100_000 + 50_000 + 10_000 + 11_000)
  })

  it('arrotonda l’imposta per riga, poi somma (prassi italiana)', () => {
    // 33,33 € al 10% = 3,333 € → 3,33 a riga. Due righe: 6,66, non 6,67.
    const f = componiFattura([
      { descrizione: 'A', imponibileCents: 3_333, aliquotaIva: 1000 },
      { descrizione: 'B', imponibileCents: 3_333, aliquotaIva: 1000 },
    ])
    expect(f.righe.map((r) => r.impostaCents)).toEqual([333, 333])
    expect(f.impostaCents).toBe(666)
  })

  it('la conservazione tiene: totale = imponibile + imposta', () => {
    const f = componiFattura([
      { descrizione: 'A', imponibileCents: 123_45, aliquotaIva: 1000 },
      { descrizione: 'B', imponibileCents: 678_90, aliquotaIva: 2200 },
    ])
    const sommaRip = f.ripartizioneIva.reduce((s, r) => s + r.imponibile + r.imposta, 0)
    expect(f.totaleCents).toBe(f.imponibileCents + f.impostaCents)
    expect(f.totaleCents).toBe(sommaRip)
  })

  it('una nota di credito è la fattura in negativo', () => {
    const f = componiFattura([{ descrizione: 'Storno acconto', imponibileCents: -100_000, aliquotaIva: 1000 }])
    expect(f.imponibileCents).toBe(-100_000)
    expect(f.impostaCents).toBe(-10_000)
    expect(f.totaleCents).toBe(-110_000)
  })
})

describe('fattura da milestone', () => {
  it('una riga sola con l’importo della tranche e l’aliquota configurata', () => {
    const f = componiFatturaDaMilestone({
      importoNetCents: 500_000,
      aliquotaIva: 1000,
      descrizione: 'Acconto 30% alla firma',
    })
    expect(f.righe).toHaveLength(1)
    expect(f.righe[0]!.descrizione).toBe('Acconto 30% alla firma')
    expect(f.imponibileCents).toBe(500_000)
    expect(f.totaleCents).toBe(550_000)
  })
})
