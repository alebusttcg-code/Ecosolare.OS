import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/env'
import * as schema from './schema'

/**
 * Connessione al database.
 *
 * Sviluppo, staging e produzione usano lo stesso PostgreSQL gestito: l'ambiente
 * locale deve somigliare alla produzione, non a un surrogato. I test automatici
 * usano invece PGlite (Postgres in-process) — vedere `src/db/testing.ts`.
 *
 * L'inizializzazione e' pigra di proposito: leggere le variabili d'ambiente
 * al caricamento del modulo farebbe fallire `next build` in una macchina di
 * build che, giustamente, non ha le credenziali di produzione.
 */

declare global {
  // In sviluppo Next ricarica i moduli a ogni modifica: senza questa cache
  // si aprirebbe una connessione nuova a ogni salvataggio, fino a esaurire il pool.
  var __ecosolareDb: ReturnType<typeof buildDb> | undefined
}

function buildDb() {
  const sql = postgres(env().DATABASE_URL, { max: 10 })
  return drizzle(sql, { schema })
}

export function getDb(): ReturnType<typeof buildDb> {
  if (!globalThis.__ecosolareDb) {
    globalThis.__ecosolareDb = buildDb()
  }
  return globalThis.__ecosolareDb
}

export type Database = ReturnType<typeof getDb>
export { schema }
