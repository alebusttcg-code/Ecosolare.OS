import { and, asc, eq, inArray } from 'drizzle-orm'
import type { Esecutore } from '@/db'
import { productDocuments, products } from '@/db/schema'
import type { DocumentoTecnicoPreventivo } from '@/lib/pdf/premium/documenti-tecnici'

/**
 * Risolve le schede attive dei soli prodotti presenti nel preventivo.
 * La funzione e' condivisa tra generazione PDF e snapshot d'invio per evitare
 * che i due passaggi applichino regole diverse.
 */
export async function getDocumentiTecniciProdotti(
  db: Esecutore,
  productIds: readonly string[],
  riferimento = new Date(),
): Promise<readonly DocumentoTecnicoPreventivo[]> {
  const ids = [...new Set(productIds)]
  if (ids.length === 0) return []

  const documenti = await db
    .select({
      id: productDocuments.id,
      productId: productDocuments.productId,
      title: productDocuments.title,
      versionLabel: productDocuments.versionLabel,
      storageKey: productDocuments.storageKey,
      mimeType: productDocuments.mimeType,
      checksum: productDocuments.checksum,
      includedPages: productDocuments.includedPages,
      sortOrder: productDocuments.sortOrder,
      validFrom: productDocuments.validFrom,
      validUntil: productDocuments.validUntil,
    })
    .from(productDocuments)
    .where(
      and(
        inArray(productDocuments.productId, ids),
        eq(productDocuments.isActive, true),
      ),
    )
    .orderBy(asc(productDocuments.sortOrder), asc(productDocuments.title))

  return documenti
    .filter(
      (documento) =>
        (!documento.validFrom || documento.validFrom <= riferimento) &&
        (!documento.validUntil || documento.validUntil >= riferimento),
    )
    .map((documento) => ({
      id: documento.id,
      productId: documento.productId,
      title: documento.title,
      versionLabel: documento.versionLabel,
      storageKey: documento.storageKey,
      mimeType: documento.mimeType,
      checksum: documento.checksum,
      sortOrder: documento.sortOrder,
      includedPages: Array.isArray(documento.includedPages)
        ? documento.includedPages.filter(
            (pagina): pagina is number => Number.isInteger(pagina) && pagina > 0,
          )
        : null,
    }))
}

/* -------------------------------------------------------------------------- */
/*  Catalogo — vista di gestione                                               */
/* -------------------------------------------------------------------------- */

export interface SchedaProdotto {
  readonly id: string
  readonly category: 'scheda_tecnica' | 'garanzia' | 'certificazione' | 'manuale'
  readonly title: string
  readonly versionLabel: string
  readonly filename: string
  readonly includedPages: readonly number[] | null
  readonly sortOrder: number
  readonly isActive: boolean
  readonly createdAt: Date
}

export interface ProdottoConSchede {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly type: string
  readonly brand: string | null
  readonly model: string | null
  readonly componentRole: string | null
  /** Potenza di picco del singolo modulo, in Watt. */
  readonly ratedPowerW: number | null
  /** Potenza nominale in alternata dell'inverter, in kW. */
  readonly acPowerKw: string | null
  /** Capacita' di targa dell'accumulo, in kWh. */
  readonly capacityKwh: string | null
  /** Rendimento stagionale della pompa di calore. */
  readonly scop: string | null
  readonly schede: readonly SchedaProdotto[]
}

/**
 * Il catalogo con gli allegati, per la pagina di amministrazione.
 *
 * Comprende anche le schede ritirate: chi gestisce il catalogo deve poter
 * vedere che una revisione esiste ed e' stata sostituita, altrimenti la ricarica
 * uguale e si ritrova con il conflitto sulla revisione senza capire perche'.
 */
export async function getCatalogoConSchede(
  db: Esecutore,
): Promise<readonly ProdottoConSchede[]> {
  const righe = await db
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      type: products.type,
      brand: products.brand,
      model: products.model,
      componentRole: products.componentRole,
      ratedPowerW: products.ratedPowerW,
      acPowerKw: products.acPowerKw,
      capacityKwh: products.capacityKwh,
      scop: products.scop,
    })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.type), asc(products.name))

  const documenti = await db
    .select({
      id: productDocuments.id,
      productId: productDocuments.productId,
      category: productDocuments.category,
      title: productDocuments.title,
      versionLabel: productDocuments.versionLabel,
      filename: productDocuments.filename,
      includedPages: productDocuments.includedPages,
      sortOrder: productDocuments.sortOrder,
      isActive: productDocuments.isActive,
      createdAt: productDocuments.createdAt,
    })
    .from(productDocuments)
    .orderBy(asc(productDocuments.sortOrder), asc(productDocuments.title))

  const perProdotto = new Map<string, SchedaProdotto[]>()
  for (const documento of documenti) {
    const elenco = perProdotto.get(documento.productId) ?? []
    elenco.push({
      id: documento.id,
      category: documento.category,
      title: documento.title,
      versionLabel: documento.versionLabel,
      filename: documento.filename,
      includedPages: Array.isArray(documento.includedPages) ? documento.includedPages : null,
      sortOrder: documento.sortOrder,
      isActive: documento.isActive,
      createdAt: documento.createdAt,
    })
    perProdotto.set(documento.productId, elenco)
  }

  return righe.map((prodotto) => ({
    ...prodotto,
    schede: perProdotto.get(prodotto.id) ?? [],
  }))
}
