'use server'

import { desc, eq, like, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb, type Esecutore } from '@/db'
import {
  contracts,
  documentRequirements,
  documentTemplates,
  opportunities,
  opportunityStatusHistory,
  paymentMilestones,
  products,
  projectMaterials,
  projectPractices,
  projectStatusHistory,
  projectTasks,
  projects,
  quoteLines,
  quoteVersions,
  quotes,
  taskTemplates,
  users,
} from '@/db/schema'
import { PIANO_PAGAMENTI, PRATICHE_FV } from '@/db/templates/commessa'
import { recordEntityChange } from '@/lib/audit'
import { TIPO_CARTELLA_CLIENTE } from '@/lib/drive/gestori'
import { avviaSmaltimentoOutbox } from '@/lib/drive/avvia-outbox'
import { guard } from '@/lib/auth/session'
import { importoAStringa, importoDaEuro } from '@/lib/domain/money'
import { ricalcolaReadiness } from '@/lib/readiness'
import { accoda } from '@/lib/outbox'
import type { ActionResult } from './opportunities'

function errori(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) out[issue.path.join('.') || '_'] ??= issue.message
  return out
}

const giorni = (n: number) => new Date(Date.now() + n * 86_400_000)

/**
 * Prossimo codice progressivo.
 *
 * Riceve l'esecutore invece di prendersi il proprio: dentro una transazione
 * DEVE usare la stessa connessione, altrimenti non vede le righe appena
 * inserite e, con un pool piccolo, si blocca aspettando se stessa.
 */
async function prossimoCodice(
  db: Esecutore,
  prefisso: string,
  tabella: 'contracts' | 'projects',
) {
  const anno = new Date().getFullYear()
  const inizio = `${prefisso}-${anno}-`

  const [ultimo] =
    tabella === 'contracts'
      ? await db
          .select({ code: contracts.code })
          .from(contracts)
          .where(like(contracts.code, `${inizio}%`))
          .orderBy(desc(contracts.code))
          .limit(1)
      : await db
          .select({ code: projects.code })
          .from(projects)
          .where(like(projects.code, `${inizio}%`))
          .orderBy(desc(projects.code))
          .limit(1)

  const progressivo = ultimo ? Number.parseInt(ultimo.code.slice(inizio.length), 10) + 1 : 1
  return `${inizio}${String(progressivo).padStart(4, '0')}`
}

/* -------------------------------------------------------------------------- */
/*  Firma → commessa                                                           */
/* -------------------------------------------------------------------------- */

const firmaSchema = z.object({
  quoteVersionId: z.uuid(),
  signedAt: z.date(),
  signatureMethod: z.enum(['cartacea', 'elettronica', 'scansione']),
  ownerId: z.uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
})

/**
 * Registra la firma e apre la commessa (criterio di accettazione 11).
 *
 * Tutto avviene in una sola transazione: contratto, commessa, distinta
 * materiali, task, checklist documentale, pratiche e piano pagamenti. È la
 * differenza fra «una firma apre una commessa» e «una firma crea una riga che
 * poi qualcuno dovrà completare a mano» — che è il lavoro da un'ora a commessa
 * che il sistema esiste per eliminare (§2 del blueprint).
 */
