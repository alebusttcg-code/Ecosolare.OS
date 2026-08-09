import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { activities, contacts, opportunities, users } from '@/db/schema'
import type { Role } from '@/lib/auth/policy'
import { etichettaFase } from '@/lib/domain/follow-up'

export interface FollowUpInElenco {
  readonly id: string
  readonly subject: string
  readonly phase: string
  readonly phaseLabel: string
  readonly step: number
  readonly dueAt: Date | null
  readonly scaduta: boolean
  readonly isNextAction: boolean
  readonly opportunityId: string
  readonly opportunityCode: string
  readonly clienteNome: string
  readonly commerciale: string
}

/**
 * Follow-up aperti. Il commerciale vede i propri; amministratore tutti.
 */
export async function listFollowUpAperti(utente: {
  readonly id: string
  readonly role: Role
}): Promise<readonly FollowUpInElenco[]> {
  const db = getDb()
  const adesso = Date.now()

  const condizioni = [
    isNotNull(activities.followUpPhase),
    isNull(activities.completedAt),
    isNull(opportunities.deletedAt),
    isNull(opportunities.closedAt),
  ]
  if (utente.role === 'commerciale') {
    condizioni.push(eq(activities.assignedTo, utente.id))
  }

  const righe = await db
    .select({
      id: activities.id,
      subject: activities.subject,
      phase: activities.followUpPhase,
      step: activities.followUpStep,
      dueAt: activities.dueAt,
      isNextAction: activities.isNextAction,
      opportunityId: opportunities.id,
      opportunityCode: opportunities.code,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
      commercialeNome: users.name,
      commercialeEmail: users.email,
    })
    .from(activities)
    .innerJoin(opportunities, eq(opportunities.id, activities.opportunityId))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .innerJoin(users, eq(users.id, activities.assignedTo))
    .where(and(...condizioni))
    .orderBy(asc(activities.dueAt), asc(activities.followUpStep))

  return righe.map((r) => ({
    id: r.id,
    subject: r.subject,
    phase: r.phase!,
    phaseLabel: etichettaFase(r.phase!),
    step: r.step!,
    dueAt: r.dueAt,
    scaduta: r.dueAt !== null && r.dueAt.getTime() < adesso,
    isNextAction: r.isNextAction,
    opportunityId: r.opportunityId,
    opportunityCode: r.opportunityCode,
    clienteNome: [r.clienteNome, r.clienteCognome].filter(Boolean).join(' '),
    commerciale: r.commercialeNome ?? r.commercialeEmail,
  }))
}

export async function listFollowUpLead(
  opportunityId: string,
): Promise<
  readonly {
    readonly id: string
    readonly subject: string
    readonly phase: string
    readonly phaseLabel: string
    readonly step: number
    readonly dueAt: Date | null
    readonly completedAt: Date | null
    readonly outcome: string | null
    readonly notes: string | null
    readonly isNextAction: boolean
  }[]
> {
  const righe = await getDb()
    .select({
      id: activities.id,
      subject: activities.subject,
      phase: activities.followUpPhase,
      step: activities.followUpStep,
      dueAt: activities.dueAt,
      completedAt: activities.completedAt,
      outcome: activities.outcome,
      notes: activities.notes,
      isNextAction: activities.isNextAction,
    })
    .from(activities)
    .where(
      and(
        eq(activities.opportunityId, opportunityId),
        isNotNull(activities.followUpPhase),
      ),
    )
    .orderBy(asc(activities.followUpPhase), asc(activities.followUpStep))

  return righe.map((r) => ({
    id: r.id,
    subject: r.subject,
    phase: r.phase!,
    phaseLabel: etichettaFase(r.phase!),
    step: r.step!,
    dueAt: r.dueAt,
    completedAt: r.completedAt,
    outcome: r.outcome,
    notes: r.notes,
    isNextAction: r.isNextAction,
  }))
}

/** True se esiste almeno un FU aperto oltre a `activityId` sulla stessa opportunità. */
export async function haFollowUpSuccessivo(
  opportunityId: string,
  activityId: string,
): Promise<boolean> {
  const aperti = await getDb()
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.opportunityId, opportunityId),
        isNotNull(activities.followUpPhase),
        isNull(activities.completedAt),
      ),
    )
  return aperti.some((r) => r.id !== activityId)
}
