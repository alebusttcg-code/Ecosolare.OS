'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import {
  companies,
  contacts,
  invoiceLines,
  invoices,
  paymentMilestones,
  projects,
} from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import { componiFattura, componiFatturaDaMilestone } from '@/lib/domain/fattura'
import { importoAStringa, importoDaEuro } from '@/lib/domain/money'
import { prossimoNumeroFattura } from '@/lib/fatture/numerazione'
import {
  componiSnapshotCliente,
  datiFiscaliMancanti,
  type SnapshotCliente,
} from '@/lib/fatture/snapshot'
import { CHIAVI_FATTURA, getSetting } from '@/lib/settings'
import type { ActionResult } from './opportunities'

/** Un numero valido, altrimenti il fallback. Le config arrivano da jsonb. */
function numero(valore: unknown, fallback: number): number {
  const n = typeof valore === 'string' ? Number.parseFloat(valore) : Number(valore)
  return Number.isFinite(n) ? n : fallback
}

/** La ripartizione IVA come la salvano i preventivi: aliquota in %, importi stringa. */
function vatBreakdownPersistito(
  ripartizione: readonly { aliquota: number; imponibile: number; imposta: number }[],
) {
  return ripartizione.map((r) => ({
    aliquota: r.aliquota / 100,
    imponibile: importoAStringa(r.imponibile),
    imposta: importoAStringa(r.imposta),
  }))
}

/**
 * Crea la bozza di fattura per una tranche del piano pagamenti.
 *
 * Importo dalla milestone, aliquota dalla configurazione, cliente congelato in
 * uno snapshot. La bozza non ha ancora un numero: si modifica finché non viene
 * emessa.
 */
export async function creaBozzaFattura(
  milestoneId: string,
): Promise<ActionResult<{ invoiceId: string }>> {
  const utente = await guard('create', 'invoice')
  if (!z.uuid().safeParse(milestoneId).success) {
    return { ok: false, errors: { _: 'Milestone non valida.' } }
  }
  const db = getDb()

  const milestone = await db.query.paymentMilestones.findFirst({
    where: eq(paymentMilestones.id, milestoneId),
  })
  if (!milestone) return { ok: false, errors: { _: 'Milestone non trovata.' } }

  const progetto = await db.query.projects.findFirst({
    where: eq(projects.id, milestone.projectId),
    columns: { id: true, contractId: true, contactId: true },
  })
  if (!progetto) return { ok: false, errors: { _: 'Commessa non trovata.' } }

  const contatto = await db.query.contacts.findFirst({
    where: eq(contacts.id, progetto.contactId),
    columns: { firstName: true, lastName: true, taxCode: true, companyId: true },
  })
  if (!contatto) return { ok: false, errors: { _: 'Cliente non trovato.' } }

  const azienda = contatto.companyId
    ? ((await db.query.companies.findFirst({
        where: eq(companies.id, contatto.companyId),
      })) ?? null)
    : null

  const snapshot = componiSnapshotCliente(contatto, azienda)
  const aliquotaPct = numero(
    await getSetting(CHIAVI_FATTURA.aliquotaIvaDefaultPct, 10),
    10,
  )
  const totali = componiFatturaDaMilestone({
    importoNetCents: importoDaEuro(milestone.amountNet),
    aliquotaIva: Math.round(aliquotaPct * 100),
    descrizione: milestone.label,
  })

  const invoiceId = await db.transaction(async (tx) => {
    const [inv] = await tx
      .insert(invoices)
      .values({
        type: 'fattura',
        status: 'bozza',
        projectId: progetto.id,
        contractId: progetto.contractId,
        milestoneId: milestone.id,
        contactId: progetto.contactId,
        clienteSnapshot: snapshot,
        imponibile: importoAStringa(totali.imponibileCents),
        imposta: importoAStringa(totali.impostaCents),
        totale: importoAStringa(totali.totaleCents),
        vatBreakdown: vatBreakdownPersistito(totali.ripartizioneIva),
        createdBy: utente.id,
      })
      .returning({ id: invoices.id })

    await tx.insert(invoiceLines).values(
      totali.righe.map((r, i) => ({
        invoiceId: inv!.id,
        sortOrder: i,
        descrizione: r.descrizione,
        imponibile: importoAStringa(r.imponibileCents),
        aliquotaIva: (r.aliquotaIva / 100).toFixed(2),
        imposta: importoAStringa(r.impostaCents),
        natura: r.natura ?? null,
      })),
    )
    return inv!.id
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'invoice',
    entityId: invoiceId,
  })
  revalidatePath(`/cantieri/${progetto.id}`)
  return { ok: true, data: { invoiceId } }
}

/**
 * Emette la fattura: le assegna il numero progressivo (gapless, in transazione),
 * la congela e valorizza `invoicedAt` sulla milestone.
 *
 * Immutabilità (ADR-008): una fattura già emessa non si riemette. Serve un
 * identificativo fiscale del cliente, altrimenti la fattura sarebbe monca.
 */
