'use server'

import { and, desc, eq, inArray, like, max } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb, type Esecutore } from '@/db'
import {
  approvals,
  contracts,
  products,
  quoteLines,
  quoteVersions,
  quotes,
} from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import {
  importoAStringa,
  percentualeDaNumero,
  prezzoDaEuro,
  quantitaDaNumero,
} from '@/lib/domain/money'
import { calcolaPreventivo, valutaSoglia, type RigaCalcolo } from '@/lib/domain/pricing'
import {
  puoEliminarePreventivo,
  puoInviare,
  puoModificare,
  registraEsitoCliente,
  type StatoVersione,
} from '@/lib/domain/quote-lifecycle'
import { unitaRichiedeIntero } from '@/lib/domain/unita'
import type { ActionResult } from './opportunities'

function errori(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) out[issue.path.join('.') || '_'] ??= issue.message
  return out
}

/** Soglia minima di marginalita', configurabile per linea di business. */
async function sogliaMargine(): Promise<number> {
  const { CHIAVI_MARGINE, getSetting } = await import('@/lib/settings')
  const valore = await getSetting(CHIAVI_MARGINE.sogliaMarginePct, 20)
  return percentualeDaNumero(valore)
}

async function prossimoCodicePreventivo(db: Esecutore, anno: number): Promise<string> {
  const prefisso = `PRV-${anno}-`
  const [ultimo] = await db
    .select({ code: quotes.code })
    .from(quotes)
    .where(like(quotes.code, `${prefisso}%`))
    .orderBy(desc(quotes.code))
    .limit(1)

  const progressivo = ultimo ? Number.parseInt(ultimo.code.slice(prefisso.length), 10) + 1 : 1
  return `${prefisso}${String(progressivo).padStart(4, '0')}`
}

/* -------------------------------------------------------------------------- */

const creaSchema = z.object({
  opportunityId: z.uuid(),
  title: z.string().trim().min(1, 'Indicare un titolo').max(160),
})

export async function createQuote(
  input: z.input<typeof creaSchema>,
): Promise<ActionResult<{ quoteId: string; versionId: string; code: string }>> {
  const utente = await guard('create', 'quote')

  const parsed = creaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  const risultato = await getDb().transaction(async (tx) => {
    const code = await prossimoCodicePreventivo(tx, new Date().getFullYear())

    const [quote] = await tx
      .insert(quotes)
      .values({
        code,
        opportunityId: parsed.data.opportunityId,
        title: parsed.data.title,
        createdBy: utente.id,
      })
      .returning({ id: quotes.id, code: quotes.code })

    const [versione] = await tx
      .insert(quoteVersions)
      .values({ quoteId: quote!.id, versionNo: 1, createdBy: utente.id })
      .returning({ id: quoteVersions.id })

    await tx
      .update(quotes)
      .set({ currentVersionId: versione!.id })
      .where(eq(quotes.id, quote!.id))

    return { quoteId: quote!.id, versionId: versione!.id, code: quote!.code }
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'quote',
    entityId: risultato.quoteId,
  })

  revalidatePath(`/lead/${parsed.data.opportunityId}`)
  return { ok: true, data: risultato }
}

/* -------------------------------------------------------------------------- */

const rigaSchema = z
  .object({
    /** Presente per le righe gia' esistenti: serve a conservarne il costo. */
    id: z.uuid().optional(),
    productId: z.uuid().optional(),
    description: z.string().trim().min(1, 'Descrizione obbligatoria').max(300),
    unit: z.string().trim().max(12).default('pz'),
    quantity: z.number().positive('La quantità deve essere maggiore di zero'),
    unitPrice: z.number().min(0),
    /**
     * Assente per chi non ha la capacita' `can_view_costs`: a quegli utenti il
     * costo non viene nemmeno inviato, quindi non puo' tornare indietro.
     * Il server lo ricostruisce (vedere `risolviCosto`).
     */
    unitCost: z.number().min(0).optional(),
    discountPct: z.number().min(0).max(100).default(0),
    vatRate: z.number().min(0).max(100).default(10),
  })
  .superRefine((riga, ctx) => {
    if (unitaRichiedeIntero(riga.unit) && !Number.isInteger(riga.quantity)) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: `Con unità «${riga.unit}» la quantità deve essere un numero intero.`,
      })
    }
  })

