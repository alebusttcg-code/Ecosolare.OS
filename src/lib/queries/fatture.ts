import { and, asc, gte, isNotNull, lte, ne } from 'drizzle-orm'
import { getDb } from '@/db'
import { invoices } from '@/db/schema'
import { importoDaEuro } from '@/lib/domain/money'
import type { RigaRegistro } from '@/lib/fatture/export-csv'
import type { SnapshotCliente } from '@/lib/fatture/snapshot'

/**
 * Le fatture numerate (non le bozze) di un periodo, per il registro contabile.
 *
 * Ordinate per data e numero, come le legge il commercialista. Gli importi si
 * riconvertono in centesimi per il generatore CSV; il cliente e le aliquote
 * escono dallo snapshot e dalla ripartizione IVA congelati sulla fattura.
 */
export async function getFatturePerRegistro(
  dal: Date,
  al: Date,
): Promise<RigaRegistro[]> {
  const righe = await getDb()
    .select({
      displayNumber: invoices.displayNumber,
      dataDocumento: invoices.dataDocumento,
      type: invoices.type,
      clienteSnapshot: invoices.clienteSnapshot,
      vatBreakdown: invoices.vatBreakdown,
      imponibile: invoices.imponibile,
      imposta: invoices.imposta,
      totale: invoices.totale,
    })
    .from(invoices)
    .where(
      and(
        ne(invoices.status, 'bozza'),
        isNotNull(invoices.dataDocumento),
        gte(invoices.dataDocumento, dal),
        lte(invoices.dataDocumento, al),
      ),
    )
    .orderBy(asc(invoices.dataDocumento), asc(invoices.number))

  return righe.map((r) => {
    const snap = (r.clienteSnapshot ?? {}) as Partial<SnapshotCliente>
    const vat = (r.vatBreakdown ?? []) as ReadonlyArray<{ aliquota: number }>
    return {
      numero: r.displayNumber ?? '',
      data: r.dataDocumento,
      tipo: r.type,
      cliente: snap.denominazione ?? '',
      codiceFiscale: snap.codiceFiscale ?? null,
      partitaIva: snap.partitaIva ?? null,
      imponibileCents: importoDaEuro(r.imponibile),
      impostaCents: importoDaEuro(r.imposta),
      totaleCents: importoDaEuro(r.totale),
      aliquote: vat.map((v) => v.aliquota),
    }
  })
}
