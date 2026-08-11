import { describe, expect, it } from 'vitest'
import {
  calcolaEconomiaTermico,
  fabbisognoTermicoDaGas,
  KWH_PER_SMC,
  rateContoTermico,
  RENDIMENTO_CALDAIA_DEFAULT,
} from './economia-termico'

/** Caso tipico: villetta con fabbisogno medio, PdC aria-acqua, prezzi 2026. */
const CASO = {
  fabbisognoTermicoKwh: 12000,
  scop: 3.8,
  prezzoGasEurSmc: 1.1,
  prezzoElettricoEurKwh: 0.3,
}

describe('economia della pompa di calore', () => {
  it('la pompa di calore conviene rispetto al gas', () => {
    const e = calcolaEconomiaTermico(CASO)
    expect(e.risparmioAnnuoCents).toBeGreaterThan(0)
    expect(e.costoGasEvitatoCents).toBeGreaterThan(e.costoElettricoAggiuntivoCents)
  })

  it('calcola il gas evitato dal rendimento della caldaia', () => {
    // 12.000 kWh termici / 0,92 di rendimento / 9,45 kWh per Smc ≈ 1.380 Smc.
    const e = calcolaEconomiaTermico(CASO)
    const atteso = 12000 / RENDIMENTO_CALDAIA_DEFAULT / KWH_PER_SMC
    expect(e.gasEvitatoSmc).toBeCloseTo(atteso, 0)
  })

  it('calcola l’elettricità in più dallo SCOP', () => {
    // Con SCOP 3,8 servono 12.000 / 3,8 ≈ 3.158 kWh elettrici.
    const e = calcolaEconomiaTermico(CASO)
    expect(e.consumoElettricoAnnuoKwh).toBe(Math.round(12000 / 3.8))
  })

  it('uno SCOP più alto fa risparmiare di più', () => {
    const scarso = calcolaEconomiaTermico({ ...CASO, scop: 2.5 })
    const buono = calcolaEconomiaTermico({ ...CASO, scop: 4.5 })
    expect(buono.risparmioAnnuoCents).toBeGreaterThan(scarso.risparmioAnnuoCents)
    expect(buono.consumoElettricoAnnuoKwh).toBeLessThan(scarso.consumoElettricoAnnuoKwh)
  })

  it('con gas a buon mercato ed elettricità cara può NON convenire', () => {
    // Va detto: il modello deve poter dire di no. Un motore che restituisce
    // sempre un risparmio positivo non sta calcolando, sta vendendo.
    const e = calcolaEconomiaTermico({
      ...CASO,
      scop: 2.5,
      prezzoGasEurSmc: 0.5,
      prezzoElettricoEurKwh: 0.45,
    })
    expect(e.risparmioAnnuoCents).toBeLessThan(0)
  })

  it('senza fabbisogno termico non c’è nessuna economia', () => {
    const e = calcolaEconomiaTermico({ ...CASO, fabbisognoTermicoKwh: 0 })
    expect(e.risparmioAnnuoCents).toBe(0)
    expect(e.consumoElettricoAnnuoKwh).toBe(0)
  })

  it('regge input assurdi senza produrre numeri assurdi', () => {
    for (const scop of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const e = calcolaEconomiaTermico({ ...CASO, scop })
      expect(Number.isFinite(e.risparmioAnnuoCents)).toBe(true)
    }
  })

  it('il risparmio è la differenza fra le due bollette', () => {
    const e = calcolaEconomiaTermico(CASO)
    expect(e.risparmioAnnuoCents).toBe(
      e.costoGasEvitatoCents - e.costoElettricoAggiuntivoCents,
    )
  })
})

describe('fabbisogno letto dalla bolletta del gas', () => {
  it('converte gli Smc dell’ultimo anno in calore utile', () => {
    // 1.400 Smc × 9,45 kWh × 0,92 di rendimento ≈ 12.170 kWh termici.
    expect(fabbisognoTermicoDaGas({ consumoGasAnnuoSmc: 1400 })).toBe(
      Math.round(1400 * KWH_PER_SMC * RENDIMENTO_CALDAIA_DEFAULT),
    )
  })

  it('esclude il gas che resta per la cucina', () => {
    // La cucina non la sostituisce nessuno: attribuirla alla pompa di calore
    // gonfierebbe il risparmio di un fabbisogno che non dovrà mai coprire.
    const tutto = fabbisognoTermicoDaGas({ consumoGasAnnuoSmc: 1400 })
    const senzaCucina = fabbisognoTermicoDaGas({
      consumoGasAnnuoSmc: 1400,
      gasNonSostituitoSmc: 120,
    })
    expect(senzaCucina).toBeLessThan(tutto)
    expect(senzaCucina).toBe(Math.round(1280 * KWH_PER_SMC * RENDIMENTO_CALDAIA_DEFAULT))
  })

  it('non va sotto zero se la cucina dichiarata supera il totale', () => {
    expect(
      fabbisognoTermicoDaGas({ consumoGasAnnuoSmc: 100, gasNonSostituitoSmc: 500 }),
    ).toBe(0)
  })

  it('senza consumo di gas non c’è fabbisogno da convertire', () => {
    expect(fabbisognoTermicoDaGas({ consumoGasAnnuoSmc: 0 })).toBe(0)
  })

  it('una caldaia vecchia e inefficiente sposta meno calore in casa', () => {
    const efficiente = fabbisognoTermicoDaGas({ consumoGasAnnuoSmc: 1400, rendimentoCaldaia: 0.92 })
    const vecchia = fabbisognoTermicoDaGas({ consumoGasAnnuoSmc: 1400, rendimentoCaldaia: 0.75 })
    expect(vecchia).toBeLessThan(efficiente)
  })

  it('chiude il cerchio con il calcolo del risparmio', () => {
    // Il fabbisogno dedotto dal gas, rimesso nel motore, deve restituire
    // all'incirca lo stesso gas evitato: è la prova che le due formule sono
    // l'una l'inversa dell'altra.
    const fabbisogno = fabbisognoTermicoDaGas({ consumoGasAnnuoSmc: 1400 })
    const e = calcolaEconomiaTermico({ ...CASO, fabbisognoTermicoKwh: fabbisogno })
    expect(e.gasEvitatoSmc).toBeCloseTo(1400, -1)
  })
})

describe('Conto Termico', () => {
  it('ripartisce l’importo sugli anni di erogazione', () => {
    const rate = rateContoTermico(570000, 5)
    expect(rate).toHaveLength(5)
    expect(rate.reduce((a, b) => a + b, 0)).toBe(570000)
  })

  it('l’ultima rata assorbe l’arrotondamento', () => {
    // 100.001 centesimi su 3 anni: senza correzione mancherebbero 2 centesimi,
    // e il totale stampato non coinciderebbe con quello dichiarato.
    const rate = rateContoTermico(100001, 3)
    expect(rate.reduce((a, b) => a + b, 0)).toBe(100001)
  })

  it('erogazione unica quando l’anno è uno solo', () => {
    expect(rateContoTermico(500000, 1)).toEqual([500000])
  })

  it('nessun contributo, nessuna rata', () => {
    expect(rateContoTermico(0, 5)).toEqual([])
  })
})
