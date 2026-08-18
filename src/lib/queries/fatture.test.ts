import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { invoices } from '@/db/schema'
import { createTestDatabase, type TestDatabase } from '@/db/testing'

const contenitore: { db?: TestDatabase } = {}
vi.mock('@/db', async () => {
  const reale = await vi.importActual<typeof import('@/db')>('@/db')
  return { ...reale, getDb: () => contenitore.db }
})

const { getFatturePerRegistro } = await import('./fatture')

describe('registro fatture per periodo', () => {
  let db: TestDatabase
  let close: () => Promise<void>

  beforeAll(async () => {
    const test = await createTestDatabase()
    db = test.db
    close = test.close
    contenitore.db = db
  })
  afterAll(async () => {
    await close()
  })

  it('prende solo le fatture numerate del periodo, mappate dallo snapshot', async () => {
    await db.insert(invoices).values([
      {
        type: 'fattura',
        status: 'emessa',
        displayNumber: '2026/0001',
        dataDocumento: new Date('2026-06-15T10:00:00Z'),
        clienteSnapshot: {
          denominazione: 'Mario Rossi',
          codiceFiscale: 'RSSMRA80A01H501U',
          partitaIva: null,
        },
        vatBreakdown: [{ aliquota: 10, imponibile: '1000.00', imposta: '100.00' }],
        imponibile: '1000.00',
        imposta: '100.00',
        totale: '1100.00',
      },
      // Bozza: niente numero, esclusa.
      { type: 'fattura', status: 'bozza', imponibile: '500.00', imposta: '50.00', totale: '550.00' },
      // Emessa ma fuori periodo (anno prima), esclusa.
      {
        type: 'fattura',
        status: 'emessa',
        displayNumber: '2025/0009',
        dataDocumento: new Date('2025-06-15T10:00:00Z'),
        clienteSnapshot: {},
        imponibile: '9.00',
        imposta: '0.90',
        totale: '9.90',
      },
    ])

    const righe = await getFatturePerRegistro(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-12-31T23:59:59Z'),
    )

    expect(righe).toHaveLength(1)
    expect(righe[0]!.numero).toBe('2026/0001')
    expect(righe[0]!.cliente).toBe('Mario Rossi')
    expect(righe[0]!.codiceFiscale).toBe('RSSMRA80A01H501U')
    expect(righe[0]!.imponibileCents).toBe(100_000)
    expect(righe[0]!.totaleCents).toBe(110_000)
    expect(righe[0]!.aliquote).toEqual([10])
  })
})
