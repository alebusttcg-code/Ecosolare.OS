import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { contacts, leadSources, users } from '@/db/schema'

/** Fonti attive, per le tendine di selezione. */
export async function getLeadSources() {
  return getDb()
    .select({ id: leadSources.id, code: leadSources.code, label: leadSources.label })
    .from(leadSources)
    .where(eq(leadSources.isActive, true))
    .orderBy(asc(leadSources.sortOrder))
}

/**
 * Contatti per la selezione in fase di creazione opportunita'.
 *
 * Limite volutamente basso: quando l'anagrafica cresce, una tendina non e' piu'
 * lo strumento giusto e va sostituita da una ricerca. Meglio saperlo per tempo
 * che scoprirlo con una pagina che carica duemila righe.
 */
export async function getContattiRecenti(limite = 200) {
  const righe = await getDb()
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      phone: contacts.phone,
    })
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .orderBy(desc(contacts.createdAt))
    .limit(limite)

  return righe.map((r) => ({
    id: r.id,
    etichetta: [r.firstName, r.lastName].filter(Boolean).join(' '),
    telefono: r.phone,
  }))
}

/** Utenti attivi, per l'assegnazione di responsabilita'. */
export async function getUtentiAttivi() {
  const righe = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.isActive, true), eq(users.isFieldOnly, false)))
    .orderBy(asc(users.email))

  return righe.map((r) => ({
    id: r.id,
    etichetta: r.name ?? r.email,
    ruolo: r.role,
  }))
}