const salvaRigheSchema = z.object({
  versionId: z.uuid(),
  globalDiscountPct: z.number().min(0).max(100).default(0),
  righe: z.array(rigaSchema).max(200),
  notes: z.string().trim().max(4000).optional(),
  validUntil: z.date().optional(),
})

/**
 * Sostituisce le righe di una versione e ne ricalcola i totali.
 *
 * I totali NON arrivano mai dal client (§8.4): il browser propone, il server
 * calcola. E' l'unico modo perche' il margine salvato corrisponda alle righe.
 */
export async function saveQuoteLines(
  input: z.input<typeof salvaRigheSchema>,
): Promise<ActionResult<{ marginePct: number | null; sottoSoglia: boolean; righeSenzaCosto: string[] }>> {
  const utente = await guard('update', 'quote')

  const parsed = salvaRigheSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()
  const versione = await db.query.quoteVersions.findFirst({
    where: eq(quoteVersions.id, dati.versionId),
  })
  if (!versione) return { ok: false, errors: { _: 'Versione non trovata.' } }

  if (!puoModificare(versione.status)) {
    return {
      ok: false,
      errors: {
        _: `Una versione in stato "${versione.status}" non è modificabile. Crea una nuova versione.`,
      },
    }
  }

  /**
   * Ricostruisce il costo unitario di una riga.
   *
   * Il commerciale senza `can_view_costs` non riceve i costi nel browser, quindi
   * non puo' rimandarli indietro: il server li recupera dalla riga precedente o
   * dal catalogo. Senza questo passaggio, ogni salvataggio azzererebbe i costi
   * e il margine risulterebbe pari al fatturato — l'errore piu' pericoloso
   * possibile in questo modulo, perche' sembra un ottimo risultato.
   */
  const esistenti = new Map(
    (await db.select().from(quoteLines).where(eq(quoteLines.quoteVersionId, dati.versionId)))
      .map((r) => [r.id, r]),
  )

  const idProdotti = dati.righe.map((r) => r.productId).filter((id): id is string => !!id)
  const catalogo = new Map(
    idProdotti.length > 0
      ? (
          await db
            .select({ id: products.id, costo: products.defaultCostPrice })
            .from(products)
            .where(inArray(products.id, idProdotti))
        ).map((p) => [p.id, p.costo])
      : [],
  )

  const senzaCostoNoto: string[] = []

  function risolviCosto(riga: (typeof dati.righe)[number]): number {
    if (utente.canViewCosts && riga.unitCost !== undefined) return riga.unitCost

    const precedente = riga.id ? esistenti.get(riga.id) : undefined
    if (precedente) return Number.parseFloat(precedente.unitCost)

    const daCatalogo = riga.productId ? catalogo.get(riga.productId) : undefined
    if (daCatalogo) return Number.parseFloat(daCatalogo)

    // Riga libera creata da chi non vede i costi: il costo resta ignoto.
    // Non si finge che sia zero senza dirlo.
    senzaCostoNoto.push(riga.description)
    return 0
  }

  const costiRisolti = dati.righe.map(risolviCosto)

  const perCalcolo: RigaCalcolo[] = dati.righe.map((r, indice) => ({
    quantita: quantitaDaNumero(r.quantity),
    prezzoUnitario: prezzoDaEuro(r.unitPrice),
    costoUnitario: prezzoDaEuro(costiRisolti[indice] ?? 0),
    scontoPct: percentualeDaNumero(r.discountPct),
    aliquotaIva: percentualeDaNumero(r.vatRate),
  }))

  const totali = calcolaPreventivo(perCalcolo, percentualeDaNumero(dati.globalDiscountPct))
  const soglia = await sogliaMargine()
  const esitoSoglia = valutaSoglia(totali.marginePct, soglia)

  await db.transaction(async (tx) => {
    await tx.delete(quoteLines).where(eq(quoteLines.quoteVersionId, dati.versionId))

    if (dati.righe.length > 0) {
      await tx.insert(quoteLines).values(
        dati.righe.map((r, indice) => ({
          quoteVersionId: dati.versionId,
          sortOrder: indice,
          productId: r.productId ?? null,
          description: r.description,
          unit: r.unit,
          quantity: r.quantity.toFixed(3),
          unitCost: (costiRisolti[indice] ?? 0).toFixed(4),
          unitPrice: r.unitPrice.toFixed(4),
          discountPct: r.discountPct.toFixed(2),
          vatRate: r.vatRate.toFixed(2),
          lineNet: importoAStringa(totali.righe[indice]?.imponibile ?? 0),
          lineCost: importoAStringa(totali.righe[indice]?.costo ?? 0),
        })),
      )
    }

    await tx
      .update(quoteVersions)
      .set({
        globalDiscountPct: dati.globalDiscountPct.toFixed(2),
        revenueNet: importoAStringa(totali.imponibile),
        costTotal: importoAStringa(totali.costoTotale),
        marginAmount: importoAStringa(totali.margine),
        marginPct:
          totali.marginePct === null ? null : (totali.marginePct / 100).toFixed(2),
        vatAmount: importoAStringa(totali.imposta),
        grossTotal: importoAStringa(totali.totale),
        vatBreakdown: totali.ripartizioneIva.map((v) => ({
          aliquota: v.aliquota / 100,
          imponibile: importoAStringa(v.imponibile),
          imposta: importoAStringa(v.imposta),
        })),
        notes: dati.notes ?? null,
        validUntil: dati.validUntil ?? null,
        updatedAt: new Date(),
      })
      .where(eq(quoteVersions.id, dati.versionId))
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'quote_version',
    entityId: dati.versionId,
    before: { revenueNet: versione.revenueNet, marginAmount: versione.marginAmount },
    after: {
      revenueNet: importoAStringa(totali.imponibile),
      marginAmount: importoAStringa(totali.margine),
    },
  })

  revalidatePath(`/preventivi/${dati.versionId}`)
  return {
    ok: true,
    data: {
      marginePct: totali.marginePct,
      sottoSoglia: esitoSoglia === 'sotto_soglia',
      righeSenzaCosto: senzaCostoNoto,
    },
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Invia il preventivo al cliente, oppure ne richiede l'approvazione se il
 * margine e' sotto soglia.
 *
 * Il momento dell'invio e' quello in cui la versione diventa immutabile e viene
 * congelato lo snapshot (ADR-008).
 */
export async function sendQuote(versionId: string): Promise<ActionResult<{ inviato: boolean }>> {
  const utente = await guard('update', 'quote')

  if (!z.uuid().safeParse(versionId).success) {
    return { ok: false, errors: { _: 'Identificativo non valido.' } }
  }

  const db = getDb()
  const versione = await db.query.quoteVersions.findFirst({
    where: eq(quoteVersions.id, versionId),
  })
  if (!versione) return { ok: false, errors: { _: 'Versione non trovata.' } }

  const righe = await db
    .select()
    .from(quoteLines)
    .where(eq(quoteLines.quoteVersionId, versionId))

  const soglia = await sogliaMargine()
  const marginePct =
    versione.marginPct === null ? null : percentualeDaNumero(versione.marginPct)
  const esitoSoglia = valutaSoglia(marginePct, soglia)

  const verifica = puoInviare({
    stato: versione.status,
    esitoSoglia,
    haRighe: righe.length > 0,
  })

  if (!verifica.ok) {
    if (!verifica.richiedeApprovazione) return { ok: false, errors: { _: verifica.motivo } }

    // Sotto soglia: si apre la richiesta di approvazione invece di inviare.
    await db.transaction(async (tx) => {
      await tx
        .update(quoteVersions)
        .set({ status: 'in_approvazione', updatedAt: new Date() })
        .where(eq(quoteVersions.id, versionId))

      await tx
        .insert(approvals)
        .values({
          entityType: 'quote_version',
          entityId: versionId,
          reason: 'Margine sotto la soglia minima',
          context: {
            marginePct: versione.marginPct,
            sogliaPct: (soglia / 100).toFixed(2),
            imponibile: versione.revenueNet,
          },
          requestedBy: utente.id,
        })
        // Doppio click o rilancio: la richiesta pendente resta una sola.
        .onConflictDoNothing()
    })

    revalidatePath('/approvazioni')
    revalidatePath(`/preventivi/${versionId}`)
    return { ok: true, data: { inviato: false } }
  }

  const adesso = new Date()
  await db
    .update(quoteVersions)
    .set({
      status: 'inviato',
      sentAt: adesso,
      // Snapshot delle condizioni al momento dell'invio: il documento deve
      // restare ricostruibile identico anche se il catalogo cambia domani.
      snapshot: {
        inviatoIl: adesso.toISOString(),
        sogliaMarginePct: (soglia / 100).toFixed(2),
        totali: {
          imponibile: versione.revenueNet,
          costo: versione.costTotal,
          margine: versione.marginAmount,
          marginePct: versione.marginPct,
          imposta: versione.vatAmount,
          totale: versione.grossTotal,
        },
        righe: righe.map((r) => ({
          descrizione: r.description,
          quantita: r.quantity,
          unita: r.unit,
          prezzoUnitario: r.unitPrice,
          costoUnitario: r.unitCost,
          scontoPct: r.discountPct,
          aliquotaIva: r.vatRate,
          imponibile: r.lineNet,
        })),
      },
      updatedAt: adesso,
    })
    .where(eq(quoteVersions.id, versionId))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'quote_version',
    entityId: versionId,
    before: { status: versione.status },
    after: { status: 'inviato' },
  })

  revalidatePath(`/preventivi/${versionId}`)
  return { ok: true, data: { inviato: true } }
}

