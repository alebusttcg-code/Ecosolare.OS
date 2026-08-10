'use server'

import { z } from 'zod'
import { guard } from '@/lib/auth/session'
import { buildingInsights, geocodeIndirizzo, type AnalisiTetto } from '@/lib/solar'
import type { ActionResult } from './opportunities'

const schema = z.object({
  indirizzo: z.string().trim().min(5, 'Inserisci un indirizzo più completo.').max(300),
})

/**
 * Laboratorio Sviluppo: geocode + Solar buildingInsights.
 * Non persiste nulla sul CRM (step 1).
 */
export async function analizzaTetto(
  input: z.input<typeof schema>,
): Promise<ActionResult<AnalisiTetto>> {
  await guard('update', 'sviluppo')

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: { indirizzo: parsed.error.issues[0]?.message ?? 'Indirizzo non valido.' },
    }
  }

  const geo = await geocodeIndirizzo(parsed.data.indirizzo)
  if (!geo.ok) {
    return { ok: false, errors: { _: geo.errore.messaggio } }
  }

  const solar = await buildingInsights(geo.location)
  if (!solar.ok) {
    return { ok: false, errors: { _: solar.errore.messaggio } }
  }

  return {
    ok: true,
    data: {
      formattedAddress: geo.formatted,
      ...solar.dati,
    },
  }
}
