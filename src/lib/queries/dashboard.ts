import { and, count, eq, isNotNull, isNull, lt, or, sql, sum } from 'drizzle-orm'
import { getDb } from '@/db'
import { activities, contacts, opportunities, pipelineStages } from '@/db/schema'

export interface DashboardDati {
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
export async function getDashboard(): Promise<DashboardDati> {
  const db = getDb()
  const adesso = new Date()

  /**
   * Stessi criteri dell'elenco Lead: aperta, non archiviata e con contatto
   * vivo. Se i numeri del cruscotto e la lista divergessero, il cruscotto
   * mentirebbe — e un contatore che mente è peggio di nessun contatore.
   */
  const contattoVivo = sql`exists (
    select 1 from ${contacts}
    where ${contacts.id} = opportunities.contact_id
      and ${contacts.deletedAt} is null
  )`

  const apertaEViva = and(
    eq(pipelineStages.isOpen, true),
    isNull(opportunities.deletedAt),
    contattoVivo,
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
      attivo: pipelineStages.isActive,
    })
    .from(pipelineStages)
    .leftJoin(
      opportunities,
      and(
        eq(opportunities.stage, pipelineStages.code),
        isNull(opportunities.deletedAt),
        contattoVivo,
      ),
    )
    .where(eq(pipelineStages.isOpen, true))
    .groupBy(
      pipelineStages.code,
      pipelineStages.label,
      pipelineStages.sortOrder,
      pipelineStages.isActive,
    )
    .orderBy(pipelineStages.sortOrder)

  return {
    aperte: aggregato?.totale ?? 0,
    valoreAperto: aggregato?.valore ?? null,
    senzaProssimaAzione: senzaAzione?.totale ?? 0,
    inRitardo: inRitardo?.totale ?? 0,
    senzaPrimaRisposta: senzaPrimaRisposta?.totale ?? 0,
    perStato: perStato
      // Uno stato disattivato sparisce dal grafico solo se è davvero vuoto:
      // se ha ancora lead sopra, nasconderlo falserebbe il totale.
      .filter((r) => r.attivo || r.totale > 0)
      .map((r) => ({ code: r.code, label: r.label, totale: r.totale })),
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
  readonly clienteNome: string | null
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
      contattoNome: contacts.firstName,
      contattoCognome: contacts.lastName,
    })
    .from(activities)
    .leftJoin(opportunities, eq(opportunities.id, activities.opportunityId))
    .leftJoin(contacts, eq(contacts.id, opportunities.contactId))
    .where(
      and(
        eq(activities.assignedTo, userId),
        isNull(activities.completedAt),
        // Un'attività legata a un lead archiviato non è più «da fare».
        or(isNull(activities.opportunityId), isNull(opportunities.deletedAt)),
      ),
    )
    .orderBy(sql`${activities.dueAt} asc nulls last`)
    .limit(limite)

  return righe.map((r) => {
    const { contattoNome, contattoCognome, ...resto } = r
    return {
      ...resto,
      clienteNome: [contattoNome, contattoCognome].filter(Boolean).join(' ') || null,
      scaduta: r.dueAt !== null && r.dueAt.getTime() < adesso,
    }
  })
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
