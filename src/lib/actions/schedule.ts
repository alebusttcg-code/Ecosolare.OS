'use server'

import { and, asc, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import {
  projectStages,
  projectStatusHistory,
  projects,
  workOrderAssignments,
  workOrders,
  workers,
} from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import {
  dataGiornoDaIso,
  puoAvviareInstallazione,
  puoCompletareInstallazione,
  puoCrearePianificazione,
  STAGE_INSTALLAZIONE_COMPLETATA,
  STAGE_INSTALLAZIONE_IN_CORSO,
  stageDopoAnnullamento,
  stageDopoPianificazione,
} from '@/lib/domain/schedule'
import type { ActionResult } from './opportunities'

function errori(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) out[issue.path.join('.') || '_'] ??= issue.message
  return out
}

function giorniNelloStage(da: Date, a: Date): number {
  return Math.max(0, Math.floor((a.getTime() - da.getTime()) / 86_400_000))
}

async function caricaStati() {
  return getDb()
    .select({ code: projectStages.code, sortOrder: projectStages.sortOrder })
    .from(projectStages)
    .orderBy(asc(projectStages.sortOrder))
}

/* -------------------------------------------------------------------------- */
/*  Operai                                                                     */
/* -------------------------------------------------------------------------- */

const schemaOperaio = z.object({
  firstName: z.string().trim().min(1, 'Il nome è obbligatorio.').max(80),
  lastName: z.string().trim().min(1, 'Il cognome è obbligatorio.').max(80),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
})

export async function creaOperaio(
  input: z.input<typeof schemaOperaio>,
): Promise<ActionResult<{ id: string }>> {
  // Anagrafica personale: impostazioni amministratore, non pianificazione.
  const utente = await guard('update', 'settings')
  const parsed = schemaOperaio.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  const db = getDb()
  const [riga] = await db
    .insert(workers)
    .values({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone ?? null,
      createdBy: utente.id,
      updatedBy: utente.id,
    })
    .returning({ id: workers.id })

  if (!riga) return { ok: false, errors: { _: 'Creazione non riuscita.' } }

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'worker',
    entityId: riga.id,
  })

  revalidatePath('/amministrazione/impostazioni')
  revalidatePath('/cantieri')
  return { ok: true, data: { id: riga.id } }
}

export async function aggiornaOperaio(
  input: z.input<typeof schemaOperaio> & { id: string },
): Promise<ActionResult> {
  const utente = await guard('update', 'settings')
  const schema = schemaOperaio.extend({ id: z.uuid() })
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  const db = getDb()
  const esistente = await db.query.workers.findFirst({
    where: eq(workers.id, parsed.data.id),
  })
  if (!esistente) return { ok: false, errors: { _: 'Dipendente non trovato.' } }

  await db
    .update(workers)
    .set({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone ?? null,
      updatedAt: new Date(),
      updatedBy: utente.id,
    })
    .where(eq(workers.id, parsed.data.id))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'worker',
    entityId: parsed.data.id,
  })

  revalidatePath('/amministrazione/impostazioni')
  revalidatePath('/cantieri')
  return { ok: true, data: undefined }
}

export async function disattivaOperaio(input: { id: string }): Promise<ActionResult> {
  const utente = await guard('update', 'settings')
  const parsed = z.object({ id: z.uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  const db = getDb()
  const esistente = await db.query.workers.findFirst({
    where: eq(workers.id, parsed.data.id),
  })
  if (!esistente) return { ok: false, errors: { _: 'Dipendente non trovato.' } }

  await db
    .update(workers)
    .set({
      isActive: false,
      updatedAt: new Date(),
      updatedBy: utente.id,
    })
    .where(eq(workers.id, parsed.data.id))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'worker',
    entityId: parsed.data.id,
  })

  revalidatePath('/amministrazione/impostazioni')
  revalidatePath('/cantieri')
  return { ok: true, data: undefined }
}

export async function riattivaOperaio(input: { id: string }): Promise<ActionResult> {
  const utente = await guard('update', 'settings')
  const parsed = z.object({ id: z.uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  const db = getDb()
  const esistente = await db.query.workers.findFirst({
    where: eq(workers.id, parsed.data.id),
  })
  if (!esistente) return { ok: false, errors: { _: 'Dipendente non trovato.' } }

  await db
    .update(workers)
    .set({
      isActive: true,
      updatedAt: new Date(),
      updatedBy: utente.id,
    })
    .where(eq(workers.id, parsed.data.id))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'worker',
    entityId: parsed.data.id,
  })

  revalidatePath('/amministrazione/impostazioni')
  revalidatePath('/cantieri')
  return { ok: true, data: undefined }
}

