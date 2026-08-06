import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './testing'

/**
 * Ogni tabella deve avere RLS attiva.
 *
 * Non è una formalità. Supabase pubblica automaticamente lo schema `public` su
 * un'API web, e la chiave anonima è pubblica per progettazione: una tabella
 * senza RLS è leggibile e scrivibile da chiunque conosca quella chiave,
 * **scavalcando il policy layer** (ADR-006).
 *
 * Questo test esiste perché il problema si è già verificato: la migrazione
 * `0004` elencava le tabelle esistenti in quel momento — una fotografia, non
 * una regola — e le diciassette tabelle aggiunte dopo sono rimaste scoperte
 * fino al primo collegamento a Supabase.
 *
 * Da ora chi aggiunge una tabella senza proteggerla rompe la build, che è il
 * momento giusto per accorgersene.
 */
describe('protezione delle tabelle', () => {
  let db: TestDatabase
  let close: () => Promise<void>

  beforeAll(async () => {
    const test = await createTestDatabase()
    db = test.db
    close = test.close
  })

  afterAll(async () => {
    await close()
  })

  it('attiva RLS su ogni tabella dello schema public', async () => {
    const risultato = await db.execute<{ nome: string; rls: boolean }>(sql`
      select c.relname as nome, c.relrowsecurity as rls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `)

    const scoperte = risultato.rows.filter((r) => !r.rls).map((r) => r.nome)

    // Il messaggio elenca i nomi: chi rompe il test deve sapere subito cosa
    // aggiungere alla migrazione, senza andarlo a cercare.
    expect(
      scoperte,
      `Tabelle senza RLS: ${scoperte.join(', ')}.\n` +
        'Aggiungi «ALTER TABLE "nome" ENABLE ROW LEVEL SECURITY;» in una nuova migrazione.',
    ).toEqual([])
  })

  it('protegge un numero di tabelle coerente con lo schema', async () => {
    const risultato = await db.execute<{ n: number }>(sql`
      select count(*)::int as n
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    `)

    // Se questo numero cala all'improvviso vuol dire che una migrazione ha
    // cancellato tabelle senza che nessuno se ne accorgesse.
    expect(risultato.rows[0]!.n).toBeGreaterThanOrEqual(39)
  })
})
