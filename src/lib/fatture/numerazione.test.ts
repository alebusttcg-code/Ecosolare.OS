import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Esecutore } from '@/db'
import { createTestDatabase, type TestDatabase } from '@/db/testing'
import { formattaNumeroFattura, prossimoNumeroFattura } from './numerazione'

describe('formattazione del numero', () => {
  it('con e senza sezionale', () => {
    expect(formattaNumeroFattura('', 2026, 1)).toBe('2026/0001')
    expect(formattaNumeroFattura('A', 2026, 42)).toBe('A/2026/0042')
  })
})

describe('numerazione gapless su PostgreSQL', () => {
  let db: TestDatabase
  let close: () => Promise<void>
  const es = () => db as unknown as Esecutore

  beforeAll(async () => {
    const test = await createTestDatabase()
    db = test.db
    close = test.close
  })
  afterAll(async () => {
    await close()
  })

  it('assegna numeri consecutivi a partire da 1', async () => {
    const a = await prossimoNumeroFattura(es(), '', 2026)
    const b = await prossimoNumeroFattura(es(), '', 2026)
    const c = await prossimoNumeroFattura(es(), '', 2026)
    expect([a.number, b.number, c.number]).toEqual([1, 2, 3])
    expect(c.displayNumber).toBe('2026/0003')
  })

  it('sezionali e anni diversi hanno contatori indipendenti', async () => {
    const altroSez = await prossimoNumeroFattura(es(), 'PA', 2026)
    const altroAnno = await prossimoNumeroFattura(es(), '', 2027)
    expect(altroSez.number).toBe(1)
    expect(altroAnno.number).toBe(1)
  })

  it('un rollback non lascia buchi: il contatore torna indietro', async () => {
    // Consuma il numero 1 su un sezionale nuovo.
    const primo = await prossimoNumeroFattura(es(), 'RB', 2026)
    expect(primo.number).toBe(1)

    // In una transazione prende il 2, poi fallisce: la transazione torna indietro.
    await expect(
      db.transaction(async (tx) => {
        const dentro = await prossimoNumeroFattura(tx as unknown as Esecutore, 'RB', 2026)
        expect(dentro.number).toBe(2)
        throw new Error('emissione fallita')
      }),
    ).rejects.toThrow('emissione fallita')

    // Il prossimo numero è ancora 2, non 3: il rollback ha annullato l'incremento.
    const dopo = await prossimoNumeroFattura(es(), 'RB', 2026)
    expect(dopo.number).toBe(2)
  })
})
