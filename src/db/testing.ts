import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from './schema'

/**
 * Database effimero per i test automatici.
 *
 * PGlite e' PostgreSQL compilato in WebAssembly ed eseguito nel processo di test:
 * niente Docker, niente servizio da avviare, ogni test parte da un database
 * vuoto. Soprattutto, applica le MIGRAZIONI REALI invece di ricostruire lo schema
 * a parte — cosi' un errore in una migrazione lo scopre la CI, non la produzione.
 *
 * Non e' il database di sviluppo: quello resta PostgreSQL gestito, perche'
 * l'ambiente locale deve somigliare alla produzione (vedere src/db/index.ts).
 */
export async function createTestDatabase() {
  const pglite = new PGlite()
  const db = drizzle(pglite, { schema })

  await migrate(db, { migrationsFolder: './drizzle' })

  return {
    db,
    async close(): Promise<void> {
      await pglite.close()
    },
  }
}

export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>['db']