/* -------------------------------------------------------------------------- */

const decisioneSchema = z.object({
  approvalId: z.uuid(),
  approva: z.boolean(),
  nota: z.string().trim().max(500).optional(),
})

/** Approvazione o rifiuto di un preventivo sotto soglia. Solo amministratore. */
export async function decideApproval(
  input: z.input<typeof decisioneSchema>,
): Promise<ActionResult> {
  const utente = await guard('approve', 'quote_approval')

  const parsed = decisioneSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()
  const richiesta = await db.query.approvals.findFirst({
    where: eq(approvals.id, dati.approvalId),
  })
  if (!richiesta) return { ok: false, errors: { _: 'Richiesta non trovata.' } }
  if (richiesta.status !== 'richiesta') {
    return { ok: false, errors: { _: 'Richiesta già decisa.' } }
  }

  // Chi ha chiesto l'approvazione non puo' concedersela da solo, nemmeno se e'
  // amministratore: e' il senso stesso del passaggio.
  if (richiesta.requestedBy === utente.id) {
    return {
      ok: false,
      errors: { _: 'Non puoi approvare una richiesta che hai presentato tu.' },
    }
  }

  const adesso = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(approvals)
      .set({
        status: dati.approva ? 'approvata' : 'respinta',
        decidedBy: utente.id,
        decidedAt: adesso,
        decisionNote: dati.nota ?? null,
      })
      .where(eq(approvals.id, dati.approvalId))

    await tx
      .update(quoteVersions)
      // Respinta: torna in bozza, cosi' il commerciale puo' rivedere i numeri.
      .set({ status: dati.approva ? 'approvato' : 'bozza', updatedAt: adesso })
      .where(eq(quoteVersions.id, richiesta.entityId))
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'approve',
    entityType: 'quote_version',
    entityId: richiesta.entityId,
  })

  revalidatePath('/approvazioni')
  revalidatePath(`/preventivi/${richiesta.entityId}`)
  return { ok: true, data: undefined }
}

