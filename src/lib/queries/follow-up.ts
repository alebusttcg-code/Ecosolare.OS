import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { activities } from '@/db/schema'
import { etichettaFase } from '@/lib/domain/follow-up'

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
