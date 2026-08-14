import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Esecutore } from '@/db'
import { buildingInsightsCache } from '@/db/schema'
import { createTestDatabase, type TestDatabase } from '@/db/testing'
import { archivioBuildingInsightsDb } from './building-insights-cache-db'
import {
  buildingInsightsConCache,
  type DatiTetto,
} from './building-insights-cache'
import type { EsitoBuildingInsights } from './building-insights'

function datiFinti(sunshine: number): DatiTetto {
  return {
    location: { latitude: 44.11, longitude: 9.96 },
    boundingBox: null,
    imageryQuality: null,
    imageryDate: null,
    maxArrayPanelsCount: null,
    maxSunshineHoursPerYear: sunshine,
    wholeRoofAreaMeters2: null,
    falde: [],
  }
}

describe('cache buildingInsights su PostgreSQL', () => {
  let db: TestDatabase
  let close: () => Promise<void>
  const comeEsecutore = () => db as unknown as Esecutore

  beforeAll(async () => {
    const test = await createTestDatabase()
    db = test.db
    close = test.close
  })

  afterAll(async () => {
    await close()
  })

  it('scrive e rilegge la stessa analisi del tetto', async () => {
    const archivio = archivioBuildingInsightsDb(comeEsecutore())
    await archivio.scrivi('44.1103,9.9612', datiFinti(1325))
    const riletta = await archivio.leggi('44.1103,9.9612')
    expect(riletta?.maxSunshineHoursPerYear).toBe(1325)
    expect(riletta?.location.latitude).toBe(44.11)
  })

  it('riscrivere la stessa chiave aggiorna, non duplica', async () => {
    const archivio = archivioBuildingInsightsDb(comeEsecutore())
    await archivio.scrivi('45.0000,10.0000', datiFinti(1000))
    await archivio.scrivi('45.0000,10.0000', datiFinti(1500))
    const righe = await db
      .select({ k: buildingInsightsCache.coordKey })
      .from(buildingInsightsCache)
      .where(eq(buildingInsightsCache.coordKey, '45.0000,10.0000'))
    expect(righe).toHaveLength(1)
    expect((await archivio.leggi('45.0000,10.0000'))?.maxSunshineHoursPerYear).toBe(1500)
  })

  it('il giro completo: cerca una volta, poi risponde dal database', async () => {
    const archivio = archivioBuildingInsightsDb(comeEsecutore())
    const cerca = vi.fn(
      async (): Promise<EsitoBuildingInsights> => ({ ok: true, dati: datiFinti(1400) }),
    )
    const loc = { latitude: 43.77, longitude: 11.25 }

    await buildingInsightsConCache(loc, { archivio, cerca })
    await buildingInsightsConCache(loc, { archivio, cerca })

    expect(cerca).toHaveBeenCalledTimes(1)
  })
})
