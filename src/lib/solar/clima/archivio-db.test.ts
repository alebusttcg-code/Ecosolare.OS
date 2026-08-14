import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Esecutore } from '@/db'
import { createTestDatabase, type TestDatabase } from '@/db/testing'
import { climateCache } from '@/db/schema'
import { archivioClimatologiaDb } from './archivio-db'
import { getClimatologia } from './index'
import type { Climatologia } from './climatologia'

/**
 * L'adattatore contro un PostgreSQL vero (PGlite): la cache dipende da una
 * tabella e da un `on conflict`, che un finto database non proverebbe.
 */
function climaFinta(ghiAnnuo: number): Climatologia {
  const m = () => Array.from({ length: 12 }, () => new Array<number>(24).fill(1))
  return {
    fonte: 'PVGIS-TMY',
    lat: 44.11,
    lng: 9.96,
    elevazioneM: 16,
    ghiAnnuoKwhM2: ghiAnnuo,
    ghi: m(),
    dni: m(),
    dhi: m(),
    temperatura: m(),
  }
}

function rispostaPvgisFinta(): Response {
  const tmy_hourly = Array.from({ length: 8760 }, () => ({
    'time(UTC)': '20080115:1200',
    'T2m': 15,
    'G(h)': 500,
    'Gb(n)': 300,
    'Gd(h)': 200,
  }))
  return {
    ok: true,
    json: async () => ({
      inputs: { location: { latitude: 44.11, longitude: 9.96, elevation: 16 } },
      outputs: { tmy_hourly },
    }),
  } as unknown as Response
}

describe('archivio climatologia su PostgreSQL', () => {
  let db: TestDatabase
  let close: () => Promise<void>
  // PGlite e postgres-js hanno tipi di sessione diversi: il cast è la convenzione
  // del progetto (vedere outbox.test.ts), il PostgreSQL sottostante è lo stesso.
  const comeEsecutore = () => db as unknown as Esecutore

  beforeAll(async () => {
    const test = await createTestDatabase()
    db = test.db
    close = test.close
  })

  afterAll(async () => {
    await close()
  })

  it('una chiave assente restituisce null', async () => {
    const archivio = archivioClimatologiaDb(comeEsecutore())
    expect(await archivio.leggi('non,esiste')).toBeNull()
  })

  it('scrive e rilegge la stessa climatologia', async () => {
    const archivio = archivioClimatologiaDb(comeEsecutore())
    const clima = climaFinta(1469)
    await archivio.scrivi('44.11,9.96', clima)

    const riletta = await archivio.leggi('44.11,9.96')
    expect(riletta?.ghiAnnuoKwhM2).toBe(1469)
    expect(riletta?.ghi).toHaveLength(12)
  })

  it('riscrivere la stessa chiave aggiorna, non duplica', async () => {
    const archivio = archivioClimatologiaDb(comeEsecutore())
    await archivio.scrivi('45.00,10.00', climaFinta(1400))
    await archivio.scrivi('45.00,10.00', climaFinta(1600)) // stesso sito, dato nuovo

    const dellaChiave = (await archivio.leggi('45.00,10.00'))!
    expect(dellaChiave.ghiAnnuoKwhM2).toBe(1600)
    // Nessun raddoppio: una sola riga per quella chiave, aggiornata.
    const righeChiave = await db
      .select({ gridKey: climateCache.gridKey })
      .from(climateCache)
      .where(eq(climateCache.gridKey, '45.00,10.00'))
    expect(righeChiave).toHaveLength(1)
  })

  it('getClimatologia scarica una volta e poi risponde dal database', async () => {
    const archivio = archivioClimatologiaDb(comeEsecutore())
    const fetchImpl = vi.fn(async () => rispostaPvgisFinta())

    await getClimatologia(43.5, 11.2, { archivio, fetchImpl })
    // Seconda richiesta stessa griglia: deve leggere dal DB, non richiamare PVGIS.
    const seconda = await getClimatologia(43.5, 11.2, { archivio, fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(seconda.fonte).toBe('PVGIS-TMY')
  })
})
