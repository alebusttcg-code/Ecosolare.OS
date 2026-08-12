import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Esecutore } from '@/db'
import { rateLimits } from '@/db/schema'
import { createTestDatabase, type TestDatabase } from '@/db/testing'
import { consumaLimite } from './contatore'
import type { Finestra } from './politica'

/**
 * Il contatore contro un PostgreSQL vero.
 *
 * Il punto per cui questo file esiste è l'ultimo test: dieci richieste
 * simultanee devono contare dieci. Un contatore che legge e poi scrive ne
 * conterebbe una o due, e chi inonda l'endpoint manda tutto in parallelo —
 * quindi il caso concorrente non è un dettaglio, è l'unico che conta.
 */

const FINESTRA: Finestra = { massimo: 3, durataMs: 60_000 }
const INIZIO = new Date('2026-08-12T10:00:00.000Z')

function fra(secondi: number): Date {
  return new Date(INIZIO.getTime() + secondi * 1000)
}

describe('contatore persistente', () => {
  let db: TestDatabase
  let close: () => Promise<void>
  // PGlite e postgres-js hanno tipi di sessione diversi ma la stessa interfaccia
  // Drizzle: la conversione è l'attrito del doppio driver, non una scorciatoia.
  const esecutore = () => db as unknown as Esecutore

  beforeAll(async () => {
    const test = await createTestDatabase()
    db = test.db
    close = test.close
  })

  afterAll(async () => {
    await close()
  })

  beforeEach(async () => {
    await db.delete(rateLimits)
  })

  it('conta e blocca oltre la soglia', async () => {
    const esiti = []
    for (let n = 0; n < 5; n += 1) {
      esiti.push(
        await consumaLimite(esecutore(), {
          bucket: 'prova',
          chiave: '1.2.3.4',
          finestra: FINESTRA,
          adesso: fra(n),
        }),
      )
    }

    expect(esiti.map((e) => e.consentito)).toEqual([true, true, true, false, false])
    expect(esiti[4]!.riprovaTraSecondi).toBe(56)
  })

  it('tiene contatori separati per chiave', async () => {
    for (let n = 0; n < 4; n += 1) {
      await consumaLimite(esecutore(), {
        bucket: 'prova',
        chiave: 'inondatore',
        finestra: FINESTRA,
        adesso: fra(n),
      })
    }

    const altro = await consumaLimite(esecutore(), {
      bucket: 'prova',
      chiave: 'passante',
      finestra: FINESTRA,
      adesso: fra(5),
    })
    expect(altro.consentito).toBe(true)
  })

  it('ribalta la finestra conservando la precedente', async () => {
    for (let n = 0; n < 3; n += 1) {
      await consumaLimite(esecutore(), { bucket: 'prova', chiave: 'x', finestra: FINESTRA, adesso: fra(n) })
    }

    // Un istante dopo il ribaltamento la finestra precedente pesa ancora quasi
    // tutto: le tre richieste di un minuto fa non sono sparite.
    const subito = await consumaLimite(esecutore(), {
      bucket: 'prova',
      chiave: 'x',
      finestra: FINESTRA,
      adesso: fra(61),
    })
    expect(subito.consentito).toBe(false)

    const riga = await db.query.rateLimits.findFirst()
    expect(riga?.previousCount).toBe(3)
    expect(riga?.count).toBe(1)
  })

  it('dopo due finestre intere si riparte da zero', async () => {
    for (let n = 0; n < 4; n += 1) {
      await consumaLimite(esecutore(), { bucket: 'prova', chiave: 'x', finestra: FINESTRA, adesso: fra(n) })
    }

    const dopo = await consumaLimite(esecutore(), {
      bucket: 'prova',
      chiave: 'x',
      finestra: FINESTRA,
      adesso: fra(200),
    })
    expect(dopo.consentito).toBe(true)
    expect(dopo.usate).toBe(1)
  })

  it('dieci richieste simultanee contano dieci', async () => {
    const esiti = await Promise.all(
      Array.from({ length: 10 }, () =>
        consumaLimite(esecutore(), {
          bucket: 'prova',
          chiave: 'parallelo',
          finestra: FINESTRA,
          adesso: INIZIO,
        }),
      ),
    )

    const riga = await db.query.rateLimits.findFirst()
    expect(riga?.count).toBe(10)
    expect(esiti.filter((e) => e.consentito)).toHaveLength(3)
  })
})
