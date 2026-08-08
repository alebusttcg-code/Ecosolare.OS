'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { activities, opportunities } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import { getStages } from '@/lib/queries/pipeline'
import type { ActionResult } from './opportunities'

const TIPI_DI_CONTATTO = ['chiamata', 'email', 'whatsapp'] as const

const completeSchema = z.object({
  activityId: z.uuid(),
  outcome: z.string().trim().max(400).optional(),
  /**
   * L'attivita' successiva. Obbligatoria quando si completa la prossima azione
   * di un'opportunita' ancora aperta.
   */
  prossima: z
    .object({
      kind: z.enum([
        'chiamata',
        'email',
        'whatsapp',
        'appuntamento',
        'sopralluogo',
        'task',
        'nota',
      ]),
      subject: z.string().trim().min(1).max(160),
      dueAt: z.date(),
    })
    .optional(),
})

function errori(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) out[issue.path.join('.') || '_'] ??= issue.message
  return out
}

/**
 * Completa un'attivita'.
 *
 * Due effetti che sono il cuore della Fase 1:
 *
 *  1. **Non si puo' completare la prossima azione di un'opportunita' aperta
 *     senza definire quella successiva.** E' il meccanismo che rende vera la
 *     regola "nessuna opportunita senza prossima azione": senza, la pipeline si
 *     svuoterebbe un'attivita' alla volta, senza che nessuno se ne accorga.
 *  2. Il primo contatto tracciato chiude la misura di speed-to-lead. Non e' un
 *     campo che qualcuno compila: si deduce dal lavoro, altrimenti non e'
 *     affidabile.
 */
export async function completeActivity(
  input: z.input<typeof completeSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'activity')

  const parsed = completeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()
  const attivita = await db.query.activities.findFirst({
    where: eq(activities.id, dati.activityId),
  })
  if (!attivita) return { ok: false, errors: { _: 'Attività non trovata.' } }
  if (attivita.completedAt) return { ok: false, errors: { _: 'Attività già completata.' } }

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

  if (attivita.isNextAction && opportunitaAperta && !dati.prossima) {
    return {
      ok: false,
      errors: {
        prossima:
          'Indicare la prossima azione: un\'opportunità aperta non può restare senza.',
      },
    }
  }

  const adesso = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(activities)
      .set({
        completedAt: adesso,
        completedBy: utente.id,
        outcome: dati.outcome ?? null,
        isNextAction: false,
        updatedAt: adesso,
      })
      .where(eq(activities.id, dati.activityId))

    if (dati.prossima && opportunita) {
      await tx.insert(activities).values({
        kind: dati.prossima.kind,
        subject: dati.prossima.subject,
        opportunityId: opportunita.id,
        contactId: opportunita.contactId,
        assignedTo: opportunita.ownerId,
        dueAt: dati.prossima.dueAt,
        isNextAction: true,
        createdBy: utente.id,
      })
    }

    if (opportunita) {
      const eraUnContatto = (TIPI_DI_CONTATTO as readonly string[]).includes(attivita.kind)
      await tx
        .update(opportunities)
        .set({
          nextActionDueAt: dati.prossima?.dueAt ?? null,
          firstResponseAt:
            opportunita.firstResponseAt ?? (eraUnContatto ? adesso : null),
          updatedAt: adesso,
          updatedBy: utente.id,
        })
        .where(eq(opportunities.id, opportunita.id))
    }
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'activity',
    entityId: dati.activityId,
    before: { completedAt: null },
    after: { completedAt: adesso, outcome: dati.outcome ?? null },
  })

  revalidatePath('/attivita')
  revalidatePath('/lead')
  return { ok: true, data: undefined }
}

