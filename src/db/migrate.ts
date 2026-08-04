import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Applica le migrazioni versionate presenti in ./drizzle.
 *
 * Nessuna modifica strutturale al database viene applicata a mano (ADR-009):
 * questo script e' l'unica via, in locale come in staging e produzione.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL non impostata. Vedere .env.example.')
    process.exit(1)
  }

  // Una sola connessione, che si chiude a fine migrazione: il pool qui non serve
  // e lascerebbe il processo appeso.
  const sql = postgres(url, { max: 1 })

  try {
    console.log('Applicazione delle migrazioni...')
    await migrate(drizzle(sql), { migrationsFolder: './drizzle' })
    console.log('Migrazioni applicate.')
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error('Migrazione fallita:', error)
  process.exit(1)
})