/* -------------------------------------------------------------------------- */

/** Crea una nuova versione a partire da quella corrente, copiandone le righe. */
export async function newQuoteVersion(
  quoteId: string,
): Promise<ActionResult<{ versionId: string; versionNo: number }>> {
  const utente = await guard('create', 'quote')

  if (!z.uuid().safeParse(quoteId).success) {
    return { ok: false, errors: { _: 'Identificativo non valido.' } }
  }

  const db = getDb()
  const preventivo = await db.query.quotes.findFirst({ where: eq(quotes.id, quoteId) })
  if (!preventivo) return { ok: false, errors: { _: 'Preventivo non trovato.' } }

  const [ultima] = await db
    .select({ massimo: max(quoteVersions.versionNo) })
    .from(quoteVersions)
    .where(eq(quoteVersions.quoteId, quoteId))

  const precedente = preventivo.currentVersionId
    ? await db.query.quoteVersions.findFirst({
        where: eq(quoteVersions.id, preventivo.currentVersionId),
      })
    : undefined

  const nuovoNumero = (ultima?.massimo ?? 0) + 1

  const risultato = await db.transaction(async (tx) => {
    const [versione] = await tx
      .insert(quoteVersions)
      .values({
        quoteId,
        versionNo: nuovoNumero,
        status: 'bozza',
        globalDiscountPct: precedente?.globalDiscountPct ?? '0.00',
        notes: precedente?.notes ?? null,
        termsAndConditions: precedente?.termsAndConditions ?? null,
        createdBy: utente.id,
      })
      .returning({ id: quoteVersions.id })

    if (precedente) {
      const righe = await tx
        .select()
        .from(quoteLines)
        .where(eq(quoteLines.quoteVersionId, precedente.id))

      if (righe.length > 0) {
        await tx.insert(quoteLines).values(
          righe.map((r) => ({
            quoteVersionId: versione!.id,
            sortOrder: r.sortOrder,
            productId: r.productId,
            description: r.description,
            unit: r.unit,
            quantity: r.quantity,
            unitCost: r.unitCost,
            unitPrice: r.unitPrice,
            discountPct: r.discountPct,
            vatRate: r.vatRate,
            lineNet: r.lineNet,
            lineCost: r.lineCost,
          })),
        )
      }

      // I totali si ereditano dalla versione precedente: le righe sono identiche
      // finche' qualcuno non le modifica.
      await tx
        .update(quoteVersions)
        .set({
          revenueNet: precedente.revenueNet,
          costTotal: precedente.costTotal,
          marginAmount: precedente.marginAmount,
          marginPct: precedente.marginPct,
          vatAmount: precedente.vatAmount,
          grossTotal: precedente.grossTotal,
          vatBreakdown: precedente.vatBreakdown,
        })
        .where(eq(quoteVersions.id, versione!.id))
    }

    await tx
      .update(quotes)
      .set({ currentVersionId: versione!.id })
      .where(eq(quotes.id, quoteId))

    return { versionId: versione!.id, versionNo: nuovoNumero }
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'quote_version',
    entityId: risultato.versionId,
  })

  revalidatePath(`/preventivi/${risultato.versionId}`)
  return { ok: true, data: risultato }
}

