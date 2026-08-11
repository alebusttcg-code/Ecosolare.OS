import { describe, expect, it } from 'vitest'
import {
  calcolaIndicatori,
  costoLivellatoEnergiaEurKwh,
  ritornoInvestimentoPct,
  tassoInternoRendimento,
} from './indicatori-fv'

/**
 * I tre dossier di riferimento come banco di prova.
 *
 * Le costanti sono state ricavate da questi numeri: se un domani qualcuno le
 * cambia, questi test dicono immediatamente che i nuovi preventivi non sono
 * più confrontabili con quelli già consegnati ai clienti.
 */
const RIFERIMENTI = [
  { nome: 'Riboldi', produzione: 8066, kWp: 6, co2: 2.06, alberi: 95, resa: 1344, ca: 5, sovra: 117 },
  { nome: 'Ricci', produzione: 7960, kWp: 6, co2: 2.04, alberi: 94, resa: 1327, ca: 5, sovra: 118 },
  { nome: 'Tarantola', produzione: 5235, kWp: 4, co2: 1.34, alberi: 62, resa: 1309, ca: 3, sovra: 129 },
] as const

describe('indicatori allineati ai dossier di riferimento', () => {
  for (const r of RIFERIMENTI) {
    describe(r.nome, () => {
      const esito = calcolaIndicatori({
        produzioneAnnuaKwh: r.produzione,
        potenzaKwp: r.kWp,
        potenzaCaKw: r.ca,
        irraggiamentoPianoKwhM2: null,
      })

      it('riproduce la CO₂ evitata dichiarata', () => {
        expect(esito.co2EvitataTonnellate).toBeCloseTo(r.co2, 2)
      })

      it('riproduce gli alberi equivalenti dichiarati', () => {
        expect(esito.alberiEquivalenti).toBe(r.alberi)
      })

      it('riproduce la resa specifica dichiarata', () => {
        expect(Math.round(esito.resaSpecificaKwhKwp!)).toBe(r.resa)
      })

      it('riproduce il sovradimensionamento CC/CA dichiarato', () => {
        expect(Math.round(esito.sovradimensionamentoPct!)).toBeCloseTo(r.sovra, -0.5)
      })
    })
  }

  it('senza potenza CA non inventa il sovradimensionamento', () => {
    const esito = calcolaIndicatori({
      produzioneAnnuaKwh: 6000,
      potenzaKwp: 6,
      potenzaCaKw: null,
      irraggiamentoPianoKwhM2: null,
    })
    expect(esito.sovradimensionamentoPct).toBeNull()
  })

  it('senza irraggiamento non inventa il performance ratio', () => {
    const esito = calcolaIndicatori({
      produzioneAnnuaKwh: 6000,
      potenzaKwp: 6,
      potenzaCaKw: 5,
      irraggiamentoPianoKwhM2: null,
    })
    expect(esito.performanceRatio).toBeNull()
  })

  it('la potenza CC reale è sotto il nominale di targa', () => {
    const esito = calcolaIndicatori({
      produzioneAnnuaKwh: 8066,
      potenzaKwp: 6,
      potenzaCaKw: 5,
      irraggiamentoPianoKwhM2: null,
    })
    expect(esito.potenzaCcMassimaKw).toBeLessThan(6)
    expect(esito.potenzaCcMassimaKw).toBeCloseTo(5.83, 1)
  })
})

describe('tasso interno di rendimento', () => {
  it('trova il tasso che annulla il valore attuale', () => {
    // Investo 1000, incasso 600 per tre anni: TIR noto ≈ 36,3%.
    const tir = tassoInternoRendimento([-100000, 60000, 60000, 60000])
    expect(tir).not.toBeNull()
    expect(tir! * 100).toBeCloseTo(36.3, 0)
  })

  it('restituisce null se i flussi non cambiano mai segno', () => {
    // Senza esborso iniziale non esiste nessun rendimento da calcolare:
    // restituire zero sarebbe una bugia comoda.
    expect(tassoInternoRendimento([1000, 1000, 1000])).toBeNull()
    expect(tassoInternoRendimento([-1000, -1000])).toBeNull()
  })

  it('restituisce null su una serie troppo corta', () => {
    expect(tassoInternoRendimento([-1000])).toBeNull()
  })

  it('un investimento migliore ha un tasso più alto', () => {
    const scarso = tassoInternoRendimento([-100000, 20000, 20000, 20000, 20000, 20000])!
    const buono = tassoInternoRendimento([-100000, 40000, 40000, 40000, 40000, 40000])!
    expect(buono).toBeGreaterThan(scarso)
  })
})

describe('ritorno sull’investimento', () => {
  it('è il rapporto fra guadagni e investimento', () => {
    expect(ritornoInvestimentoPct(100000, 238740)).toBeCloseTo(238.74, 1)
  })

  it('non divide per zero', () => {
    expect(ritornoInvestimentoPct(0, 1000)).toBeNull()
  })
})

describe('costo livellato dell’energia', () => {
  it('resta molto sotto la tariffa di rete, ed è il confronto che convince', () => {
    const lcoe = costoLivellatoEnergiaEurKwh({
      investimentoNettoCents: 590000,
      produzioneAnnuaKwh: 8066,
      orizzonteAnni: 25,
      tassoScontoPct: 3,
      degradazionePctAnno: 0.5,
    })
    expect(lcoe).not.toBeNull()
    expect(lcoe!).toBeGreaterThan(0)
    expect(lcoe!).toBeLessThan(0.15)
  })

  it('cresce se l’impianto costa di più a parità di produzione', () => {
    const base = { produzioneAnnuaKwh: 8000, orizzonteAnni: 25, tassoScontoPct: 3, degradazionePctAnno: 0.5 }
    const economico = costoLivellatoEnergiaEurKwh({ ...base, investimentoNettoCents: 500000 })!
    const costoso = costoLivellatoEnergiaEurKwh({ ...base, investimentoNettoCents: 900000 })!
    expect(costoso).toBeGreaterThan(economico)
  })

  it('senza produzione non è calcolabile', () => {
    expect(
      costoLivellatoEnergiaEurKwh({
        investimentoNettoCents: 500000,
        produzioneAnnuaKwh: 0,
        orizzonteAnni: 25,
        tassoScontoPct: 3,
        degradazionePctAnno: 0.5,
      }),
    ).toBeNull()
  })
})
