import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'
import { getDb, type Esecutore } from '@/db'
import { activities, opportunities } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { eFollowUp, type FaseFollowUp } from '@/lib/domain/follow-up'
import { promuoviProssimoFollowUp } from '@/lib/follow-up'
import { getStages } from '@/lib/queries/pipeline'

const TIPI_DI_CONTATTO = ['chiamata', 'email', 'whatsapp'] as const

export interface ProssimaAzioneInput {
  readonly kind:
    | 'chiamata'
    | 'email'
    | 'whatsapp'
    | 'appuntamento'
    | 'sopralluogo'
    | 'task'
    | 'nota'
  readonly subject: string
  readonly dueAt: Date
}

export type EsitoCompletaAttivita =
  | { readonly ok: true; readonly opportunityId: string | null }
  | {
      readonly ok: false
      readonly errore: string
      readonly codice: 'non_trovata' | 'gia_completata' | 'serve_prossima'
    }

/**
 * Completa un'attività (CRM o Telegram). Nessun guard: il chiamante autorizza.
 */
export async function completaAttivitaCore(input: {
  readonly activityId: string
  readonly actorId: string
  readonly actorLabel: string
  readonly notes?: string | null
  readonly outcome?: string | null
  readonly prossima?: ProssimaAzioneInput
  /**
   * Se manca la prossima azione e il lead resta aperto senza altri FU,
   * crea un task di default (+2 giorni) invece di rifiutare.
   */
  readonly prossimaDiDefaultSeManca?: boolean
}): Promise<EsitoCompletaAttivita> {
  const db = getDb()
  const attivita = await db.query.activities.findFirst({
    where: eq(activities.id, input.activityId),
  })
  if (!attivita) {
    return { ok: false, errore: 'Attività non trovata.', codice: 'non_trovata' }
  }
  if (attivita.completedAt) {
    return { ok: false, errore: 'Attività già completata.', codice: 'gia_completata' }
  }

  const opportunita = attivita.opportunityId
    ? await db.query.opportunities.findFirst({
        where: eq(opportunities.id, attivita.opportunityId),
      })
    : undefined

  const stages = await getStages()
  const statoCorrente = opportunita
    ? stages.find((s) => s.code === opportunita.stage)
    : undefined
  const opportunitaAperta = statoCorrente?.isOpen ?? false

  const fuInCoda = opportunita
    ? await db
        .select({
          id: activities.id,
          followUpPhase: activities.followUpPhase,
          followUpStep: activities.followUpStep,
          dueAt: activities.dueAt,
        })
        .from(activities)
        .where(
          and(
            eq(activities.opportunityId, opportunita.id),
            isNotNull(activities.followUpPhase),
            isNull(activities.completedAt),
          ),
        )
        .orderBy(asc(activities.dueAt), asc(activities.followUpStep))
    : []

  const altriFu = fuInCoda.filter((r) => r.id !== attivita.id)
  const puoPromuovereFu = altriFu.length > 0

  let prossima = input.prossima
  if (
    attivita.isNextAction &&
    opportunitaAperta &&
    !prossima &&
    !puoPromuovereFu
  ) {
    if (input.prossimaDiDefaultSeManca) {
      prossima = {
        kind: 'task',
        subject: 'Prossimo contatto commerciale',
        dueAt: new Date(Date.now() + 2 * 86_400_000),
      }
    } else {
      return {
        ok: false,
        errore:
          "Indicare la prossima azione: un'opportunità aperta non può restare senza.",
        codice: 'serve_prossima',
      }
    }
  }

  const adesso = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(activities)
      .set({
        completedAt: adesso,
        completedBy: input.actorId,
        outcome: input.outcome ?? null,
        notes: input.notes !== undefined ? input.notes : attivita.notes,
        isNextAction: false,
        updatedAt: adesso,
      })
      .where(eq(activities.id, input.activityId))

    let nextDue: Date | null = null

    if (
      puoPromuovereFu &&
      opportunita &&
      eFollowUp(attivita) &&
      attivita.followUpPhase &&
      attivita.followUpStep != null
    ) {
      nextDue = await promuoviProssimoFollowUp(tx, {
        opportunityId: opportunita.id,
        phase: attivita.followUpPhase as FaseFollowUp,
        stepCompletato: attivita.followUpStep,
      })
    } else if (puoPromuovereFu && opportunita && altriFu[0]) {
      const primo = altriFu[0]
      await azzeraNextAction(tx, opportunita.id)
      await tx
        .update(activities)
        .set({ isNextAction: true, updatedAt: adesso })
        .where(eq(activities.id, primo.id))
      nextDue = primo.dueAt
    } else if (prossima && opportunita) {
      await tx.insert(activities).values({
        kind: prossima.kind,
        subject: prossima.subject,
        opportunityId: opportunita.id,
        contactId: opportunita.contactId,
        assignedTo: opportunita.ownerId,
        dueAt: prossima.dueAt,
        isNextAction: true,
        createdBy: input.actorId,
      })
      nextDue = prossima.dueAt
    }

    if (opportunita) {
      const eraUnContatto = (TIPI_DI_CONTATTO as readonly string[]).includes(attivita.kind)
      await tx
        .update(opportunities)
        .set({
          nextActionDueAt: nextDue,
          firstResponseAt:
            opportunita.firstResponseAt ?? (eraUnContatto ? adesso : null),
          updatedAt: adesso,
          updatedBy: input.actorId,
        })
        .where(eq(opportunities.id, opportunita.id))
    }
  })

  await recordEntityChange({
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    action: 'update',
    entityType: 'activity',
    entityId: input.activityId,
    before: { completedAt: null },
    after: {
      completedAt: adesso,
      outcome: input.outcome ?? null,
      notes: input.notes ?? null,
    },
  })

  return { ok: true, opportunityId: opportunita?.id ?? null }
}

async function azzeraNextAction(tx: Esecutore, opportunityId: string): Promise<void> {
  await tx
    .update(activities)
    .set({ isNextAction: false })
    .where(
      and(
        eq(activities.opportunityId, opportunityId),
        eq(activities.isNextAction, true),
        isNull(activities.completedAt),
      ),
    )
}
