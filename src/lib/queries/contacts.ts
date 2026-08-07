import { and, count, desc, eq, ilike, isNull, min, or, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  activities,
  contacts,
  contracts,
  opportunities,
  projectStages,
  projects,
  sites,
} from '@/db/schema'
import { normalizePhone } from '@/lib/domain/phone'

export interface ContattoInElenco {
  readonly id: string
  readonly firstName: string | null
  readonly lastName: string
  readonly email: string | null
  readonly phone: string | null
  /** Prima firma: da quel giorno è un cliente, non più solo un lead. */
  readonly clienteDal: Date
  readonly commesse: number
}

/**
 * Elenco clienti = contatti con almeno un contratto firmato.
 *
 * L'anagrafica nasce col lead; diventa «cliente» solo alla firma del preventivo
 * (accettazione + firma → contratto). Prima di quel momento resta in Lead.
 */
export async function searchContacts(
  termine: string,
  pagina = 1,
  perPagina = 25,
): Promise<{ righe: ContattoInElenco[]; totale: number }> {
  const db = getDb()
  const q = termine.trim()

  /**
   * Prima firma del contatto. I contratti non si cancellano (immutabilità
   * economica, ADR-008), ma il lead che li ha generati può essere stato
   * archiviato: quelli soft-deleted non concorrono.
   */
  const primaFirma = sql`(
    select min(${contracts.signedAt})
    from ${contracts}
    inner join ${opportunities}
      on ${opportunities.id} = ${contracts.opportunityId}
    where ${opportunities.contactId} = ${contacts.id}
      and ${opportunities.deletedAt} is null
  )`

  const filtri = [isNull(contacts.deletedAt), sql`${primaFirma} is not null`]

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
      clienteDal: sql<Date>`${primaFirma}`,
      commesse: sql<number>`(
        select count(*)::int from ${projects}
        where ${projects.contactId} = ${contacts.id}
          and ${projects.deletedAt} is null
      )`,
    })
    .from(contacts)
    .where(dove)
    // Paginazione lato server: l'elenco non cresce nel browser (§12 del blueprint).
    .orderBy(desc(sql`${primaFirma}`))
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

  const [suoiSiti, sueOpportunita, sueAttivita, clienteDalRiga, sueCommesse] =
    await Promise.all([
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
      db
        .select({ clienteDal: min(contracts.signedAt) })
        .from(contracts)
        .innerJoin(opportunities, eq(opportunities.id, contracts.opportunityId))
        .where(and(eq(opportunities.contactId, id), isNull(opportunities.deletedAt))),
      db
        .select({
          id: projects.id,
          code: projects.code,
          title: projects.title,
          stage: projects.stage,
          stageLabel: projectStages.label,
        })
        .from(projects)
        .innerJoin(projectStages, eq(projectStages.code, projects.stage))
        .where(and(eq(projects.contactId, id), isNull(projects.deletedAt)))
        .orderBy(desc(projects.createdAt)),
    ])

  const clienteDal = clienteDalRiga[0]?.clienteDal ?? null

  return {
    contatto,
    siti: suoiSiti,
    opportunita: sueOpportunita,
    attivita: sueAttivita,
    clienteDal,
    commesse: sueCommesse,
    /** True solo dopo almeno una firma di preventivo. */
    eCliente: clienteDal !== null,
  }
}
