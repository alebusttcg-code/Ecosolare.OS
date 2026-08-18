import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { scopeFor } from '@/lib/auth/policy'
import {
  commessaVisibile,
  filtroCommessaAssegnata,
  type UtenteConId,
} from '@/lib/auth/scope-query'
import {
  contacts,
  contracts,
  documentFiles,
  documentRequirements,
  invoices,
  paymentMilestones,
  paymentReceipts,
  projectMaterials,
  projectPractices,
  projectStages,
  projectStatusHistory,
  projectTasks,
  projects,
  sites,
  users,
} from '@/db/schema'
import type { Blocco, StatoPianificabilita } from '@/lib/domain/readiness'
import { unoAllaVolta } from '@/lib/uno-alla-volta'

export interface CommessaInElenco {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly businessLine: string
  readonly stage: string
  readonly stageLabel: string
  readonly readinessState: StatoPianificabilita
  readonly bloccanti: readonly Blocco[]
  readonly giorniDiBlocco: number | null
  readonly revenueNet: string
  readonly clienteId: string
  readonly cliente: string
  readonly responsabile: string | null
  /** Valorizzato quando la commessa è in uno stato chiuso. */
  readonly completedAt: Date | null
  readonly chiusaDal: Date
}

/**
 * Elenco commesse.
 *
 * `attive` = ciclo operativo (Cantieri).
 * `completate` = archivio, il filtro «Completati» dei cantieri: solo stati
 * con `is_closed`.
 * Separarli è la differenza fra «cosa sto portando avanti» e «dove ritrovo
 * un lavoro già finito senza mischiarlo a quelli aperti».
 */
export async function listProjects(
  utente: UtenteConId,
  ambito: 'attive' | 'completate' = 'attive',
): Promise<CommessaInElenco[]> {
  const scope = scopeFor(utente, 'project')
  if (scope === 'none') return []

  const adesso = Date.now()
  const chiuse = ambito === 'completate'

  const condizioni = [isNull(projects.deletedAt), eq(projectStages.isClosed, chiuse)]
  if (scope === 'assigned') {
    condizioni.push(filtroCommessaAssegnata(utente.id))
  }

  const righe = await getDb()
    .select({
      id: projects.id,
      code: projects.code,
      title: projects.title,
      businessLine: projects.businessLine,
      stage: projects.stage,
      stageLabel: projectStages.label,
      stageOrder: projectStages.sortOrder,
      readinessState: projects.readinessState,
      readinessBlockers: projects.readinessBlockers,
      blockedSince: projects.blockedSince,
      revenueNet: projects.revenueNet,
      completedAt: projects.completedAt,
      stageSince: projects.stageSince,
      clienteId: contacts.id,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
      responsabile: users.name,
      responsabileEmail: users.email,
    })
    .from(projects)
    .innerJoin(projectStages, eq(projectStages.code, projects.stage))
    .innerJoin(contacts, eq(contacts.id, projects.contactId))
    .leftJoin(users, eq(users.id, projects.ownerId))
    .where(and(...condizioni))
    .orderBy(
      chiuse ? desc(projects.completedAt) : asc(projectStages.sortOrder),
      desc(projects.createdAt),
    )

  return righe.map((r) => {
    const tutti = (r.readinessBlockers ?? []) as Blocco[]
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      businessLine: r.businessLine,
      stage: r.stage,
      stageLabel: r.stageLabel,
      readinessState: r.readinessState as StatoPianificabilita,
      bloccanti: tutti.filter((b) => b.gravita === 'bloccante'),
      giorniDiBlocco:
        r.blockedSince === null
          ? null
          : Math.max(0, Math.floor((adesso - r.blockedSince.getTime()) / 86_400_000)),
      revenueNet: r.revenueNet,
      clienteId: r.clienteId,
      cliente: [r.clienteNome, r.clienteCognome].filter(Boolean).join(' '),
      responsabile: r.responsabile ?? r.responsabileEmail,
      completedAt: r.completedAt,
      chiusaDal: r.completedAt ?? r.stageSince,
    }
  })
}

/**
 * Scheda completa di una commessa.
 *
 * **I dati di costo non entrano nel risultato** se l'utente non ha
 * `canViewCosts` (§11.4 regola 7). Nasconderli nel componente non basta: il
 * payload di un Server Component finisce comunque nel browser appena un valore
 * viene passato a un componente client, e nessuno se ne accorge finché non è
 * troppo tardi. Filtrare qui rende impossibile l'errore, invece che improbabile.
 */
