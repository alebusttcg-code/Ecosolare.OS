'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import {
  documentRequirements,
  paymentMilestones,
  projectMaterials,
  projectPractices,
  projectTasks,
  projects,
} from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import type { ActionResult } from './opportunities'
import { ricalcolaReadiness } from '@/lib/readiness'

function errori(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) out[issue.path.join('.') || '_'] ??= issue.message
  return out
}

/**
 * Ogni cambiamento di stato che può influenzare la pianificabilità la ricalcola
 * subito. Il valore conservato sulla commessa non deve mai poter divergere dagli
 * ingredienti che lo compongono.
 */
async function aggiornaEDRicalcola(projectId: string): Promise<void> {
  await ricalcolaReadiness(projectId)
  revalidatePath(`/cantieri/${projectId}`)
  revalidatePath('/cantieri')
}

/* -------------------------------------------------------------------------- */
/*  Documenti                                                                  */
/* -------------------------------------------------------------------------- */

const statoDocumentoSchema = z.object({
  requirementId: z.uuid(),
  status: z.enum([
    'richiesto',
    'caricato',
    'da_verificare',
    'approvato',
    'respinto',
    'scaduto',
    'non_necessario',
  ]),
  rejectionReason: z.string().trim().max(400).optional(),
})

export async function setDocumentStatus(
  input: z.input<typeof statoDocumentoSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'document')

  const parsed = statoDocumentoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  // Respingere senza dire perché costringe chi riceve la notifica a
  // ricontattare chi ha respinto: due passaggi invece di zero.
  if (dati.status === 'respinto' && !dati.rejectionReason?.trim()) {
    return {
      ok: false,
      errors: { rejectionReason: 'Indicare il motivo del rifiuto.' },
    }
  }

  const db = getDb()
  const requisito = await db.query.documentRequirements.findFirst({
    where: eq(documentRequirements.id, dati.requirementId),
  })
  if (!requisito) return { ok: false, errors: { _: 'Requisito non trovato.' } }

  const adesso = new Date()
  const verificato = dati.status === 'approvato' || dati.status === 'respinto'

  await db
    .update(documentRequirements)
    .set({
      status: dati.status,
      statusSince: adesso,
      rejectionReason: dati.status === 'respinto' ? (dati.rejectionReason ?? null) : null,
      verifiedBy: verificato ? utente.id : null,
      verifiedAt: verificato ? adesso : null,
    })
    .where(eq(documentRequirements.id, dati.requirementId))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'document_requirement',
    entityId: dati.requirementId,
    before: { status: requisito.status },
    after: { status: dati.status },
  })

  await aggiornaEDRicalcola(requisito.projectId)
  return { ok: true, data: undefined }
}

/* -------------------------------------------------------------------------- */
/*  Materiali                                                                  */
/* -------------------------------------------------------------------------- */

const materialeSchema = z.object({
  materialId: z.uuid(),
  status: z.enum([
    'da_ordinare',
    'ordinato',
    'parzialmente_consegnato',
    'consegnato',
    'non_disponibile',
  ]),
  critical: z.boolean().optional(),
  expectedAt: z.date().optional(),
  actualUnitCost: z.number().min(0).optional(),
})

export async function setMaterialStatus(
  input: z.input<typeof materialeSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'material')

  const parsed = materialeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()
  const materiale = await db.query.projectMaterials.findFirst({
    where: eq(projectMaterials.id, dati.materialId),
  })
  if (!materiale) return { ok: false, errors: { _: 'Materiale non trovato.' } }

  await db
    .update(projectMaterials)
    .set({
      status: dati.status,
      statusSince: new Date(),
      ...(dati.critical !== undefined ? { critical: dati.critical } : {}),
      ...(dati.expectedAt !== undefined ? { expectedAt: dati.expectedAt } : {}),
      // Il costo reale non sovrascrive quello previsto: sono colonne diverse
      // proprio perché lo scostamento resti calcolabile (ADR-008).
      ...(dati.actualUnitCost !== undefined
        ? { actualUnitCost: dati.actualUnitCost.toFixed(4) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(projectMaterials.id, dati.materialId))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'project_material',
    entityId: dati.materialId,
    before: { status: materiale.status, critical: materiale.critical },
    after: { status: dati.status, critical: dati.critical ?? materiale.critical },
  })

  await aggiornaEDRicalcola(materiale.projectId)
  return { ok: true, data: undefined }
}

