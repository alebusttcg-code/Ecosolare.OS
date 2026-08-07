import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database, Esecutore } from '@/db'
import { outboxEvents } from '@/db/schema'
import { createTestDatabase, type TestDatabase } from '@/db/testing'
import { accoda, elaboraOutbox, riprovaFalliti, type Gestore } from './index'
import { TENTATIVI_MASSIMI } from './ritentativi'

/**
 * L'outbox contro un PostgreSQL vero.
 *
 * Le proprietà che contano — deduplica, ritentativo, resa dopo troppi
 * fallimenti — dipendono da vincoli e transazioni del database: provarle con
 * un finto database proverebbe soltanto il finto.
 */
describe('coda degli effetti esterni', () => {
  let db: TestDatabase
  let close: () => Promise<void>

  beforeAll(async () => {
    const test = await createTestDatabase()
    db = test.db
    close = test.close
    // I gestori falliti scrivono su console per progetto: nei test è rumore.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterAll(async () => {
    await close()
  })

  beforeEach(async () => {
    await db.delete(outboxEvents)
  })

  /**
   * L'applicazione parla con postgres-js, i test con PGlite: le due
   * connessioni si comportano allo stesso modo ma hanno tipi diversi. La
   * conversione sta qui, confinata al test, per non ammorbidire la firma del
   * codice che va in produzione.
   */
  const come = () => db as unknown as Database
  const comeEsecutore = () => db as unknown as Esecutore

  const stato = async () => db.select().from(outboxEvents)

  it('esegue il gestore e segna l’evento completato', async () => {
    const visti: unknown[] = []
    const gestore: Gestore = async (payload) => {
      visti.push(payload)
    }

    await accoda(comeEsecutore(), { type: 'prova', payload: { valore: 42 } })
    const esito = await elaboraOutbox({ prova: gestore }, { db: come() })

    expect(esito).toMatchObject({ elaborati: 1, completati: 1, falliti: 0 })
    expect(visti).toEqual([{ valore: 42 }])

    const [riga] = await stato()
    expect(riga!.status).toBe('completato')
    expect(riga!.processedAt).not.toBeNull()
  })

  it('non accoda due volte lo stesso effetto', async () => {
    // È il caso reale: la firma viene ritentata, oppure l'utente preme due
    // volte. Due cartelle «Rossi Mario» sono peggio di nessuna.
    await accoda(comeEsecutore(), { type: 'prova', payload: { a: 1 }, dedupKey: 'cliente:1' })
    await accoda(comeEsecutore(), { type: 'prova', payload: { a: 2 }, dedupKey: 'cliente:1' })

    const righe = await stato()
    expect(righe).toHaveLength(1)
    // Vince il primo: il secondo non deve nemmeno sovrascrivere il payload.
    expect(righe[0]!.payload).toEqual({ a: 1 })
  })

  it('accoda senza limiti gli eventi senza chiave di deduplica', async () => {
    await accoda(comeEsecutore(), { type: 'prova', payload: {} })
    await accoda(comeEsecutore(), { type: 'prova', payload: {} })
    expect(await stato()).toHaveLength(2)
  })

  it('rimanda l’evento che fallisce, senza perderlo', async () => {
    const gestore: Gestore = async () => {
      throw new Error('Drive non risponde')
    }

    await accoda(comeEsecutore(), { type: 'prova', payload: {} })
    const esito = await elaboraOutbox({ prova: gestore }, { db: come() })

    expect(esito).toMatchObject({ rimandati: 1, completati: 0, falliti: 0 })

    const [riga] = await stato()
    expect(riga!.status).toBe('in_attesa')
    expect(riga!.attempts).toBe(1)
    expect(riga!.lastError).toContain('Drive non risponde')
    // Rimandato nel futuro: rielaborarlo subito sprecherebbe i tentativi.
    expect(riga!.availableAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('non riprende un evento la cui attesa non è ancora scaduta', async () => {
    const sempreRotto: Gestore = async () => {
      throw new Error('giù')
    }

    await accoda(comeEsecutore(), { type: 'prova', payload: {} })
    await elaboraOutbox({ prova: sempreRotto }, { db: come() })

    const secondo = await elaboraOutbox({ prova: sempreRotto }, { db: come() })
    expect(secondo.elaborati).toBe(0)
  })

  it('si arrende dopo troppi tentativi, lasciando scritto il motivo', async () => {
    const sempreRotto: Gestore = async () => {
      throw new Error('permesso negato')
    }

    await accoda(comeEsecutore(), { type: 'prova', payload: {} })
    // Si porta il contatore a un passo dal limite: rieseguire davvero otto
    // volte significherebbe aspettare le attese crescenti.
    await db
      .update(outboxEvents)
      .set({ attempts: TENTATIVI_MASSIMI - 1, availableAt: new Date(Date.now() - 1000) })

    const esito = await elaboraOutbox({ prova: sempreRotto }, { db: come() })
    expect(esito).toMatchObject({ falliti: 1, rimandati: 0 })

    const [riga] = await stato()
    expect(riga!.status).toBe('fallito')
    expect(riga!.lastError).toContain('permesso negato')
  })

  it('segna fallito, non rimandato, un tipo senza gestore', async () => {
    // Ritentarlo non lo farebbe comparire: sarebbe un evento eternamente in
    // attesa di qualcosa che non arriva.
    await accoda(comeEsecutore(), { type: 'tipo.sconosciuto', payload: {} })
    const esito = await elaboraOutbox({}, { db: come() })

    expect(esito).toMatchObject({ falliti: 1 })
    const [riga] = await stato()
    expect(riga!.status).toBe('fallito')
    expect(riga!.lastError).toContain('tipo.sconosciuto')
  })

  it('rimette in coda i falliti quando la causa è stata sistemata', async () => {
    await accoda(comeEsecutore(), { type: 'tipo.sconosciuto', payload: {} })
    await elaboraOutbox({}, { db: come() })

    expect(await riprovaFalliti(come())).toBe(1)

    const [riga] = await stato()
    expect(riga!.status).toBe('in_attesa')
    expect(riga!.attempts).toBe(0)
    expect(riga!.lastError).toBeNull()
  })

  it('rispetta il limite di eventi per esecuzione', async () => {
    for (let i = 0; i < 5; i += 1) {
      await accoda(comeEsecutore(), { type: 'prova', payload: { i } })
    }
    const esito = await elaboraOutbox({ prova: async () => {} }, { db: come(), limite: 2 })
    expect(esito.elaborati).toBe(2)
  })

  it('non lascia mai un evento bloccato in «in corso»', async () => {
    // Uno che riesce, uno che fallisce, uno senza gestore: nessuno dei tre
    // deve restare nello stato intermedio, che nessun'altra esecuzione
    // riprenderebbe.
    await accoda(comeEsecutore(), { type: 'ok', payload: {}, dedupKey: 'a' })
    await accoda(comeEsecutore(), { type: 'ko', payload: {}, dedupKey: 'b' })
    await accoda(comeEsecutore(), { type: 'ignoto', payload: {}, dedupKey: 'c' })

    await elaboraOutbox(
      {
        ok: async () => {},
        ko: async () => {
          throw new Error('no')
        },
      },
      { db: come() },
    )

    const righe = await stato()
    expect(righe.filter((r) => r.status === 'in_corso')).toEqual([])
  })

  it('lascia intatti gli eventi già completati', async () => {
    await accoda(comeEsecutore(), { type: 'prova', payload: {}, dedupKey: 'x' })
    await elaboraOutbox({ prova: async () => {} }, { db: come() })

    const chiamate: number[] = []
    await elaboraOutbox({ prova: async () => void chiamate.push(1) }, { db: come() })
    expect(chiamate).toEqual([])

    const [riga] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.dedupKey, 'x'))
    expect(riga!.attempts).toBe(1)
  })
})
