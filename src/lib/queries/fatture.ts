import { and, asc, desc, eq, gte, isNotNull, lte, ne } from 'drizzle-orm'
import { getDb } from '@/db'
import { companies, contacts, invoiceLines, invoices, projects } from '@/db/schema'
import { importoDaEuro } from '@/lib/domain/money'
import type { RigaRegistro } from '@/lib/fatture/export-csv'
import type { SnapshotCliente } from '@/lib/fatture/snapshot'

export interface FatturaElenco {
  readonly id: string
  readonly displayNumber: string | null
  readonly status: 'bozza' | 'emessa' | 'esportata' | 'incassata' | 'stornata'
  readonly type: 'fattura' | 'acconto' | 'nota_credito'
  readonly dataDocumento: Date | null
  readonly createdAt: Date
  readonly totale: string
  /** Denominazione da mostrare: snapshot congelato se emessa, anagrafica se bozza. */
  readonly cliente: string
  readonly codiceFiscale: string | null
  readonly partitaIva: string | null
  readonly projectId: string | null
  readonly projectCode: string | null
}

/**
 * Tutte le fatture, per la sezione Fatturazione (amministrazione e contabilità).
 *
 * Il nome del cliente esce dallo snapshot congelato quando c'è (fattura emessa),
 * e ripiega sull'anagrafica corrente per le bozze, che lo snapshot non l'hanno
 * ancora. Così la ricerca trova «Esposito» sia su una bozza sia su una emessa.
 */
export async function getFattureElenco(): Promise<FatturaElenco[]> {
  const righe = await getDb()
    .select({
      id: invoices.id,
      displayNumber: invoices.displayNumber,
      status: invoices.status,
      type: invoices.type,
      dataDocumento: invoices.dataDocumento,
      createdAt: invoices.createdAt,
      totale: invoices.totale,
      clienteSnapshot: invoices.clienteSnapshot,
      projectId: invoices.projectId,
      projectCode: projects.code,
      contactFirst: contacts.firstName,
      contactLast: contacts.lastName,
      companyName: companies.legalName,
    })
    .from(invoices)
    .leftJoin(contacts, eq(contacts.id, invoices.contactId))
    .leftJoin(companies, eq(companies.id, contacts.companyId))
    .leftJoin(projects, eq(projects.id, invoices.projectId))
    .orderBy(desc(invoices.dataDocumento), desc(invoices.createdAt))

  return righe.map((r) => {
    const snap = (r.clienteSnapshot ?? {}) as Partial<SnapshotCliente>
    const anagrafica =
      r.companyName || [r.contactFirst, r.contactLast].filter(Boolean).join(' ')
    return {
      id: r.id,
      displayNumber: r.displayNumber,
      status: r.status,
      type: r.type,
      dataDocumento: r.dataDocumento,
      createdAt: r.createdAt,
      totale: r.totale,
      cliente: snap.denominazione || anagrafica || '—',
      codiceFiscale: snap.codiceFiscale ?? null,
      partitaIva: snap.partitaIva ?? null,
      projectId: r.projectId,
      projectCode: r.projectCode ?? null,
    }
  })
}

/**
 * Le fatture numerate (non le bozze) di un periodo, per il registro contabile.
 *
 * Ordinate per data e numero, come le legge il commercialista. Gli importi si
 * riconvertono in centesimi per il generatore CSV; il cliente e le aliquote
 * escono dallo snapshot e dalla ripartizione IVA congelati sulla fattura.
 */
/** Una fattura e le sue righe, per il PDF di cortesia. */
export async function getFatturaPerPdf(id: string) {
  const fattura = await getDb().query.invoices.findFirst({
    where: eq(invoices.id, id),
  })
  if (!fattura) return null
  const righe = await getDb()
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, id))
    .orderBy(asc(invoiceLines.sortOrder))
  return { fattura, righe }
}

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