/* -------------------------------------------------------------------------- */
/*  Pratiche                                                                   */
/* -------------------------------------------------------------------------- */

const praticaSchema = z.object({
  practiceId: z.uuid(),
  status: z.enum(['da_preparare', 'in_preparazione', 'inviata', 'approvata', 'respinta']),
  referenceNumber: z.string().trim().max(60).optional(),
})

export async function setPracticeStatus(
  input: z.input<typeof praticaSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'practice')

  const parsed = praticaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()
  const pratica = await db.query.projectPractices.findFirst({
    where: eq(projectPractices.id, dati.practiceId),
  })
  if (!pratica) return { ok: false, errors: { _: 'Pratica non trovata.' } }

  const adesso = new Date()
  await db
    .update(projectPractices)
    .set({
      status: dati.status,
      statusSince: adesso,
      submittedAt: dati.status === 'inviata' ? (pratica.submittedAt ?? adesso) : pratica.submittedAt,
      approvedAt: dati.status === 'approvata' ? adesso : null,
      ...(dati.referenceNumber ? { referenceNumber: dati.referenceNumber } : {}),
    })
    .where(eq(projectPractices.id, dati.practiceId))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'project_practice',
    entityId: dati.practiceId,
    before: { status: pratica.status },
    after: { status: dati.status },
  })

  await aggiornaEDRicalcola(pratica.projectId)
  return { ok: true, data: undefined }
}

/* -------------------------------------------------------------------------- */
/*  Task e conferme sulla commessa                                             */
/* -------------------------------------------------------------------------- */

export async function toggleProjectTask(taskId: string): Promise<ActionResult> {
  const utente = await guard('update', 'project')

  if (!z.uuid().safeParse(taskId).success) {
    return { ok: false, errors: { _: 'Identificativo non valido.' } }
  }

  const db = getDb()
  const task = await db.query.projectTasks.findFirst({
    where: eq(projectTasks.id, taskId),
  })
  if (!task) return { ok: false, errors: { _: 'Attività non trovata.' } }

  const completato = task.completedAt === null
  await db
    .update(projectTasks)
    .set({
      completedAt: completato ? new Date() : null,
      completedBy: completato ? utente.id : null,
    })
    .where(eq(projectTasks.id, taskId))

  revalidatePath(`/cantieri/${task.projectId}`)
  return { ok: true, data: undefined }
}

const confermaSchema = z.object({
  projectId: z.uuid(),
  campo: z.enum(['verifica_tecnica', 'conferma_cliente']),
  valore: z.boolean(),
})

/** Segna come completate la verifica tecnica o la conferma del cliente. */
export async function setProjectConfirmation(
  input: z.input<typeof confermaSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'project')

  const parsed = confermaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const adesso = dati.valore ? new Date() : null
  await getDb()
    .update(projects)
    .set({
      ...(dati.campo === 'verifica_tecnica'
        ? { technicalCheckDoneAt: adesso }
        : { clientConfirmedAt: adesso }),
      updatedAt: new Date(),
      updatedBy: utente.id,
    })
    .where(eq(projects.id, dati.projectId))

  await aggiornaEDRicalcola(dati.projectId)
  return { ok: true, data: undefined }
}

/* -------------------------------------------------------------------------- */
/*  Piano pagamenti                                                            */
/* -------------------------------------------------------------------------- */

const pagamentoSchema = z.object({
  milestoneId: z.uuid(),
  status: z.enum(['previsto', 'fatturato', 'incassato', 'insoluto']),
})

export async function setPaymentStatus(
  input: z.input<typeof pagamentoSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'invoice')

  const parsed = pagamentoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()
  const scadenza = await db.query.paymentMilestones.findFirst({
    where: eq(paymentMilestones.id, dati.milestoneId),
  })
  if (!scadenza) return { ok: false, errors: { _: 'Scadenza non trovata.' } }

  const adesso = new Date()
  await db
    .update(paymentMilestones)
    .set({
      status: dati.status,
      invoicedAt:
        dati.status === 'fatturato' ? (scadenza.invoicedAt ?? adesso) : scadenza.invoicedAt,
      paidAt: dati.status === 'incassato' ? adesso : null,
    })
    .where(eq(paymentMilestones.id, dati.milestoneId))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'payment_milestone',
    entityId: dati.milestoneId,
    before: { status: scadenza.status },
    after: { status: dati.status },
  })

  await aggiornaEDRicalcola(scadenza.projectId)
  return { ok: true, data: undefined }
}