/* -------------------------------------------------------------------------- */

const esitoSchema = z.object({
  versionId: z.uuid(),
  esito: z.enum(['accettato', 'rifiutato']),
  motivoRifiuto: z.string().trim().max(400).optional(),
})

/** Registra la risposta del cliente a un preventivo inviato. */
export async function recordQuoteOutcome(
  input: z.input<typeof esitoSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'quote')

  const parsed = esitoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()
  const versione = await db.query.quoteVersions.findFirst({
    where: eq(quoteVersions.id, dati.versionId),
  })
  if (!versione) return { ok: false, errors: { _: 'Versione non trovata.' } }

  const esito = registraEsitoCliente(
    versione.status,
    dati.esito,
    dati.motivoRifiuto ?? null,
  )
  if (!esito.ok) {
    return {
      ok: false,
      errors: { [dati.esito === 'rifiutato' ? 'motivoRifiuto' : '_']: esito.motivo },
    }
  }

  await db
    .update(quoteVersions)
    .set({
      status: esito.nuovoStato,
      decidedAt: new Date(),
      rejectionReason: dati.motivoRifiuto ?? null,
      updatedAt: new Date(),
    })
    .where(eq(quoteVersions.id, dati.versionId))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'quote_version',
    entityId: dati.versionId,
    before: { status: versione.status },
    after: { status: esito.nuovoStato },
  })

  revalidatePath(`/preventivi/${dati.versionId}`)
  return { ok: true, data: undefined }
}

