import { and, asc, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { leadSources, users } from '@/db/schema'

/** Fonti attive, per le tendine di selezione. */
export async function getLeadSources() {
  return getDb()
    .select({ id: leadSources.id, code: leadSources.code, label: leadSources.label })
    .from(leadSources)
    .where(eq(leadSources.isActive, true))
    .orderBy(asc(leadSources.sortOrder))
}

/**
 * Commerciali attivi: sono gli unici a cui si assegna un lead.
 * Contabilità e cantiere non gestiscono la presa in carico commerciale.
 */
export async function getCommercialiAttivi() {
  const righe = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        eq(users.isFieldOnly, false),
        eq(users.role, 'commerciale'),
      ),
    )
    .orderBy(asc(users.name), asc(users.email))

  return righe.map((r) => ({
    id: r.id,
    etichetta: r.name ?? r.email,
  }))
}