/* -------------------------------------------------------------------------- */
/*  Pianificazione                                                             */
/* -------------------------------------------------------------------------- */

const schemaPianifica = z.object({
  projectId: z.uuid(),
  scheduledOn: z.string().trim(),
  workerIds: z.array(z.uuid()).min(1, 'Seleziona almeno un operaio.'),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
})

async function operaiAttiviValidi(ids: readonly string[]): Promise<string | null> {
  if (ids.length === 0) return 'Seleziona almeno un operaio.'
  const unici = [...new Set(ids)]
  const trovati = await getDb()
    .select({ id: workers.id, isActive: workers.isActive })
    .from(workers)
    .where(inArray(workers.id, unici))

  if (trovati.length !== unici.length) {
    return 'Uno o più operai non esistono più.'
  }
  if (trovati.some((o) => !o.isActive)) {
    return 'Non si possono assegnare operai disattivati.'
  }
  return null
}

/**
 * Prima pianificazione: readiness pianificabile, crea WO e avanza lo stage.
 */
export async function pianificaCantiere(
  input: z.input<typeof schemaPianifica>,
): Promise<ActionResult<{ workOrderId: string }>> {
  const utente = await guard('create', 'schedule')
  const parsed = schemaPianifica.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  const giorno = dataGiornoDaIso(parsed.data.scheduledOn)
  if (!giorno) {
    return { ok: false, errors: { scheduledOn: 'Data non valida.' } }
  }

  const errOperai = await operaiAttiviValidi(parsed.data.workerIds)
  if (errOperai) return { ok: false, errors: { workerIds: errOperai } }

  const db = getDb()
  const [commessa] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, parsed.data.projectId))
    .limit(1)

  if (!commessa || commessa.deletedAt) {
    return { ok: false, errors: { _: 'Commessa non trovata.' } }
  }
  if (!puoCrearePianificazione(commessa.readinessState)) {
    return {
      ok: false,
      errors: {
        _: 'La commessa non è ancora pianificabile: completa documenti, materiali e via libera amministrativo.',
      },
    }
  }

  const [attivo] = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.projectId, parsed.data.projectId),
        eq(workOrders.status, 'pianificato'),
      ),
    )
    .limit(1)

  if (attivo) {
    return {
      ok: false,
      errors: { _: 'Esiste già una pianificazione attiva: usa ripianifica.' },
    }
  }

  const stati = await caricaStati()
  const nuovoStage = stageDopoPianificazione(commessa.stage, stati)
  const ora = new Date()
  const workerIds = [...new Set(parsed.data.workerIds)]

  const workOrderId = await db.transaction(async (tx) => {
    const [wo] = await tx
      .insert(workOrders)
      .values({
        projectId: parsed.data.projectId,
        scheduledOn: giorno,
        notes: parsed.data.notes ?? null,
        status: 'pianificato',
        createdBy: utente.id,
        updatedBy: utente.id,
      })
      .returning({ id: workOrders.id })

    if (!wo) throw new Error('work_order non creato')

    await tx.insert(workOrderAssignments).values(
      workerIds.map((workerId) => ({
        workOrderId: wo.id,
        workerId,
      })),
    )

    const patch: {
      updatedAt: Date
      updatedBy: string
      plannedStartAt?: Date
      stage?: string
      stageSince?: Date
    } = {
      updatedAt: ora,
      updatedBy: utente.id,
    }

    if (!commessa.plannedStartAt) {
      patch.plannedStartAt = giorno
    }

    if (nuovoStage) {
      patch.stage = nuovoStage
      patch.stageSince = ora
      await tx.insert(projectStatusHistory).values({
        projectId: parsed.data.projectId,
        fromStage: commessa.stage,
        toStage: nuovoStage,
        daysInPreviousStage: giorniNelloStage(commessa.stageSince, ora),
        note: 'Pianificazione cantiere',
        changedBy: utente.id,
        changedAt: ora,
      })
    }

    await tx.update(projects).set(patch).where(eq(projects.id, parsed.data.projectId))

    return wo.id
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'work_order',
    entityId: workOrderId,
  })

  revalidatePath(`/cantieri/${parsed.data.projectId}`)
  revalidatePath('/cantieri')
  revalidatePath('/cantieri/agenda')
  return { ok: true, data: { workOrderId } }
}

