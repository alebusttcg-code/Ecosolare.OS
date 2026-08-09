import { describe, expect, it } from 'vitest'
import { isNull, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { contacts, projects } from '@/db/schema'
import { filtroCommessaAssegnata, filtroContattoAssegnato } from '@/lib/auth/scope-query'
import { unoAllaVolta } from '@/lib/uno-alla-volta'

/** Compila un frammento SQL con il dialetto postgres senza aprire una connessione. */
function compila(frammento: ReturnType<typeof sql>): string {
  // drizzle richiede un client; per toSQL basta un oggetto stub.
  const db = drizzle({} as never)
  return db
    .select({ x: frammento })
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .toSQL().sql
}

describe('subquery correlate qualificate', () => {
  it('conteggio commesse usa contacts.id letterale, non "id" ambiguo', () => {
    const testo = compila(sql`(
      select count(*)::int from ${projects}
      where ${projects.contactId} = contacts.id
        and ${projects.deletedAt} is null
    )`)
    expect(testo).toContain('contacts.id')
    expect(testo).not.toMatch(/"contact_id"\s*=\s*"id"/)
  })

  it('filtroCommessaAssegnata ancora projects.id', () => {
    const testo = compila(filtroCommessaAssegnata('user-id'))
    expect(testo).toContain('projects.id')
    expect(testo).not.toMatch(/"project_id"\s*=\s*"id"/)
  })

  it('filtroContattoAssegnato ancora contacts.id e projects.id', () => {
    const testo = compila(filtroContattoAssegnato('user-id'))
    expect(testo).toContain('contacts.id')
    expect(testo).toContain('projects.id')
  })
})

describe('unoAllaVolta', () => {
  it('esegue in ordine e restituisce tutti i risultati', async () => {
    const ordine: number[] = []
    const out = await unoAllaVolta([
      async () => {
        ordine.push(1)
        return 'a'
      },
      async () => {
        ordine.push(2)
        return 2
      },
    ])
    expect(ordine).toEqual([1, 2])
    expect(out).toEqual(['a', 2])
  })
})
