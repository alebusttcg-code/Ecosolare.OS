'use server'

import { and, desc, eq, like, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { activities, opportunities, opportunityStatusHistory } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import { planStageChange } from '@/lib/domain/pipeline'
import { getStages } from '@/lib/queries/pipeline'
import { CHIAVI, getSetting } from '@/lib/settings'

const STATO_INIZIALE = 'nuovo'

/**
 * Numerazione leggibile delle opportunita': OPP-2026-0001.
 *
 * La sequenza deriva dal massimo esistente dell'anno. In teoria due creazioni
 * simultanee possono collidere; in pratica l'indice univoco su `code` lo
 * impedisce e il chiamante ritenta. Ai volumi previsti (§3 A3) la collisione e'
 * un evento raro, e questa soluzione evita di introdurre una sequenza dedicata
 * per ogni prefisso. Se la numerazione dovra' allinearsi al gestionale contabile
 * (D-004), questo e' il punto da cambiare.
 */
async function prossimoCodice(anno: number): Promise<string> {
  const prefisso = `OPP-${anno}-`
  const [ultima] = await getDb()
    .select({ code: opportunities.code })
    .from(opportunities)
    .where(like(opportunities.code, `${prefisso}%`))
    .orderBy(desc(opportunities.code))
    .limit(1)

  const progressivo = ultima ? Number.parseInt(ultima.code.slice(prefisso.length), 10) + 1 : 1
  return `${prefisso}${String(progressivo).padStart(4, '0')}`
}

const opportunitySchema = z.object({
  contactId: z.uuid('Selezionare un cliente'),
  siteId: z.uuid().optional(),
  businessLine: z.enum(['fotovoltaico', 'elettrico', 'idraulico']),
  title: z.string().trim().min(1, 'Indicare una descrizione').max(160),
  estimatedValue: z.number().nonnegative().optional(),
  sourceId: z.uuid().optional(),
  ownerId: z.uuid().optional(),
  /** Scadenza della prima azione. Se assente si usa il default configurato. */
  nextActionDueAt: z.date().optional(),
  nextActionSubject: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
})

export type OpportunityInput = z.input<typeof opportunitySchema>

export type ActionResult<T = undefined> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly errors: Record<string, string> }

function errori(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) out[issue.path.join('.') || '_'] ??= issue.message
  return out
}

/**
 * Crea un'opportunita' con la sua prima azione.
 *
 * Opportunita' e prossima azione nascono nella STESSA transazione: e' l'unico
 * modo per garantire l'invariante "nessuna opportunita' aperta senza prossima
 * azione" anche in caso di errore a meta' strada.
 */
export async function createOpportunity(
  input: OpportunityInput,
): Promise<ActionResult<{ id: string; code: string }>> {
  const utente = await guard('create', 'opportunity')

  const parsed = opportunitySchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const giorniDefault = await getSetting(CHIAVI.giorniDefaultProssimaAzione, 2)
  const scadenza =
    dati.nextActionDueAt ?? new Date(Date.now() + giorniDefault * 86_400_000)

  const stages = await getStages()
  const iniziale = stages.find((s) => s.code === STATO_INIZIALE)
  if (!iniziale) {
    return {
      ok: false,
      errors: { _: 'Stati della pipeline non configurati. Eseguire il seed.' },
    }
  }

  const db = getDb()
  const creata = await db.transaction(async (tx) => {
    const code = await prossimoCodice(new Date().getFullYear())

    const [opp] = await tx
      .insert(opportunities)
      .values({
        code,
        contactId: dati.contactId,
        siteId: dati.siteId ?? null,
        businessLine: dati.businessLine,
        title: dati.title,
        stage: STATO_INIZIALE,
        ownerId: dati.ownerId ?? utente.id,
        sourceId: dati.sourceId ?? null,
        estimatedValue: dati.estimatedValue?.toFixed(2) ?? null,
        probability: iniziale.defaultProbability,
        nextActionDueAt: scadenza,
        notes: dati.notes ?? null,
        createdBy: utente.id,
        updatedBy: utente.id,
      })
      .returning({ id: opportunities.id, code: opportunities.code })

    if (!opp) throw new Error('Inserimento opportunita non riuscito')

    await tx.insert(activities).values({
      kind: 'chiamata',
      subject: dati.nextActionSubject?.trim() || 'Primo contatto',
      opportunityId: opp.id,
      contactId: dati.contactId,
      assignedTo: dati.ownerId ?? utente.id,
      dueAt: scadenza,
      isNextAction: true,
      createdBy: utente.id,
    })

    await tx.insert(opportunityStatusHistory).values({
      opportunityId: opp.id,
      fromStage: null,
      toStage: STATO_INIZIALE,
      changedBy: utente.id,
    })

    return opp
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'opportunity',
    entityId: creata.id,
  })

  revalidatePath('/opportunita')
  return { ok: true, data: creata }
}

const stageChangeSchema = z.object({
  opportunityId: z.uuid(),
  toStage: z.string().trim().min(1),
  nextActionDueAt: z.date().optional(),
  lostReason: z.string().trim().max(400).optional(),
  note: z.string().trim().max(400).optional(),
})

/** Cambia lo stato di un'opportunita', applicando gli invarianti di pipeline. */
export async function changeStage(
  input: z.input<typeof stageChangeSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'opportunity')

  const parsed = stageChangeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()
  const corrente = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, dati.opportunityId),
  })
  if (!corrente) return { ok: false, errors: { _: 'Opportunita non trovata.' } }

  const stages = await getStages()
  const esito = planStageChange(
    {
      current: {
        stage: corrente.stage,
        stageSince: corrente.stageSince,
        probability: corrente.probability,
        nextActionDueAt: corrente.nextActionDueAt,
        lostReason: corrente.lostReason,
        closedAt: corrente.closedAt,
      },
      toStage: dati.toStage,
      nextActionDueAt: dati.nextActionDueAt ?? null,
      lostReason: dati.lostReason ?? null,
      note: dati.note ?? null,
      now: new Date(),
    },
    stages,
  )

  if (!esito.ok) {
    const out: Record<string, string> = {}
    for (const v of esito.violations) out[v.field] ??= v.message
    return { ok: false, errors: out }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(opportunities)
      .set({ ...esito.patch, updatedAt: new Date(), updatedBy: utente.id })
      .where(eq(opportunities.id, dati.opportunityId))

    await tx.insert(opportunityStatusHistory).values({
      opportunityId: dati.opportunityId,
      fromStage: esito.history.fromStage,
      toStage: esito.history.toStage,
      daysInPreviousStage: esito.history.daysInPreviousStage,
      note: esito.history.note,
      changedBy: utente.id,
    })

    // Chiudendo l'opportunita' le attivita' aperte non hanno piu' ragione di
    // comparire fra le cose da fare di qualcuno.
    if (esito.patch.closedAt) {
      await tx
        .update(activities)
        .set({ isNextAction: false })
        .where(
          and(
            eq(activities.opportunityId, dati.opportunityId),
            eq(activities.isNextAction, true),
            sql`${activities.completedAt} is null`,
          ),
        )
    }
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'opportunity',
    entityId: dati.opportunityId,
    before: {
      stage: corrente.stage,
      probability: corrente.probability,
      lostReason: corrente.lostReason,
      closedAt: corrente.closedAt,
    },
    after: {
      stage: esito.patch.stage,
      probability: esito.patch.probability,
      lostReason: esito.patch.lostReason,
      closedAt: esito.patch.closedAt,
    },
  })

  revalidatePath('/opportunita')
  revalidatePath(`/opportunita/${dati.opportunityId}`)
  return { ok: true, data: undefined }
}
