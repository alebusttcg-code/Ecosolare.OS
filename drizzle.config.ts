import type { Config } from 'drizzle-kit'

/**
 * Le migrazioni sono file SQL versionati in repository (ADR-009).
 * Nessuna modifica strutturale al database viene applicata a mano.
 */
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/ecosolare',
  },
  strict: true,
  verbose: true,
} satisfies Config