export async function emettiFattura(
  id: string,
): Promise<ActionResult<{ displayNumber: string }>> {
  const utente = await guard('update', 'invoice')
  if (!z.uuid().safeParse(id).success) {
    return { ok: false, errors: { _: 'Fattura non valida.' } }
  }
  const db = getDb()

  const fattura = await db.query.invoices.findFirst({ where: eq(invoices.id, id) })
  if (!fattura) return { ok: false, errors: { _: 'Fattura non trovata.' } }
  if (fattura.status !== 'bozza') {
    return {
      ok: false,
      errors: { _: `Una fattura in stato "${fattura.status}" non si emette di nuovo.` },
    }
  }

  const mancanti = datiFiscaliMancanti(fattura.clienteSnapshot as SnapshotCliente)
  if (mancanti.length > 0) {
    return { ok: false, errors: { _: `Per emettere manca ${mancanti.join(' e ')}.` } }
  }

  const sezionale = String((await getSetting(CHIAVI_FATTURA.sezionaleDefault, '')) ?? '')
  const adesso = new Date()
  const year = adesso.getFullYear()

  const numeroAssegnato = await db.transaction(async (tx) => {
    const n = await prossimoNumeroFattura(tx, sezionale, year)
    await tx
      .update(invoices)
      .set({
        status: 'emessa',
        sezionale: n.sezionale,
        year: n.year,
        number: n.number,
        displayNumber: n.displayNumber,
        issuedAt: adesso,
        issuedBy: utente.id,
        dataDocumento: adesso,
        updatedAt: adesso,
      })
      .where(eq(invoices.id, id))

    if (fattura.milestoneId) {
      await tx
        .update(paymentMilestones)
        .set({ invoicedAt: adesso })
        .where(eq(paymentMilestones.id, fattura.milestoneId))
    }
    return n
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'invoice',
    entityId: id,
  })
  revalidatePath(fattura.projectId ? `/cantieri/${fattura.projectId}` : '/')
  return { ok: true, data: { displayNumber: numeroAssegnato.displayNumber } }
}

/**
 * Storna una fattura emessa con una **nota di credito** collegata: una fattura
 * emessa non si cancella né si modifica, si corregge. La nota ha il suo numero e
 * riporta gli stessi importi in negativo; l'originale passa a «stornata».
 */
export async function stornaFattura(
  id: string,
): Promise<ActionResult<{ notaId: string; displayNumber: string }>> {
  const utente = await guard('update', 'invoice')
  if (!z.uuid().safeParse(id).success) {
    return { ok: false, errors: { _: 'Fattura non valida.' } }
  }
  const db = getDb()

  const originale = await db.query.invoices.findFirst({ where: eq(invoices.id, id) })
  if (!originale) return { ok: false, errors: { _: 'Fattura non trovata.' } }
  if (!['emessa', 'esportata', 'incassata'].includes(originale.status)) {
    return {
      ok: false,
      errors: { _: `Una fattura in stato "${originale.status}" non si storna.` },
    }
  }

  const righeOriginale = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, id))

  const totali = componiFattura(
    righeOriginale.map((r) => ({
      descrizione: `Storno: ${r.descrizione}`,
      imponibileCents: -importoDaEuro(r.imponibile),
      aliquotaIva: Math.round(Number.parseFloat(r.aliquotaIva) * 100),
      natura: r.natura,
    })),
  )

  const sezionale = String((await getSetting(CHIAVI_FATTURA.sezionaleDefault, '')) ?? '')
  const adesso = new Date()
  const year = adesso.getFullYear()

  const nota = await db.transaction(async (tx) => {
    const n = await prossimoNumeroFattura(tx, sezionale, year)
    const [inserita] = await tx
      .insert(invoices)
      .values({
        type: 'nota_credito',
        status: 'emessa',
        sezionale: n.sezionale,
        year: n.year,
        number: n.number,
        displayNumber: n.displayNumber,
        projectId: originale.projectId,
        contractId: originale.contractId,
        milestoneId: originale.milestoneId,
        contactId: originale.contactId,
        correggeInvoiceId: originale.id,
        clienteSnapshot: originale.clienteSnapshot,
        imponibile: importoAStringa(totali.imponibileCents),
        imposta: importoAStringa(totali.impostaCents),
        totale: importoAStringa(totali.totaleCents),
        vatBreakdown: vatBreakdownPersistito(totali.ripartizioneIva),
        causale: `Storno della fattura ${originale.displayNumber ?? ''}`.trim(),
        issuedAt: adesso,
        issuedBy: utente.id,
        dataDocumento: adesso,
        createdBy: utente.id,
      })
      .returning({ id: invoices.id })

    await tx.insert(invoiceLines).values(
      totali.righe.map((r, i) => ({
        invoiceId: inserita!.id,
        sortOrder: i,
        descrizione: r.descrizione,
        imponibile: importoAStringa(r.imponibileCents),
        aliquotaIva: (r.aliquotaIva / 100).toFixed(2),
        imposta: importoAStringa(r.impostaCents),
        natura: r.natura ?? null,
      })),
    )

    await tx
      .update(invoices)
      .set({ status: 'stornata', updatedAt: adesso })
      .where(eq(invoices.id, id))

    return { id: inserita!.id, displayNumber: n.displayNumber }
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'invoice',
    entityId: id,
  })
  revalidatePath(originale.projectId ? `/cantieri/${originale.projectId}` : '/')
  return { ok: true, data: { notaId: nota.id, displayNumber: nota.displayNumber } }
}
