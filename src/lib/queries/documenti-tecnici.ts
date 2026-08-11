import { and, asc, eq, inArray } from 'drizzle-orm'
import type { Esecutore } from '@/db'
import { productDocuments } from '@/db/schema'
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
