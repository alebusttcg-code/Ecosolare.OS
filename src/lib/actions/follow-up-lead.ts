'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { activities, opportunities } from '@/db/schema'
import { guard } from '@/lib/auth/session'
import type { ActionResult } from './opportunities'

/**
 * Follow-up manuale del lead.
 *
 * Un solo follow-up per lead, gestito a mano: l'utente sceglie data e note e lo
 * flagga «fatto». È un'attività marcata `follow_up_phase = 'manuale'`, distinta
 * dalla sequenza automatica D-014 (che resta per gli altri usi): qui niente
 * promozione a prossima azione, nessuna catena.
 */
const FASE_MANUALE = 'manuale'

function errori(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) out[issue.path.join('.') || '_'] ??= issue.message
  return out
}

const impostaSchema = z.object({
  opportunityId: z.uuid(),
  dueAt: z.coerce.date(),
  notes: z.string().trim().max(4000).optional(),
})

/** Crea o aggiorna l'unico follow-up manuale del lead (data + note). */
export async function impostaFollowUpLead(
  input: z.input<typeof impostaSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'activity')
  const parsed = impostaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()
  const opp = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, dati.opportunityId),
    columns: { id: true, contactId: true, ownerId: true },
  })
  if (!opp) return { ok: false, errors: { _: 'Lead non trovato.' } }

  const esistente = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.opportunityId, dati.opportunityId),
        eq(activities.followUpPhase, FASE_MANUALE),
      ),
    )
    .limit(1)

  if (esistente[0]) {
    await db
      .update(activities)
      .set({
        dueAt: dati.dueAt,
        notes: dati.notes ?? null,
        completedAt: null,
        completedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(activities.id, esistente[0].id))
  } else {
    await db.insert(activities).values({
      kind: 'task',
      subject: 'Follow-up',
      notes: dati.notes ?? null,
      opportunityId: dati.opportunityId,
      contactId: opp.contactId,
      assignedTo: opp.ownerId,
      dueAt: dati.dueAt,
      followUpPhase: FASE_MANUALE,
      followUpStep: 1,
      createdBy: utente.id,
    })
  }

  revalidatePath(`/lead/${dati.opportunityId}`)
  revalidatePath('/follow-up')
  revalidatePath('/lead')
  return { ok: true, data: undefined }
}

const fattoSchema = z.object({
  activityId: z.uuid(),
  opportunityId: z.uuid(),
  fatto: z.boolean(),
})

/** Segna il follow-up come fatto, o lo riapre. */
export async function segnaFollowUpFatto(
  input: z.input<typeof fattoSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'activity')
  const parsed = fattoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  await getDb()
    .update(activities)
    .set({
      completedAt: dati.fatto ? new Date() : null,
      completedBy: dati.fatto ? utente.id : null,
      isNextAction: false,
      updatedAt: new Date(),
    })
    .where(eq(activities.id, dati.activityId))

  revalidatePath(`/lead/${dati.opportunityId}`)
  revalidatePath('/follow-up')
  revalidatePath('/lead')
  return { ok: true, data: undefined }
}
