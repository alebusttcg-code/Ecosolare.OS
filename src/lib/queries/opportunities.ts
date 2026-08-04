import { and, desc, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { contacts, opportunities, pipelineStages, users } from '@/db/schema'

export interface OpportunitaInElenco {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly businessLine: string
  readonly stage: string
  readonly stageLabel: string
  readonly stageOrder: number
  readonly estimatedValue: string | null
  readonly nextActionDueAt: Date | null
  /** Calcolata qui e non nel componente: il render non deve leggere l'orologio. */
  readonly inRitardo: boolean
  readonly clienteId: string
  readonly cliente: string
  readonly proprietario: string | null
  readonly closedAt: Date | null
}

export async function listOpportunities(soloAperte = true): Promise<OpportunitaInElenco[]> {
  const adesso = Date.now()
  const filtri = [isNull(opportunities.deletedAt)]
  if (soloAperte) filtri.push(eq(pipelineStages.isOpen, true))

  const righe = await getDb()
    .select({
      id: opportunities.id,
      code: opportunities.code,
      title: opportunities.title,
      businessLine: opportunities.businessLine,
      stage: opportunities.stage,
      stageLabel: pipelineStages.label,
      stageOrder: pipelineStages.sortOrder,
      estimatedValue: opportunities.estimatedValue,
      nextActionDueAt: opportunities.nextActionDueAt,
      clienteId: contacts.id,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
      proprietario: users.name,
      proprietarioEmail: users.email,
      closedAt: opportunities.closedAt,
    })
    .from(opportunities)
    .innerJoin(pipelineStages, eq(pipelineStages.code, opportunities.stage))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .leftJoin(users, eq(users.id, opportunities.ownerId))
    .where(and(...filtri))
    .orderBy(pipelineStages.sortOrder, desc(opportunities.createdAt))

  return righe.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    businessLine: r.businessLine,
    stage: r.stage,
    stageLabel: r.stageLabel,
    stageOrder: r.stageOrder,
    estimatedValue: r.estimatedValue,
    nextActionDueAt: r.nextActionDueAt,
    inRitardo: r.nextActionDueAt !== null && r.nextActionDueAt.getTime() < adesso,
    clienteId: r.clienteId,
    cliente: [r.clienteNome, r.clienteCognome].filter(Boolean).join(' '),
    proprietario: r.proprietario ?? r.proprietarioEmail,
    closedAt: r.closedAt,
  }))
}
