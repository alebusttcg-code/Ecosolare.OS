/**
 * Adattatore su PostgreSQL dell'archivio climatologia (ADR-016, tappa 4).
 *
 * È l'unico pezzo del sotto-sistema clima che tocca il database, ed è tenuto
 * fuori da `index.ts` di proposito: chi importa l'orchestratore, la riduzione o
 * il client PVGIS resta puro e non si trascina dietro la connessione. Qui vive
 * solo la traduzione fra la cache `climate_cache` e l'interfaccia
 * `ArchivioClimatologia`.
 */

import { eq } from 'drizzle-orm'
import { getDb, type Esecutore } from '@/db'
import { climateCache } from '@/db/schema'
import type { Climatologia } from './climatologia'
import type { ArchivioClimatologia } from './index'

/**
 * Archivio climatologia su tabella `climate_cache`.
 *
 * `db` è iniettabile per i test (PostgreSQL vero via PGlite); in esercizio usa
 * la connessione condivisa. La scrittura è idempotente: rileggere lo stesso
 * sito non moltiplica le righe, aggiorna quella che c'è.
 */
export function archivioClimatologiaDb(
  db: Esecutore = getDb(),
): ArchivioClimatologia {
  return {
    async leggi(chiave) {
      const righe = await db
        .select({ payload: climateCache.payload })
        .from(climateCache)
        .where(eq(climateCache.gridKey, chiave))
        .limit(1)
      const riga = righe[0]
      return riga ? (riga.payload as Climatologia) : null
    },

    async scrivi(chiave, climatologia) {
      const valori = {
        gridKey: chiave,
        lat: String(climatologia.lat),
        lng: String(climatologia.lng),
        source: climatologia.fonte,
        payload: climatologia,
      }
      await db
        .insert(climateCache)
        .values(valori)
        .onConflictDoUpdate({
          target: climateCache.gridKey,
          set: {
            source: climatologia.fonte,
            payload: climatologia,
            fetchedAt: new Date(),
          },
        })
    },
  }
}
