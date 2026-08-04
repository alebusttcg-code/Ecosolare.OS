import { and, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { activities, contacts, opportunities, sites } from '@/db/schema'
import { normalizePhone } from '@/lib/domain/phone'

export interface ContattoInElenco {
  readonly id: string
  readonly firstName: string | null
  readonly lastName: string
  readonly email: string | null
  readonly phone: string | null
  readonly opportunitaAperte: number
  readonly createdAt: Date
}

/**
 * Ricerca su nome, email, telefono.
 *
 * Il telefono viene normalizzato prima di cercare: chi digita "333 123 4567"
 * deve trovare il contatto salvato come "+393331234567" (US-02.1).
 */
export async function searchContacts(
  termine: string,
  pagina = 1,
  perPagina = 25,
): Promise<{ righe: ContattoInElenco[]; totale: number }> {
  const db = getDb()
  const q = termine.trim()

  const filtri = [isNull(contacts.deletedAt)]

  if (q !== '') {
    const comeTelefono = normalizePhone(q).e164
    const testo = `%${q}%`
    const alternative = [
      ilike(contacts.lastName, testo),
      ilike(contacts.firstName, testo),
      ilike(contacts.emailNormalized, `%${q.toLowerCase()}%`),
      ilike(contacts.phone, testo),
    ]
    if (comeTelefono) alternative.push(eq(contacts.phoneE164, comeTelefono))
    filtri.push(or(...alternative)!)
  }

  const dove = and(...filtri)

  const [totaleRiga] = await db.select({ totale: count() }).from(contacts).where(dove)

  const righe = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phone,
      createdAt: contacts.createdAt,
      opportunitaAperte: sql<number>`(
        select count(*)::int from ${opportunities}
        where ${opportunities.contactId} = ${contacts.id}
          and ${opportunities.closedAt} is null
          and ${opportunities.deletedAt} is null
      )`,
    })
    .from(contacts)
    .where(dove)
    // Paginazione lato server: l'elenco non cresce nel browser (§12 del blueprint).
    .orderBy(desc(contacts.createdAt))
    .limit(perPagina)
    .offset((pagina - 1) * perPagina)

  return { righe, totale: totaleRiga?.totale ?? 0 }
}

export async function getContactDetail(id: string) {
  const db = getDb()

  const contatto = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, id), isNull(contacts.deletedAt)),
  })
  if (!contatto) return null

  const [suoiSiti, sueOpportunita, sueAttivita] = await Promise.all([
    db.select().from(sites).where(and(eq(sites.contactId, id), isNull(sites.deletedAt))),
    db
      .select({
        id: opportunities.id,
        code: opportunities.code,
        title: opportunities.title,
        stage: opportunities.stage,
        businessLine: opportunities.businessLine,
        estimatedValue: opportunities.estimatedValue,
        nextActionDueAt: opportunities.nextActionDueAt,
        closedAt: opportunities.closedAt,
      })
      .from(opportunities)
      .where(and(eq(opportunities.contactId, id), isNull(opportunities.deletedAt)))
      .orderBy(desc(opportunities.createdAt)),
    db
      .select({
        id: activities.id,
        kind: sql<string>`${activities.kind}`,
        subject: activities.subject,
        dueAt: activities.dueAt,
        completedAt: activities.completedAt,
        outcome: activities.outcome,
      })
      .from(activities)
      .where(eq(activities.contactId, id))
      .orderBy(desc(activities.createdAt))
      .limit(50),
  ])

  return { contatto, siti: suoiSiti, opportunita: sueOpportunita, attivita: sueAttivita }
}
