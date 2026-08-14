/**
 * Adattatore su PostgreSQL della cache buildingInsights (ADR-016, tappa 4b).
 *
 * Tenuto fuori dal wrapper puro: chi importa `building-insights-cache.ts` non si
 * trascina dietro il database. Traduce fra la tabella `building_insights_cache`
 * e l'interfaccia `ArchivioBuildingInsights`.
 */

import { eq } from 'drizzle-orm'
import { getDb, type Esecutore } from '@/db'
import { buildingInsightsCache } from '@/db/schema'
import type {
  ArchivioBuildingInsights,
  DatiTetto,
} from './building-insights-cache'

export function archivioBuildingInsightsDb(
  db: Esecutore = getDb(),
): ArchivioBuildingInsights {
  return {
    async leggi(chiave) {
      const righe = await db
        .select({ payload: buildingInsightsCache.payload })
        .from(buildingInsightsCache)
        .where(eq(buildingInsightsCache.coordKey, chiave))
        .limit(1)
      const riga = righe[0]
      return riga ? (riga.payload as DatiTetto) : null
    },

    async scrivi(chiave, dati) {
      await db
        .insert(buildingInsightsCache)
        .values({
          coordKey: chiave,
          lat: String(dati.location.latitude),
          lng: String(dati.location.longitude),
          payload: dati,
        })
        .onConflictDoUpdate({
          target: buildingInsightsCache.coordKey,
          set: { payload: dati, fetchedAt: new Date() },
        })
    },
  }
}
