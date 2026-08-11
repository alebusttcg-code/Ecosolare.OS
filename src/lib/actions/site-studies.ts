'use server'

import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { opportunities, siteStudies } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import {
  kWpDaLayout,
  stimaProduzioneAnnuakWh,
  studioCompleto,
  type SnapshotStudioTetto,
} from '@/lib/domain/studio-tetto'
import type { ActionResult } from './opportunities'

const coordinata = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

const moduloSchema = z.object({
  angoli: z.tuple([coordinata, coordinata, coordinata, coordinata]),
  centro: coordinata,
  rotazioneDegrees: z.number(),
})

const layoutSchema = z.object({
  faldaIndice: z.number().int().min(0),
  formatoId: z.string().min(1).max(80),
  wattPicco: z.number().positive().max(2000),
  quantitaRichiesta: z.number().int().positive().max(500),
  landscape: z.boolean(),
  moduli: z.array(moduloSchema).min(1).max(500),
})

const snapshotSchema = z.object({
  analisi: z.any(),
  poligoni: z.record(z.string(), z.array(coordinata)),
  faldeRimosse: z.array(z.number().int().min(0)).default([]),
  layout: layoutSchema.nullable(),
  consumoAnnuoKwh: z.number().min(0).max(500_000),
  produzioneAnnuakWh: z.number().min(0).max(500_000).optional(),
  tariffaImportEurKwh: z.number().min(0).max(5).default(0.3),
  tariffaExportEurKwh: z.number().min(0).max(5).default(0.1),
})

const salvaSchema = z.object({
  studyId: z.uuid().optional(),
  opportunityId: z.uuid(),
  title: z.string().trim().min(1).max(160).optional(),
  completa: z.boolean().default(false),
  snapshot: snapshotSchema,
})

function normalizzaSnapshot(
  grezzo: z.infer<typeof snapshotSchema>,
): SnapshotStudioTetto {
  const layout = grezzo.layout
  const kWp = kWpDaLayout(layout)
  const produzione =
    grezzo.produzioneAnnuakWh != null && grezzo.produzioneAnnuakWh > 0
      ? grezzo.produzioneAnnuakWh
      : stimaProduzioneAnnuakWh(kWp)

  return {
    analisi: grezzo.analisi as SnapshotStudioTetto['analisi'],
    poligoni: grezzo.poligoni,
    faldeRimosse: grezzo.faldeRimosse,
    layout,
    consumoAnnuoKwh: grezzo.consumoAnnuoKwh,
    produzioneAnnuakWh: produzione,
    tariffaImportEurKwh: grezzo.tariffaImportEurKwh,
    tariffaExportEurKwh: grezzo.tariffaExportEurKwh,
  }
}

/**
 * Crea o aggiorna uno studio tetto per un lead.
 *
 * `completa: true` richiede layout moduli e produzione > 0; solo allora il
 * preventivo può nascere da questo studio.
 */
export async function salvaStudioTetto(
  input: z.input<typeof salvaSchema>,
): Promise<ActionResult<{ studyId: string; status: 'bozza' | 'completo' }>> {
  const utente = await guard('update', 'sviluppo')

  const parsed = salvaSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, errors: { _: 'Dati dello studio non validi.' } }
  }

  const db = getDb()
  const opp = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, parsed.data.opportunityId),
    columns: { id: true, siteId: true, code: true, title: true },
  })
  if (!opp) return { ok: false, errors: { _: 'Lead non trovato.' } }

  const snapshot = normalizzaSnapshot(parsed.data.snapshot)
  const kWp = kWpDaLayout(snapshot.layout)
  const moduli = snapshot.layout?.moduli.length ?? 0

  if (parsed.data.completa && !studioCompleto(snapshot)) {
    return {
      ok: false,
      errors: {
        _: 'Per completare lo studio servono analisi tetto, almeno un modulo posizionato e la produzione stimata.',
      },
    }
  }

  const status = (
    parsed.data.completa && studioCompleto(snapshot) ? 'completo' : 'bozza'
  ) as 'bozza' | 'completo'
  const adesso = new Date()
  const valori = {
    opportunityId: opp.id,
    siteId: opp.siteId,
    title: parsed.data.title?.trim() || 'Studio tetto',
    status,
    payload: snapshot,
    moduliCount: moduli > 0 ? moduli : null,
    powerKwp: kWp > 0 ? kWp.toFixed(3) : null,
    produzioneKwh:
      snapshot.produzioneAnnuakWh > 0
        ? snapshot.produzioneAnnuakWh.toFixed(1)
        : null,
    consumoKwh: snapshot.consumoAnnuoKwh.toFixed(1),
    formattedAddress: snapshot.analisi.formattedAddress ?? null,
    completedAt: status === 'completo' ? adesso : null,
    updatedAt: adesso,
    updatedBy: utente.id,
  }

  let studyId = parsed.data.studyId

  if (studyId) {
    const esistente = await db.query.siteStudies.findFirst({
      where: and(
        eq(siteStudies.id, studyId),
        eq(siteStudies.opportunityId, opp.id),
      ),
      columns: { id: true },
    })
    if (!esistente) {
      return { ok: false, errors: { _: 'Studio non trovato per questo lead.' } }
    }
    await db.update(siteStudies).set(valori).where(eq(siteStudies.id, studyId))
  } else {
    const [creato] = await db
      .insert(siteStudies)
      .values({ ...valori, createdBy: utente.id })
      .returning({ id: siteStudies.id })
    studyId = creato!.id
  }

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: studyId === parsed.data.studyId ? 'update' : 'create',
    entityType: 'site_study',
    entityId: studyId,
    after: { status, moduli, kWp },
  })

  revalidatePath(`/lead/${opp.id}`)
  revalidatePath('/sviluppo')
  return { ok: true, data: { studyId, status } }
}

export async function elencoStudiTettoLead(
  opportunityId: string,
): Promise<
  ActionResult<
    readonly {
      id: string
      title: string
      status: 'bozza' | 'completo'
      moduliCount: number | null
      powerKwp: string | null
      updatedAt: Date
    }[]
  >
> {
  await guard('read', 'sviluppo')
  if (!z.uuid().safeParse(opportunityId).success) {
    return { ok: false, errors: { _: 'Lead non valido.' } }
  }

  const righe = await getDb()
    .select({
      id: siteStudies.id,
      title: siteStudies.title,
      status: siteStudies.status,
      moduliCount: siteStudies.moduliCount,
      powerKwp: siteStudies.powerKwp,
      updatedAt: siteStudies.updatedAt,
    })
    .from(siteStudies)
    .where(eq(siteStudies.opportunityId, opportunityId))
    .orderBy(desc(siteStudies.updatedAt))

  return { ok: true, data: righe }
}