export async function signContractAndOpenProject(
  input: z.input<typeof firmaSchema>,
): Promise<ActionResult<{ projectId: string; projectCode: string }>> {
  const utente = await guard('create', 'project')

  const parsed = firmaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()

  const [riga] = await db
    .select({
      versione: quoteVersions,
      quoteId: quotes.id,
      quoteTitle: quotes.title,
      opportunityId: opportunities.id,
      contactId: opportunities.contactId,
      siteId: opportunities.siteId,
      businessLine: opportunities.businessLine,
      ownerId: opportunities.ownerId,
    })
    .from(quoteVersions)
    .innerJoin(quotes, eq(quotes.id, quoteVersions.quoteId))
    .innerJoin(opportunities, eq(opportunities.id, quotes.opportunityId))
    .where(eq(quoteVersions.id, dati.quoteVersionId))
    .limit(1)

  if (!riga) return { ok: false, errors: { _: 'Versione di preventivo non trovata.' } }

  // Si firma ciò che è stato inviato al cliente, non una bozza interna.
  if (!['inviato', 'accettato'].includes(riga.versione.status)) {
    return {
      ok: false,
      errors: {
        _: `Non si può firmare una versione in stato "${riga.versione.status}": il cliente deve averla ricevuta.`,
      },
    }
  }

  const giaAperta = await db.query.contracts.findFirst({
    where: eq(contracts.quoteVersionId, dati.quoteVersionId),
    columns: { id: true },
  })
  if (giaAperta) {
    return { ok: false, errors: { _: 'Questa versione ha già generato un contratto.' } }
  }

  const [modelliTask, modelliDocumenti, righePreventivo] = await Promise.all([
    db.select().from(taskTemplates).where(eq(taskTemplates.isActive, true)),
    db.select().from(documentTemplates).where(eq(documentTemplates.isActive, true)),
    db.select().from(quoteLines).where(eq(quoteLines.quoteVersionId, dati.quoteVersionId)),
  ])

  const responsabili = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.isActive, true))

  /** Primo utente attivo del ruolo indicato: regola provvisoria, vedi B4. */
  const perRuolo = (ruolo: string | null) =>
    ruolo ? (responsabili.find((u) => u.role === ruolo)?.id ?? null) : null

  const risultato = await db.transaction(async (tx) => {
    const codiceContratto = await prossimoCodice(tx, 'CTR', 'contracts')
    const codiceCommessa = await prossimoCodice(tx, 'COM', 'projects')

    const [contratto] = await tx
      .insert(contracts)
      .values({
        code: codiceContratto,
        opportunityId: riga.opportunityId,
        quoteVersionId: dati.quoteVersionId,
        signedAt: dati.signedAt,
        signatureMethod: dati.signatureMethod,
        amountNet: riga.versione.revenueNet,
        notes: dati.notes ?? null,
        createdBy: utente.id,
      })
      .returning({ id: contracts.id })

    const [commessa] = await tx
      .insert(projects)
      .values({
        code: codiceCommessa,
        contractId: contratto!.id,
        contactId: riga.contactId,
        siteId: riga.siteId,
        businessLine: riga.businessLine,
        title: riga.quoteTitle,
        stage: 'contratto_ricevuto',
        ownerId: dati.ownerId ?? riga.ownerId,
        // Valori congelati alla firma: sono il termine di paragone del consuntivo.
        revenueNet: riga.versione.revenueNet,
        estimatedCost: riga.versione.costTotal,
        estimatedMargin: riga.versione.marginAmount,
        createdBy: utente.id,
        updatedBy: utente.id,
      })
      .returning({ id: projects.id, code: projects.code })

    const commessaId = commessa!.id

    await tx.insert(projectStatusHistory).values({
      projectId: commessaId,
      toStage: 'contratto_ricevuto',
      changedBy: utente.id,
    })

    /* Distinta materiali dalle righe del preventivo ------------------------ */
    const idProdotti = righePreventivo
      .map((r) => r.productId)
      .filter((id): id is string => id !== null)

    const catalogo =
      idProdotti.length > 0
        ? await tx
            .select({ id: products.id, type: products.type })
            .from(products)
            .where(sql`${products.id} in ${idProdotti}`)
        : []

    const tipoDi = new Map(catalogo.map((p) => [p.id, p.type]))

    const materiali = righePreventivo.filter((r) => {
      // Manodopera e servizi non entrano in distinta: non si ordinano.
      const tipo = r.productId ? tipoDi.get(r.productId) : undefined
      if (tipo === 'manodopera' || tipo === 'servizio') return false
      if (tipo === 'materiale' || tipo === 'kit') return true
      // Riga libera a ore: tipicamente manodopera digitata a mano.
      if (!r.productId && r.unit.trim().toLowerCase() === 'h') return false
      return true
    })

    if (materiali.length > 0) {
      await tx.insert(projectMaterials).values(
        materiali.map((r) => ({
          projectId: commessaId,
          productId: r.productId,
          description: r.description,
          unit: r.unit,
          quantityPlanned: r.quantity,
          estimatedUnitCost: r.unitCost,
          // Criticità da confermare dall'ufficio tecnico: parte da falso per
          // non bloccare cantieri su ipotesi nostre.
          critical: false,
        })),
      )
    }

    /* Task ------------------------------------------------------------------ */
    if (modelliTask.length > 0) {
      await tx.insert(projectTasks).values(
        modelliTask.map((m) => ({
          projectId: commessaId,
          label: m.label,
          description: m.description,
          assignedTo: perRuolo(m.defaultRole),
          dueAt: m.dueDaysFromStart !== null ? giorni(m.dueDaysFromStart) : null,
          sortOrder: m.sortOrder,
        })),
      )
    }

    /* Checklist documentale ------------------------------------------------- */
    if (modelliDocumenti.length > 0) {
      await tx.insert(documentRequirements).values(
        modelliDocumenti.map((m) => ({
          projectId: commessaId,
          templateId: m.id,
          code: m.code,
          label: m.label,
          mandatory: m.mandatory,
          providedByClient: m.providedByClient,
          responsibleId: perRuolo(m.defaultRole),
          dueAt: m.dueDaysFromStart !== null ? giorni(m.dueDaysFromStart) : null,
          sortOrder: m.sortOrder,
        })),
      )
    }

    /* Pratiche -------------------------------------------------------------- */
    if (riga.businessLine === 'fotovoltaico') {
      await tx.insert(projectPractices).values(
        PRATICHE_FV.map((p) => ({
          projectId: commessaId,
          code: p.code,
          label: p.label,
          blocking: p.blocking,
          responsibleId: perRuolo('contabilita'),
        })),
      )
    }

    /* Piano pagamenti ------------------------------------------------------- */
    const imponibile = importoDaEuro(riga.versione.revenueNet)
    await tx.insert(paymentMilestones).values(
      PIANO_PAGAMENTI.map((p) => ({
        projectId: commessaId,
        label: p.label,
        percentage: p.percentage.toFixed(2),
        amountNet: importoAStringa(Math.round((imponibile * p.percentage) / 100)),
        blocksStart: p.blocksStart,
        sortOrder: p.sortOrder,
      })),
    )

    /* Chiusura del lato commerciale ----------------------------------------- */
    await tx
      .update(quoteVersions)
      .set({ status: 'accettato', decidedAt: dati.signedAt, updatedAt: new Date() })
      .where(eq(quoteVersions.id, dati.quoteVersionId))

    await tx
      .update(opportunities)
      .set({
        stage: 'vinto',
        stageSince: new Date(),
        closedAt: new Date(),
        nextActionDueAt: null,
        probability: 100,
        updatedAt: new Date(),
        updatedBy: utente.id,
      })
      .where(eq(opportunities.id, riga.opportunityId))

    await tx.insert(opportunityStatusHistory).values({
      opportunityId: riga.opportunityId,
      toStage: 'vinto',
      note: `Contratto ${codiceContratto}`,
      changedBy: utente.id,
    })

    /*
     * Da qui in poi il contatto è un cliente, e gli spetta una cartella su
     * Drive (D-011). L'evento nasce dentro la transazione: o esistono la
     * commessa e l'intenzione di creare la cartella, o nessuna delle due.
     * La chiamata a Drive avviene dopo, in coda — se Drive è giù, la firma
     * del contratto non deve fallire per questo.
     */
    await accoda(tx, {
      type: TIPO_CARTELLA_CLIENTE,
      payload: { projectId: commessaId },
      dedupKey: `${TIPO_CARTELLA_CLIENTE}:${commessaId}`,
    })

    return { projectId: commessaId, projectCode: commessa!.code }
  })

  await ricalcolaReadiness(risultato.projectId)

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'project',
    entityId: risultato.projectId,
  })

  revalidatePath('/cantieri')
  revalidatePath(`/lead/${riga.opportunityId}`)
  avviaSmaltimentoOutbox()
  return { ok: true, data: risultato }
}

