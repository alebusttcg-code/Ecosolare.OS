import { describe, expect, it } from 'vitest'
import {
  datiMancantiTermico,
  ingressiTermico,
  termicoEntraNelPiano,
} from './diagnostica-termico'

/**
 * Le condizioni qui devono restare quelle di `simulaImpiantoFv`. Se una delle
 * due cambia senza l'altra, l'avviso diventa una bugia: dice che i conti ci
 * sono mentre il motore li sta saltando, o viceversa.
 */
describe('perché il termico non entra nel piano', () => {
  const completo = { consumoGasAnnuoSmc: 1200, scop: 4, prezzoGasEurSmc: 1.1 }

  it('con tutti e tre i dati non manca niente', () => {
    expect(datiMancantiTermico(completo)).toEqual([])
    expect(termicoEntraNelPiano(completo)).toBe(true)
  })

  it('nomina il gas quando manca, e dice che sta nello studio tetto', () => {
    const mancanti = datiMancantiTermico({ ...completo, consumoGasAnnuoSmc: null })
    expect(mancanti).toHaveLength(1)
    expect(mancanti[0]!.cosa).toContain('gas consumato')
    expect(mancanti[0]!.dove).toContain('studio tetto')
  })

  it('nomina lo SCOP e manda al catalogo, che è dove va messo', () => {
    const mancanti = datiMancantiTermico({ ...completo, scop: 0 })
    expect(mancanti).toHaveLength(1)
    expect(mancanti[0]!.cosa).toContain('SCOP')
    expect(mancanti[0]!.dove).toContain('catalogo')
  })

  it('li elenca tutti quando manca tutto', () => {
    const mancanti = datiMancantiTermico({
      consumoGasAnnuoSmc: null,
      scop: undefined,
      prezzoGasEurSmc: 0,
    })
    expect(mancanti).toHaveLength(3)
    expect(termicoEntraNelPiano({ consumoGasAnnuoSmc: null, scop: null, prezzoGasEurSmc: null })).toBe(false)
  })

  it('lo zero e il negativo valgono «manca», non «vale zero»', () => {
    // Uno SCOP di zero non è una pompa di calore con rendimento nullo: è un
    // campo che nessuno ha compilato.
    expect(datiMancantiTermico({ ...completo, scop: 0 })).toHaveLength(1)
    expect(datiMancantiTermico({ ...completo, prezzoGasEurSmc: -1 })).toHaveLength(1)
  })

  it('non si fa ingannare da un numero che non è un numero', () => {
    expect(datiMancantiTermico({ ...completo, scop: Number.NaN })).toHaveLength(1)
    expect(
      datiMancantiTermico({ ...completo, consumoGasAnnuoSmc: Number.POSITIVE_INFINITY }),
    ).toHaveLength(1)
  })
})

describe('da dove arrivano i tre dati', () => {
  const base = {
    consumoGasAnnuoSmc: 1200,
    scopCatalogo: null,
    scopManuale: null,
    prezzoGasManuale: null,
    prezzoGasPredefinito: 1.1,
  }

  it('il catalogo vince sul valore scritto a mano', () => {
    expect(
      ingressiTermico({ ...base, scopCatalogo: 4.2, scopManuale: 3 }).scop,
    ).toBe(4.2)
  })

  it('senza catalogo vale quello scritto a mano', () => {
    expect(ingressiTermico({ ...base, scopManuale: 3.6 }).scop).toBe(3.6)
  })

  it('il prezzo del preventivo vince sul valore aziendale', () => {
    // È il gas del cliente: se l'ha scritto, è quello giusto.
    expect(
      ingressiTermico({ ...base, prezzoGasManuale: 1.45 }).prezzoGasEurSmc,
    ).toBe(1.45)
  })

  it('senza prezzo nel preventivo ripiega su quello configurato', () => {
    expect(ingressiTermico(base).prezzoGasEurSmc).toBe(1.1)
  })

  it('il gas consumato non ha alternative: o c’è o manca', () => {
    // Con SCOP e prezzo a posto, il gas è l'unica cosa che può mancare — e non
    // ha un valore predefinito che lo copra: viene dalla bolletta del cliente.
    const senzaGas = ingressiTermico({
      ...base,
      scopCatalogo: 4,
      consumoGasAnnuoSmc: null,
    })
    expect(senzaGas.consumoGasAnnuoSmc).toBeNull()
    const mancanti = datiMancantiTermico(senzaGas)
    expect(mancanti).toHaveLength(1)
    expect(mancanti[0]!.dove).toContain('studio tetto')
  })

  it('uno zero non conta come valore: scavalca al successivo', () => {
    // Un campo lasciato vuoto arriva come 0 o NaN dal parsing: non deve
    // impedire al valore predefinito di entrare.
    expect(
      ingressiTermico({ ...base, prezzoGasManuale: 0 }).prezzoGasEurSmc,
    ).toBe(1.1)
    expect(
      ingressiTermico({ ...base, scopCatalogo: Number.NaN, scopManuale: 4 }).scop,
    ).toBe(4)
  })

  it('con tutto al suo posto il termico entra nel piano', () => {
    expect(
      termicoEntraNelPiano(ingressiTermico({ ...base, scopCatalogo: 4 })),
    ).toBe(true)
  })
})
