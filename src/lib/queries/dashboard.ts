import { and, count, eq, isNotNull, isNull, lt, sql, sum } from 'drizzle-orm'
import { getDb } from '@/db'
import { activities, opportunities, pipelineStages } from '@/db/schema'

export interface CruscottoDati {
  readonly aperte: number
  readonly valoreAperto: string | null
  readonly senzaProssimaAzione: number
  readonly inRitardo: number
  readonly perStato: readonly { code: string; label: string; totale: number }[]
  readonly senzaPrimaRisposta: number
}

/**
 * Numeri del cruscotto direzionale essenziale (§16 punto 12).
 *
 * `senzaProssimaAzione` merita attenzione: secondo il criterio di accettazione 4
 * deve valere SEMPRE ZERO. Non e' un indicatore da monitorare, e' una spia:
 * se si accende, c'e' un difetto nel sistema, non un arretrato da smaltire.
 */
export async function getCruscotto(): Promise<CruscottoDati> {
  const db = getDb()
  const adesso = new Date()

  const apertaEViva = and(
    eq(pipelineStages.isOpen, true),
    isNull(opportunities.deletedAt),
  )

  const [aggregato] = await db
    .select({
      totale: count(),
      valore: sum(opportunities.estimatedValue),
    })
    .from(opportunities)
    .innerJoin(pipelineStages, eq(pipelineStages.code, opportunities.stage))
    .where(apertaEViva)

  const [senzaAzione] = await db
    .select({ totale: count() })
    .from(opportunities)
    .innerJoin(pipelineStages, eq(pipelineStages.code, opportunities.stage))
    .where(and(apertaEViva, isNull(opportunities.nextActionDueAt)))

  const [inRitardo] = await db
    .select({ totale: count() })
    .from(opportunities)
    .innerJoin(pipelineStages, eq(pipelineStages.code, opportunities.stage))
    .where(and(apertaEViva, lt(opportunities.nextActionDueAt, adesso)))

  const [senzaPrimaRisposta] = await db
    .select({ totale: count() })
    .from(opportunities)
    .innerJoin(pipelineStages, eq(pipelineStages.code, opportunities.stage))
    .where(and(apertaEViva, isNull(opportunities.firstResponseAt)))

  const perStato = await db
    .select({
      code: pipelineStages.code,
      label: pipelineStages.label,
      totale: count(opportunities.id),
      ordine: pipelineStages.sortOrder,
    })
    .from(pipelineStages)
    .leftJoin(
      opportunities,
      and(eq(opportunities.stage, pipelineStages.code), isNull(opportunities.deletedAt)),
    )
    .where(and(eq(pipelineStages.isOpen, true), eq(pipelineStages.isActive, true)))
    .groupBy(pipelineStages.code, pipelineStages.label, pipelineStages.sortOrder)
    .orderBy(pipelineStages.sortOrder)

  return {
    aperte: aggregato?.totale ?? 0,
    valoreAperto: aggregato?.valore ?? null,
    senzaProssimaAzione: senzaAzione?.totale ?? 0,
    inRitardo: inRitardo?.totale ?? 0,
    senzaPrimaRisposta: senzaPrimaRisposta?.totale ?? 0,
    perStato: perStato.map((r) => ({ code: r.code, label: r.label, totale: r.totale })),
  }
}

export interface AttivitaInElenco {
  readonly id: string
  readonly subject: string
  readonly kind: string
  readonly dueAt: Date | null
  readonly scaduta: boolean
  readonly isNextAction: boolean
  readonly opportunityId: string | null
  readonly opportunityCode: string | null
  readonly opportunityTitle: string | null
}

/**
 * Le attivita' aperte assegnate a una persona, le piu' urgenti per prime.
 *
 * `scaduta` viene calcolata qui e non nel componente: leggere l'orologio
 * durante il render produce risultati che cambiano a ogni ri-render.
 */
export async function getAttivitaAperte(
  userId: string,
  limite = 50,
): Promise<AttivitaInElenco[]> {
  const adesso = Date.now()

  const righe = await getDb()
    .select({
      id: activities.id,
      subject: activities.subject,
      kind: sql<string>`${activities.kind}`,
      dueAt: activities.dueAt,
      isNextAction: activities.isNextAction,
      opportunityId: activities.opportunityId,
      opportunityCode: opportunities.code,
      opportunityTitle: opportunities.title,
    })
    .from(activities)
    .leftJoin(opportunities, eq(opportunities.id, activities.opportunityId))
    .where(and(eq(activities.assignedTo, userId), isNull(activities.completedAt)))
    .orderBy(sql`${activities.dueAt} asc nulls last`)
    .limit(limite)

  return righe.map((r) => ({
    ...r,
    scaduta: r.dueAt !== null && r.dueAt.getTime() < adesso,
  }))
}

/** Quante attivita' aperte ha in carico ciascuno: serve per la ripartizione. */
export async function contaAttivitaScadute(userId: string): Promise<number> {
  const [riga] = await getDb()
    .select({ totale: count() })
    .from(activities)
    .where(
      and(
        eq(activities.assignedTo, userId),
        isNull(activities.completedAt),
        isNotNull(activities.dueAt),
        lt(activities.dueAt, new Date()),
      ),
    )
  return riga?.totale ?? 0
}