/**
 * Aggiorna data e operai del work order attivo (senza ripartire da zero).
 */
export async function ripianificaCantiere(
  input: z.input<typeof schemaPianifica>,
): Promise<ActionResult> {
  const utente = await guard('update', 'schedule')
  const parsed = schemaPianifica.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  const giorno = dataGiornoDaIso(parsed.data.scheduledOn)
  if (!giorno) {
    return { ok: false, errors: { scheduledOn: 'Data non valida.' } }
  }

  const errOperai = await operaiAttiviValidi(parsed.data.workerIds)
  if (errOperai) return { ok: false, errors: { workerIds: errOperai } }

  const db = getDb()
  const [commessa] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, parsed.data.projectId))
    .limit(1)

  if (!commessa || commessa.deletedAt) {
    return { ok: false, errors: { _: 'Commessa non trovata.' } }
  }

  const [wo] = await db
    .select()
    .from(workOrders)
    .where(
      and(
        eq(workOrders.projectId, parsed.data.projectId),
        eq(workOrders.status, 'pianificato'),
      ),
    )
    .limit(1)

  if (!wo) {
    return { ok: false, errors: { _: 'Nessuna pianificazione attiva da aggiornare.' } }
  }

  const ora = new Date()
  const workerIds = [...new Set(parsed.data.workerIds)]

  await db.transaction(async (tx) => {
    await tx
      .update(workOrders)
      .set({
        scheduledOn: giorno,
        notes: parsed.data.notes ?? null,
        updatedAt: ora,
        updatedBy: utente.id,
      })
      .where(eq(workOrders.id, wo.id))

    await tx
      .delete(workOrderAssignments)
      .where(eq(workOrderAssignments.workOrderId, wo.id))

    await tx.insert(workOrderAssignments).values(
      workerIds.map((workerId) => ({
        workOrderId: wo.id,
        workerId,
      })),
    )

    await tx
      .update(projects)
      .set({ updatedAt: ora, updatedBy: utente.id })
      .where(eq(projects.id, parsed.data.projectId))
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'work_order',
    entityId: wo.id,
  })

  revalidatePath(`/cantieri/${parsed.data.projectId}`)
  revalidatePath('/cantieri')
  revalidatePath('/cantieri/agenda')
  return { ok: true, data: undefined }
}

export async function annullaPianificazione(input: {
  projectId: string
}): Promise<ActionResult> {
  const utente = await guard('update', 'schedule')
  const parsed = z.object({ projectId: z.uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  const db = getDb()
  const [commessa] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, parsed.data.projectId))
    .limit(1)

  if (!commessa || commessa.deletedAt) {
    return { ok: false, errors: { _: 'Commessa non trovata.' } }
  }

  const [wo] = await db
    .select()
    .from(workOrders)
    .where(
      and(
        eq(workOrders.projectId, parsed.data.projectId),
        eq(workOrders.status, 'pianificato'),
      ),
    )
    .limit(1)

  if (!wo) {
    return { ok: false, errors: { _: 'Nessuna pianificazione attiva da annullare.' } }
  }

  const ora = new Date()
  const nuovoStage = stageDopoAnnullamento(commessa.stage)

  await db.transaction(async (tx) => {
    await tx
      .update(workOrders)
      .set({
        status: 'annullato',
        updatedAt: ora,
        updatedBy: utente.id,
      })
      .where(eq(workOrders.id, wo.id))

    const patch: {
      updatedAt: Date
      updatedBy: string
      stage?: string
      stageSince?: Date
    } = {
      updatedAt: ora,
      updatedBy: utente.id,
    }

    if (nuovoStage) {
      patch.stage = nuovoStage
      patch.stageSince = ora
      await tx.insert(projectStatusHistory).values({
        projectId: parsed.data.projectId,
        fromStage: commessa.stage,
        toStage: nuovoStage,
        daysInPreviousStage: giorniNelloStage(commessa.stageSince, ora),
        note: 'Pianificazione annullata',
        changedBy: utente.id,
        changedAt: ora,
      })
    }

    await tx.update(projects).set(patch).where(eq(projects.id, parsed.data.projectId))
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'work_order',
    entityId: wo.id,
  })

  revalidatePath(`/cantieri/${parsed.data.projectId}`)
  revalidatePath('/cantieri')
  revalidatePath('/cantieri/agenda')
  return { ok: true, data: undefined }
}

