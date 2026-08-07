import { and, asc, count, desc, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  approvals,
  contacts,
  opportunities,
  products,
  quoteLines,
  quoteVersions,
  quotes,
} from '@/db/schema'

export interface RigaVisibile {
  readonly id: string
  readonly productId: string | null
  readonly description: string
  readonly unit: string
  readonly quantity: number
  readonly unitPrice: number
  /** Presente solo se l'utente ha la capacita' `can_view_costs`. */
  readonly unitCost?: number
  readonly discountPct: number
  readonly vatRate: number
}

/**
 * Carica una versione di preventivo per la modifica.
 *
 * `mostraCosti` non nasconde soltanto una colonna: **decide cosa viene serializzato
 * verso il browser**. Chi non ha la capacita' non riceve i costi nel payload, non
 * solo nell'interfaccia (§11.4 regola 7). Nascondere via CSS sarebbe un finto
 * controllo: basta aprire gli strumenti per sviluppatori.
 */
export async function getQuoteVersion(versionId: string, mostraCosti: boolean) {
  const db = getDb()

  const [riga] = await db
    .select({
      versione: quoteVersions,
      quoteId: quotes.id,
      quoteCode: quotes.code,
      quoteTitle: quotes.title,
      opportunityId: opportunities.id,
      opportunityCode: opportunities.code,
      opportunityTitle: opportunities.title,
      clienteId: contacts.id,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
    })
    .from(quoteVersions)
    .innerJoin(quotes, eq(quotes.id, quoteVersions.quoteId))
    .innerJoin(opportunities, eq(opportunities.id, quotes.opportunityId))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .where(eq(quoteVersions.id, versionId))
    .limit(1)

  if (!riga) return null

  const righeDb = await db
    .select()
    .from(quoteLines)
    .where(eq(quoteLines.quoteVersionId, versionId))
    .orderBy(asc(quoteLines.sortOrder))

  const righe: RigaVisibile[] = righeDb.map((r) => ({
    id: r.id,
    productId: r.productId,
    description: r.description,
    unit: r.unit,
    quantity: Number.parseFloat(r.quantity),
    unitPrice: Number.parseFloat(r.unitPrice),
    ...(mostraCosti ? { unitCost: Number.parseFloat(r.unitCost) } : {}),
    discountPct: Number.parseFloat(r.discountPct),
    vatRate: Number.parseFloat(r.vatRate),
  }))

  const versioni = await db
    .select({
      id: quoteVersions.id,
      versionNo: quoteVersions.versionNo,
      status: quoteVersions.status,
      grossTotal: quoteVersions.grossTotal,
    })
    .from(quoteVersions)
    .where(eq(quoteVersions.quoteId, riga.quoteId))
    .orderBy(desc(quoteVersions.versionNo))

  return { ...riga, righe, versioni }
}

/** Catalogo attivo per il selettore di riga. */
export async function getCatalogo(mostraCosti: boolean) {
  const righe = await getDb()
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      unit: products.unit,
      type: products.type,
      salePrice: products.defaultSalePrice,
      costPrice: products.defaultCostPrice,
      vatRate: products.vatRate,
    })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.name))

  return righe.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    unit: r.unit,
    type: r.type,
    prezzo: r.salePrice ? Number.parseFloat(r.salePrice) : 0,
    ...(mostraCosti && r.costPrice ? { costo: Number.parseFloat(r.costPrice) } : {}),
    iva: Number.parseFloat(r.vatRate),
  }))
}

/** Richieste di approvazione in attesa: alimenta il contatore nel menu. */
export async function contaApprovazioniInAttesa(): Promise<number> {
  const [riga] = await getDb()
    .select({ totale: count() })
    .from(approvals)
    .where(
      and(eq(approvals.status, 'richiesta'), eq(approvals.entityType, 'quote_version')),
    )
  return riga?.totale ?? 0
}

/** I preventivi di un'opportunita', con la versione corrente. */
export async function getQuotesForOpportunity(opportunityId: string) {
  const db = getDb()
  return db
    .select({
      id: quotes.id,
      code: quotes.code,
      title: quotes.title,
      versionId: quoteVersions.id,
      versionNo: quoteVersions.versionNo,
      status: quoteVersions.status,
      grossTotal: quoteVersions.grossTotal,
      marginPct: quoteVersions.marginPct,
      sentAt: quoteVersions.sentAt,
    })
    .from(quotes)
    .leftJoin(quoteVersions, eq(quoteVersions.id, quotes.currentVersionId))
    .where(eq(quotes.opportunityId, opportunityId))
    .orderBy(desc(quotes.createdAt))
}
