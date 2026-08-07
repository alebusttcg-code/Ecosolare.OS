import { and, desc, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { contacts, opportunities, pipelineStages, sites, users } from '@/db/schema'
import { scomponiIndirizzo, type IndirizzoIniziale } from '@/lib/geo/tipi-via'

export interface LeadInElenco {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly businessLine: string
  readonly stageLabel: string
  readonly nextActionDueAt: Date | null
  /** Calcolata qui e non nel componente: il render non deve leggere l'orologio. */
  readonly inRitardo: boolean
  readonly createdAt: Date
  readonly notes: string
  readonly proprietario: string | null

  readonly firstName: string
  readonly lastName: string
  readonly phone: string
  /** Formato E.164, per i collegamenti `tel:` e WhatsApp. */
  readonly phoneE164: string | null
  readonly email: string
  readonly indirizzo: IndirizzoIniziale
}

/**
 * Lead aperti per l'elenco operativo: anagrafica in prima vista, il resto
 * per il popup di dettaglio. La modifica carica i propri dati dalla pagina
 * dedicata: qui viaggia solo ciò che l'elenco mostra davvero.
 */
export async function listOpportunities(): Promise<LeadInElenco[]> {
  const adesso = Date.now()

  const righe = await getDb()
    .select({
      id: opportunities.id,
      code: opportunities.code,
      title: opportunities.title,
      businessLine: opportunities.businessLine,
      stageLabel: pipelineStages.label,
      nextActionDueAt: opportunities.nextActionDueAt,
      createdAt: opportunities.createdAt,
      notes: opportunities.notes,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      phone: contacts.phone,
      phoneE164: contacts.phoneE164,
      email: contacts.email,
      addressLine: sites.addressLine,
      city: sites.city,
      province: sites.province,
      postalCode: sites.postalCode,
      proprietario: users.name,
      proprietarioEmail: users.email,
    })
    .from(opportunities)
    .innerJoin(pipelineStages, eq(pipelineStages.code, opportunities.stage))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .leftJoin(sites, eq(sites.id, opportunities.siteId))
    .leftJoin(users, eq(users.id, opportunities.ownerId))
    .where(
      and(
        isNull(opportunities.deletedAt),
        isNull(contacts.deletedAt),
        eq(pipelineStages.isOpen, true),
      ),
    )
    .orderBy(desc(opportunities.createdAt))

  return righe.map((r) => {
    const pezzi = scomponiIndirizzo(r.addressLine)
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      businessLine: r.businessLine,
      stageLabel: r.stageLabel,
      nextActionDueAt: r.nextActionDueAt,
      inRitardo: r.nextActionDueAt !== null && r.nextActionDueAt.getTime() < adesso,
      createdAt: r.createdAt,
      notes: r.notes ?? '',
      proprietario: r.proprietario ?? r.proprietarioEmail,
      firstName: r.firstName ?? '',
      lastName: r.lastName,
      phone: r.phone ?? '',
      phoneE164: r.phoneE164,
      email: r.email ?? '',
      indirizzo: {
        streetType: pezzi.tipoVia,
        streetName: pezzi.nomeVia,
        houseNumber: pezzi.civico,
        province: r.province ?? undefined,
        city: r.city ?? undefined,
        postalCode: r.postalCode ?? undefined,
      },
    }
  })
}
