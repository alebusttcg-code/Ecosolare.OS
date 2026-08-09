'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { completaAttivitaCore } from '@/lib/activities/completa'
import { guard } from '@/lib/auth/session'
import type { ActionResult } from './opportunities'

const completeSchema = z.object({
  activityId: z.uuid(),
  outcome: z.string().trim().max(400).optional(),
  notes: z.string().trim().max(4000).optional(),
  /**
   * L'attivita' successiva. Obbligatoria quando si completa la prossima azione
   * di un'opportunita' ancora aperta — salvo se esiste già un FU in coda
   * (viene promosso automaticamente).
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
 *  1. Prossima azione su lead aperto: o si indica la successiva, o c'è già un
 *     follow-up in coda da promuovere (sequenza D-014).
 *  2. Speed-to-lead: il primo contatto tracciato chiude firstResponseAt.
 */
export async function completeActivity(
  input: z.input<typeof completeSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'activity')

  const parsed = completeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const esito = await completaAttivitaCore({
    activityId: dati.activityId,
    actorId: utente.id,
    actorLabel: utente.email,
    outcome: dati.outcome,
    notes: dati.notes || null,
    prossima: dati.prossima,
  })

  if (!esito.ok) {
    if (esito.codice === 'serve_prossima') {
      return { ok: false, errors: { prossima: esito.errore } }
    }
    return { ok: false, errors: { _: esito.errore } }
  }

  revalidatePath('/attivita')
  revalidatePath('/follow-up')
  revalidatePath('/lead')
  if (esito.opportunityId) revalidatePath(`/lead/${esito.opportunityId}`)
  return { ok: true, data: undefined }
}
