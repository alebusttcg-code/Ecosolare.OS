import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './testing'
import { auditLogs, users } from './schema'

describe('migrazioni', () => {
  let db: TestDatabase
  let close: () => Promise<void>

  beforeAll(async () => {
    const testDb = await createTestDatabase()
    db = testDb.db
    close = testDb.close
  })

  afterAll(async () => {
    await close()
  })

  it('si applicano su un database vuoto e creano tutte le tabelle attese', async () => {
    const result = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    )
    const tabelle = result.rows.map((r) => r.table_name)

    expect(tabelle).toEqual(
      expect.arrayContaining([
        'accounts',
        'app_settings',
        'audit_logs',
        'sessions',
        'users',
        'verification_tokens',
      ]),
    )
  })

  it('crea i tipi enum dei ruoli con i quattro valori di D-007', async () => {
    const result = await db.execute<{ enumlabel: string }>(
      sql`select enumlabel from pg_enum e
          join pg_type t on t.oid = e.enumtypid
          where t.typname = 'user_role' order by e.enumsortorder`,
    )
    expect(result.rows.map((r) => r.enumlabel)).toEqual([
      'amministratore',
      'contabilita',
      'commerciale',
      'cantiere',
    ])
  })

  it('applica i default previsti alla creazione di un utente', async () => {
    const [utente] = await db
      .insert(users)
      .values({ email: 'prova@ecosolare.example' })
      .returning()

    expect(utente).toBeDefined()
    // Il default piu' restrittivo possibile: nessuna visibilita' sui costi.
    expect(utente?.canViewCosts).toBe(false)
    expect(utente?.isFieldOnly).toBe(false)
    expect(utente?.isActive).toBe(true)
    expect(utente?.role).toBe('commerciale')
    expect(utente?.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('impedisce due utenti con la stessa email', async () => {
    await db.insert(users).values({ email: 'doppio@ecosolare.example' })
    await expect(
      db.insert(users).values({ email: 'doppio@ecosolare.example' }),
    ).rejects.toThrow()
  })

  it('registra una riga di audit con attore non umano', async () => {
    const [riga] = await db
      .insert(auditLogs)
      .values({
        actorType: 'automation',
        actorLabel: 'sequenza-follow-up',
        action: 'create',
        entityType: 'communication',
        entityId: 'test-1',
        context: { handler: 'follow_up_seq', tentativo: 1 },
      })
      .returning()

    expect(riga?.actorType).toBe('automation')
    expect(riga?.actorId).toBeNull()
    expect(riga?.occurredAt).toBeInstanceOf(Date)
  })
})

describe('ripetibilita delle migrazioni', () => {
  it('non fallisce se applicate una seconda volta sullo stesso database', async () => {
    const { db, close } = await createTestDatabase()
    try {
      // La seconda applicazione deve essere un no-op: e' cio' che rende sicuro
      // rilanciare il deploy senza sapere se le migrazioni erano gia' passate.
      const { migrate } = await import('drizzle-orm/pglite/migrator')
      await expect(
        migrate(db, { migrationsFolder: './drizzle' }),
      ).resolves.not.toThrow()
    } finally {
      await close()
    }
  })
})