/**
 * Segna l’inizio lavori: WO pianificato → in_corso, stage installazione_in_corso.
 */
export async function avviaInstallazione(input: {
  projectId: string
}): Promise<ActionResult> {
  const utente = await guard('update', 'schedule')
  const parsed = z.object({ projectId: z.uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  const db = getDb()
  const [commessa] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, parsed.data.projectId))
    .limit(1)

  if (!commessa || commessa.deletedAt) {
    return { ok: false, errors: { _: 'Commessa non trovata.' } }
  }

  const [wo] = await db
    .select()
    .from(workOrders)
    .where(
      and(
        eq(workOrders.projectId, parsed.data.projectId),
        eq(workOrders.status, 'pianificato'),
      ),
    )
    .limit(1)

  if (!wo || !puoAvviareInstallazione(wo.status)) {
    return {
      ok: false,
      errors: { _: 'Serve una pianificazione attiva per avviare l’installazione.' },
    }
  }

  const ora = new Date()
  const stageDest = STAGE_INSTALLAZIONE_IN_CORSO

  await db.transaction(async (tx) => {
    await tx
      .update(workOrders)
      .set({
        status: 'in_corso',
        updatedAt: ora,
        updatedBy: utente.id,
      })
      .where(eq(workOrders.id, wo.id))

    const patch: {
      updatedAt: Date
      updatedBy: string
      stage?: string
      stageSince?: Date
    } = {
      updatedAt: ora,
      updatedBy: utente.id,
    }

    if (commessa.stage !== stageDest) {
      patch.stage = stageDest
      patch.stageSince = ora
      await tx.insert(projectStatusHistory).values({
        projectId: parsed.data.projectId,
        fromStage: commessa.stage,
        toStage: stageDest,
        daysInPreviousStage: giorniNelloStage(commessa.stageSince, ora),
        note: 'Installazione avviata',
        changedBy: utente.id,
        changedAt: ora,
      })
    }

    await tx.update(projects).set(patch).where(eq(projects.id, parsed.data.projectId))
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'work_order',
    entityId: wo.id,
  })

  revalidatePath(`/cantieri/${parsed.data.projectId}`)
  revalidatePath('/cantieri')
  revalidatePath('/cantieri/agenda')
  return { ok: true, data: undefined }
}

/**
 * Chiude i lavori operativi: WO in_corso → completato, stage installazione_completata.
 */
export async function completaInstallazione(input: {
  projectId: string
}): Promise<ActionResult> {
  const utente = await guard('update', 'schedule')
  const parsed = z.object({ projectId: z.uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  const db = getDb()
  const [commessa] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, parsed.data.projectId))
    .limit(1)

  if (!commessa || commessa.deletedAt) {
    return { ok: false, errors: { _: 'Commessa non trovata.' } }
  }

  const [wo] = await db
    .select()
    .from(workOrders)
    .where(
      and(
        eq(workOrders.projectId, parsed.data.projectId),
        eq(workOrders.status, 'in_corso'),
      ),
    )
    .limit(1)

  if (!wo || !puoCompletareInstallazione(wo.status)) {
    return {
      ok: false,
      errors: { _: 'L’installazione non risulta in corso.' },
    }
  }

  const ora = new Date()
  const stageDest = STAGE_INSTALLAZIONE_COMPLETATA

  await db.transaction(async (tx) => {
    await tx
      .update(workOrders)
      .set({
        status: 'completato',
        updatedAt: ora,
        updatedBy: utente.id,
      })
      .where(eq(workOrders.id, wo.id))

    const patch: {
      updatedAt: Date
      updatedBy: string
      stage?: string
      stageSince?: Date
    } = {
      updatedAt: ora,
      updatedBy: utente.id,
    }

    if (commessa.stage !== stageDest) {
      patch.stage = stageDest
      patch.stageSince = ora
      await tx.insert(projectStatusHistory).values({
        projectId: parsed.data.projectId,
        fromStage: commessa.stage,
        toStage: stageDest,
        daysInPreviousStage: giorniNelloStage(commessa.stageSince, ora),
        note: 'Installazione completata',
        changedBy: utente.id,
        changedAt: ora,
      })
    }

    await tx.update(projects).set(patch).where(eq(projects.id, parsed.data.projectId))
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'work_order',
    entityId: wo.id,
  })

  revalidatePath(`/cantieri/${parsed.data.projectId}`)
  revalidatePath('/cantieri')
  revalidatePath('/cantieri/agenda')
  return { ok: true, data: undefined }
}
