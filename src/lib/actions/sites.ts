'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { sites } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import { normalizzaPod, validaPodOpzionale } from '@/lib/domain/pod'
import type { ActionResult } from './opportunities'

const siteSchema = z.object({
  contactId: z.uuid(),
  label: z.string().trim().min(1, 'Indicare un nome per l\'immobile').max(80),
  addressLine: z.string().trim().min(1, 'Indicare l\'indirizzo').max(200),
  city: z.string().trim().min(1, 'Indicare il comune').max(80),
  province: z.string().trim().max(4).optional(),
  postalCode: z.string().trim().max(10).optional(),
  buildingType: z.string().trim().max(60).optional(),
  /** Punto di prelievo: identifica univocamente la fornitura elettrica. */
  pod: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || validaPodOpzionale(v).ok, {
      message: 'Il codice POD deve essere alfanumerico e lungo 14 o 15 caratteri.',
    }),
  notes: z.string().trim().max(2000).optional(),
})

export type SiteInput = z.input<typeof siteSchema>

export async function createSite(input: SiteInput): Promise<ActionResult<{ id: string }>> {
  const utente = await guard('create', 'contact')

  const parsed = siteSchema.safeParse(input)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) errors[issue.path.join('.') || '_'] ??= issue.message
    return { ok: false, errors }
  }

  const dati = parsed.data
  const [creato] = await getDb()
    .insert(sites)
    .values({
      contactId: dati.contactId,
      label: dati.label,
      addressLine: dati.addressLine,
      city: dati.city,
      province: dati.province?.toUpperCase() ?? null,
      postalCode: dati.postalCode ?? null,
      buildingType: dati.buildingType ?? null,
      pod: dati.pod ? normalizzaPod(dati.pod) : null,
      notes: dati.notes ?? null,
      createdBy: utente.id,
      updatedBy: utente.id,
    })
    .returning({ id: sites.id })

  if (!creato) return { ok: false, errors: { _: 'Creazione non riuscita.' } }

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'site',
    entityId: creato.id,
  })

  revalidatePath(`/clienti/${dati.contactId}`)
  return { ok: true, data: creato }
}