export async function getProjectDetail(utente: UtenteConId, id: string) {
  if (!(await commessaVisibile(utente, id))) return null

  const db = getDb()
  const mostraCosti = utente.canViewCosts

  const [riga] = await db
    .select({
      commessa: projects,
      stageLabel: projectStages.label,
      contractCode: contracts.code,
      signedAt: contracts.signedAt,
      signatureMethod: contracts.signatureMethod,
      clienteId: contacts.id,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
      responsabile: users.name,
      responsabileEmail: users.email,
      sitoLabel: sites.label,
      sitoIndirizzo: sites.addressLine,
      sitoComune: sites.city,
    })
    .from(projects)
    .innerJoin(projectStages, eq(projectStages.code, projects.stage))
    .innerJoin(contracts, eq(contracts.id, projects.contractId))
    .innerJoin(contacts, eq(contacts.id, projects.contactId))
    .leftJoin(users, eq(users.id, projects.ownerId))
    .leftJoin(sites, eq(sites.id, projects.siteId))
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1)

  if (!riga) return null

  const [documenti, files, materiali, pratiche, task, pagamenti, contabili, storico, stati, fatture] =
    await unoAllaVolta([
      () =>
        db
          .select()
          .from(documentRequirements)
          .where(eq(documentRequirements.projectId, id))
          .orderBy(asc(documentRequirements.sortOrder)),
      () =>
        db
          .select({
            id: documentFiles.id,
            requirementId: documentFiles.requirementId,
            filename: documentFiles.filename,
            mimeType: documentFiles.mimeType,
            sizeBytes: documentFiles.sizeBytes,
            versionNo: documentFiles.versionNo,
          })
          .from(documentFiles)
          .innerJoin(
            documentRequirements,
            eq(documentRequirements.id, documentFiles.requirementId),
          )
          .where(
            and(
              eq(documentRequirements.projectId, id),
              isNull(documentFiles.deletedAt),
            ),
          )
          .orderBy(desc(documentFiles.versionNo)),
      () =>
        db
          .select({
            id: projectMaterials.id,
            projectId: projectMaterials.projectId,
            productId: projectMaterials.productId,
            description: projectMaterials.description,
            unit: projectMaterials.unit,
            quantityPlanned: projectMaterials.quantityPlanned,
            quantityOrdered: projectMaterials.quantityOrdered,
            status: projectMaterials.status,
            statusSince: projectMaterials.statusSince,
            critical: projectMaterials.critical,
            supplierId: projectMaterials.supplierId,
            expectedAt: projectMaterials.expectedAt,
            notes: projectMaterials.notes,
            // I due prezzi escono solo con la capacità: senza, la colonna non
            // viene nemmeno selezionata.
            estimatedUnitCost: mostraCosti
              ? projectMaterials.estimatedUnitCost
              : sql<null>`null`,
            actualUnitCost: mostraCosti
              ? projectMaterials.actualUnitCost
              : sql<null>`null`,
          })
          .from(projectMaterials)
          .where(eq(projectMaterials.projectId, id))
          .orderBy(asc(projectMaterials.description)),
      () =>
        db.select().from(projectPractices).where(eq(projectPractices.projectId, id)),
      () =>
        db
          .select()
          .from(projectTasks)
          .where(eq(projectTasks.projectId, id))
          .orderBy(asc(projectTasks.sortOrder)),
      () =>
        db
          .select({
            milestone: paymentMilestones,
            concessoDa: users.name,
            concessoDaEmail: users.email,
          })
          .from(paymentMilestones)
          .leftJoin(users, eq(users.id, paymentMilestones.adminOkBy))
          .where(eq(paymentMilestones.projectId, id))
          .orderBy(asc(paymentMilestones.sortOrder)),
      () =>
        db
          .select({
            id: paymentReceipts.id,
            milestoneId: paymentReceipts.milestoneId,
            filename: paymentReceipts.filename,
            sizeBytes: paymentReceipts.sizeBytes,
          })
          .from(paymentReceipts)
          .innerJoin(
            paymentMilestones,
            eq(paymentMilestones.id, paymentReceipts.milestoneId),
          )
          .where(
            and(eq(paymentMilestones.projectId, id), isNull(paymentReceipts.deletedAt)),
          )
          .orderBy(desc(paymentReceipts.uploadedAt)),
      () =>
        db
          .select()
          .from(projectStatusHistory)
          .where(eq(projectStatusHistory.projectId, id))
          .orderBy(desc(projectStatusHistory.changedAt)),
      () => db.select().from(projectStages).orderBy(asc(projectStages.sortOrder)),
      () =>
        db
          .select({
            id: invoices.id,
            milestoneId: invoices.milestoneId,
            status: invoices.status,
            type: invoices.type,
            displayNumber: invoices.displayNumber,
            totale: invoices.totale,
          })
          .from(invoices)
          .where(eq(invoices.projectId, id))
          .orderBy(asc(invoices.createdAt)),
    ])

  const blocchi = (riga.commessa.readinessBlockers ?? []) as Blocco[]

  // Calcolati qui e non nel componente: leggere l'orologio durante il render
  // produce valori che cambiano a ogni ri-render.
  const adesso = Date.now()
  const giorniDiBlocco =
    riga.commessa.blockedSince === null
      ? null
      : Math.max(
          0,
          Math.floor((adesso - riga.commessa.blockedSince.getTime()) / 86_400_000),
        )

  const filePerRequisito = new Map<string, typeof files>()
  for (const f of files) {
    filePerRequisito.set(f.requirementId, [...(filePerRequisito.get(f.requirementId) ?? []), f])
  }

  // `projects` porta con sé costo e margine previsti: vanno tolti dall'oggetto,
  // non solo dalla schermata.
  const commessa = mostraCosti
    ? riga.commessa
    : { ...riga.commessa, estimatedCost: null, estimatedMargin: null }

  return {
    ...riga,
    commessa,
    giorniDiBlocco,
    documenti: documenti.map((d) => ({ ...d, files: filePerRequisito.get(d.id) ?? [] })),
    materiali,
    pratiche,
    task: task.map((t) => ({
      ...t,
      inRitardo: t.completedAt === null && t.dueAt !== null && t.dueAt.getTime() < adesso,
    })),
    pagamenti: pagamenti.map((p) => ({
      ...p.milestone,
      concessoDa: p.concessoDa ?? p.concessoDaEmail,
      contabili: contabili.filter((c) => c.milestoneId === p.milestone.id),
      fatture: fatture.filter((f) => f.milestoneId === p.milestone.id),
    })),
    storico,
    stati,
    bloccanti: blocchi.filter((b) => b.gravita === 'bloccante'),
    avvisi: blocchi.filter((b) => b.gravita === 'avviso'),
  }
}
