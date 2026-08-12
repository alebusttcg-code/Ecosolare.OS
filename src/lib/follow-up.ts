import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Esecutore } from '@/db'
import { activities, opportunities } from '@/db/schema'
import {
  FASE_POST,
  FASE_PRE,
  OUTCOME_SALTATO_FIRMA,
  OUTCOME_SALTATO_SOPRALLUOGO,
  scadenzePost,
  scadenzePre,
  type FaseFollowUp,
  type PassoFollowUp,
} from '@/lib/domain/follow-up'

/**
 * Operazioni follow-up dentro una transazione già aperta.
 * Nessun effetto esterno: solo righe `activities` / `opportunities`.
 */

async function inserisciPassi(
  tx: Esecutore,
  input: {
    opportunityId: string
    contactId: string
    ownerId: string
    createdBy: string | null
    passi: readonly PassoFollowUp[]
    /** Se true, il passo 1 diventa next action (dopo aver azzerato le altre). */
    promuoviPrimo: boolean
  },
) {
  if (input.promuoviPrimo) {
    await tx
      .update(activities)
      .set({ isNextAction: false })
      .where(
        and(
          eq(activities.opportunityId, input.opportunityId),
          eq(activities.isNextAction, true),
          isNull(activities.completedAt),
        ),
      )
  }

  for (const passo of input.passi) {
    // Idempotenza: il vincolo univoco (lead, fase, step) resta anche sui passi
    // già chiusi — un secondo salvataggio non deve far crashare la chiusura.
    const [gia] = await tx
      .select({ id: activities.id })
      .from(activities)
      .where(
        and(
          eq(activities.opportunityId, input.opportunityId),
          eq(activities.followUpPhase, passo.phase),
          eq(activities.followUpStep, passo.step),
        ),
      )
      .limit(1)
    if (gia) continue

    await tx.insert(activities).values({
      kind: passo.kind,
      subject: passo.subject,
      opportunityId: input.opportunityId,
      contactId: input.contactId,
      assignedTo: input.ownerId,
      dueAt: passo.dueAt,
      isNextAction: input.promuoviPrimo && passo.step === 1,
      followUpPhase: passo.phase,
      followUpStep: passo.step,
      createdBy: input.createdBy,
    })
  }

  if (input.promuoviPrimo && input.passi[0]) {
    // Se lo step 1 esisteva già, assicuriamo comunque la next action aperta.
    const [primo] = await tx
      .select({ id: activities.id, dueAt: activities.dueAt })
      .from(activities)
      .where(
        and(
          eq(activities.opportunityId, input.opportunityId),
          eq(activities.followUpPhase, input.passi[0].phase),
          eq(activities.followUpStep, 1),
          isNull(activities.completedAt),
        ),
      )
      .limit(1)

    if (primo) {
      await tx
        .update(activities)
        .set({ isNextAction: true, updatedAt: new Date() })
        .where(eq(activities.id, primo.id))

      await tx
        .update(opportunities)
        .set({
          nextActionDueAt: primo.dueAt ?? input.passi[0].dueAt,
          updatedAt: new Date(),
        })
        .where(eq(opportunities.id, input.opportunityId))
    }
  }
}

export async function creaFollowUpPre(
  tx: Esecutore,
  input: {
    opportunityId: string
    contactId: string
    ownerId: string
    createdBy: string | null
    acquisizione: Date
  },
) {
  const passi = scadenzePre(input.acquisizione)
  // Il «Primo contatto» resta next action: i FU pre sono solo in coda.
  await inserisciPassi(tx, {
    ...input,
    passi,
    promuoviPrimo: false,
  })
}

export async function creaFollowUpPost(
  tx: Esecutore,
  input: {
    opportunityId: string
    contactId: string
    ownerId: string
    createdBy: string | null
    chiusuraSopralluogo: Date
  },
) {
  const passi = scadenzePost(input.chiusuraSopralluogo)
  await inserisciPassi(tx, {
    ...input,
    passi,
    promuoviPrimo: true,
  })
}

async function annullaFase(
  tx: Esecutore,
  opportunityId: string,
  fasi: readonly FaseFollowUp[],
  outcome: string,
  completedBy: string | null,
) {
  const adesso = new Date()
  await tx
    .update(activities)
    .set({
      completedAt: adesso,
      completedBy,
      outcome,
      isNextAction: false,
      updatedAt: adesso,
    })
    .where(
      and(
        eq(activities.opportunityId, opportunityId),
        inArray(activities.followUpPhase, [...fasi]),
        isNull(activities.completedAt),
        isNotNull(activities.followUpPhase),
      ),
    )
}

/** Sopralluogo fissato: i FU pre non servono più. */
export async function annullaFollowUpPre(
  tx: Esecutore,
  opportunityId: string,
  completedBy: string | null,
) {
  await annullaFase(tx, opportunityId, [FASE_PRE], OUTCOME_SALTATO_SOPRALLUOGO, completedBy)
}

/** Contratto firmato: stop a tutta la sequenza commerciale sul lead. */
export async function annullaFollowUpAperti(
  tx: Esecutore,
  opportunityId: string,
  completedBy: string | null,
) {
  await annullaFase(
    tx,
    opportunityId,
    [FASE_PRE, FASE_POST],
    OUTCOME_SALTATO_FIRMA,
    completedBy,
  )
}

/**
 * Dopo aver completato un FU, promuove il passo successivo aperto della stessa
 * fase a prossima azione. Ritorna la scadenza della nuova next action, o null.
 */
export async function promuoviProssimoFollowUp(
  tx: Esecutore,
  input: {
    opportunityId: string
    phase: FaseFollowUp
    stepCompletato: number
  },
): Promise<Date | null> {
  const [prossimo] = await tx
    .select({
      id: activities.id,
      dueAt: activities.dueAt,
    })
    .from(activities)
    .where(
      and(
        eq(activities.opportunityId, input.opportunityId),
        eq(activities.followUpPhase, input.phase),
        sql`${activities.followUpStep} > ${input.stepCompletato}`,
        isNull(activities.completedAt),
      ),
    )
    .orderBy(asc(activities.followUpStep))
    .limit(1)

  if (!prossimo) return null

  await tx
    .update(activities)
    .set({ isNextAction: false })
    .where(
      and(
        eq(activities.opportunityId, input.opportunityId),
        eq(activities.isNextAction, true),
        isNull(activities.completedAt),
      ),
    )

  await tx
    .update(activities)
    .set({ isNextAction: true, updatedAt: new Date() })
    .where(eq(activities.id, prossimo.id))

  return prossimo.dueAt
}