/* -------------------------------------------------------------------------- */

/**
 * Elimina un preventivo non ancora inviato al cliente.
 *
 * Usa `update` sul permesso quote (non `delete`): in matrice il commerciale ha
 * scrittura sui preventivi ma non il livello full; togliere una bozza fa parte
 * della gestione quotidiana. Dopo l'invio la cancellazione è negata (ADR-008).
 */
export async function deleteQuote(
  quoteId: string,
): Promise<ActionResult<{ opportunityId: string }>> {
  const utente = await guard('update', 'quote')

  if (!z.uuid().safeParse(quoteId).success) {
    return { ok: false, errors: { _: 'Identificativo non valido.' } }
  }

  const db = getDb()
  const preventivo = await db.query.quotes.findFirst({ where: eq(quotes.id, quoteId) })
  if (!preventivo) return { ok: false, errors: { _: 'Preventivo non trovato.' } }

  const versioni = await db
    .select({
      id: quoteVersions.id,
      status: quoteVersions.status,
      sentAt: quoteVersions.sentAt,
    })
    .from(quoteVersions)
    .where(eq(quoteVersions.quoteId, quoteId))

  const corrente = preventivo.currentVersionId
    ? versioni.find((v) => v.id === preventivo.currentVersionId)
    : versioni[0]

  if (!corrente || !puoEliminarePreventivo(corrente.status as StatoVersione)) {
    return {
      ok: false,
      errors: {
        _: 'Si possono eliminare solo preventivi non ancora inviati al cliente.',
      },
    }
  }

  if (versioni.some((v) => v.sentAt !== null)) {
    return {
      ok: false,
      errors: {
        _: 'Questo preventivo ha già una versione inviata: non si elimina.',
      },
    }
  }

  const versioneIds = versioni.map((v) => v.id)
  if (versioneIds.length > 0) {
    const [contratto] = await db
      .select({ id: contracts.id })
      .from(contracts)
      .where(inArray(contracts.quoteVersionId, versioneIds))
      .limit(1)
    if (contratto) {
      return {
        ok: false,
        errors: { _: 'Esiste un contratto collegato: il preventivo non si elimina.' },
      }
    }
  }

  await db.transaction(async (tx) => {
    if (versioneIds.length > 0) {
      await tx
        .delete(approvals)
        .where(
          and(eq(approvals.entityType, 'quote_version'), inArray(approvals.entityId, versioneIds)),
        )
    }
    await tx
      .update(quotes)
      .set({ currentVersionId: null })
      .where(eq(quotes.id, quoteId))
    await tx.delete(quotes).where(eq(quotes.id, quoteId))
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'delete',
    entityType: 'quote',
    entityId: quoteId,
    before: { code: preventivo.code, title: preventivo.title },
  })

  revalidatePath('/preventivi')
  revalidatePath(`/lead/${preventivo.opportunityId}`)
  revalidatePath('/economia')
  return { ok: true, data: { opportunityId: preventivo.opportunityId } }
}

