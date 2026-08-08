import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql, type AnyColumn } from 'drizzle-orm'
import type { PeriodoEconomia } from '@/lib/domain/periodo-economia'
import { getDb } from '@/db'
import {
  contacts,
  contracts,
  opportunities,
  paymentMilestones,
  pipelineStages,
  projectStages,
  projects,
  quoteVersions,
  quotes,
} from '@/db/schema'
import { importoDaEuro } from '@/lib/domain/money'

/** Stati di preventivo ancora «aperti» (non conclusi dal cliente). */
const PREVENTIVI_APERTI = ['bozza', 'in_approvazione', 'approvato', 'inviato'] as const

export interface PanoramicaEconomica {
  readonly fatturatoTotale: number
  readonly incassatoTotale: number
  readonly daIncassare: number
  readonly preventiviApertiImporto: number
  readonly preventiviApertiConteggio: number
  readonly marginePrevistoAperto: number | null
  readonly contrattiFirmatiImporto: number
  readonly contrattiFirmatiConteggio: number
  readonly commesseAttiveImporto: number
  readonly commesseAttiveConteggio: number
  readonly incassiPrevisti: number
  readonly incassiPrevistiConteggio: number
}

function sommaNumeric(colonna: AnyColumn) {
  return sql<string>`coalesce(sum(${colonna}), 0)`
}

function nelPeriodo(colonna: AnyColumn, da: Date, a: Date) {
  return and(gte(colonna, da), lte(colonna, a))
}

/** Data nel periodo: preferisce la colonna primaria, altrimenti il fallback (senza coalesce SQL). */
function nelPeriodoPreferendo(
  preferita: AnyColumn,
  fallback: AnyColumn,
  da: Date,
  a: Date,
) {
  return or(
    and(isNotNull(preferita), nelPeriodo(preferita, da, a)),
    and(isNull(preferita), nelPeriodo(fallback, da, a)),
  )
}

/**
 * Aggregati economici per la direzione.
 *
 * Tutti gli importi sono in centesimi di euro (vedi `lib/domain/money.ts`).
 * Nessun dato di costo esce da qui verso chi non ha `canViewCosts`: la pagina
 * è riservata all'amministratore, ma il tipo resta esplicito.
 */
export async function getPanoramicaEconomica(
  mostraCosti: boolean,
  periodo: PeriodoEconomia,
): Promise<PanoramicaEconomica> {
  const db = getDb()
  const { da, a } = periodo

  const [
    [fatturatoRiga],
    [incassatoRiga],
    [preventiviAperti],
    [contratti],
    [commesse],
    [previsti],
  ] = await Promise.all([
    db
      .select({ totale: sommaNumeric(paymentMilestones.amountNet) })
      .from(paymentMilestones)
      .where(
        and(
          inArray(paymentMilestones.status, ['fatturato', 'incassato']),
          nelPeriodoPreferendo(paymentMilestones.invoicedAt, paymentMilestones.paidAt, da, a),
        ),
      ),

    db
      .select({ totale: sommaNumeric(paymentMilestones.amountNet) })
      .from(paymentMilestones)
      .where(
        and(
          eq(paymentMilestones.status, 'incassato'),
          nelPeriodo(paymentMilestones.paidAt, da, a),
        ),
      ),

    db
      .select({
        importo: sommaNumeric(quoteVersions.grossTotal),
        margine: mostraCosti
          ? sommaNumeric(quoteVersions.marginAmount)
          : sql<string>`'0'`,
        conteggio: sql<number>`count(*)::int`,
      })
      .from(quotes)
      .innerJoin(quoteVersions, eq(quoteVersions.id, quotes.currentVersionId))
      .innerJoin(opportunities, eq(opportunities.id, quotes.opportunityId))
      .innerJoin(pipelineStages, eq(pipelineStages.code, opportunities.stage))
      .where(
        and(
          isNull(opportunities.deletedAt),
          eq(pipelineStages.isOpen, true),
          inArray(quoteVersions.status, [...PREVENTIVI_APERTI]),
          nelPeriodoPreferendo(quoteVersions.sentAt, quotes.createdAt, da, a),
        ),
      ),

    db
      .select({
        importo: sommaNumeric(contracts.amountNet),
        conteggio: sql<number>`count(*)::int`,
      })
      .from(contracts)
      .where(nelPeriodo(contracts.signedAt, da, a)),

    db
      .select({
        importo: sommaNumeric(projects.revenueNet),
        conteggio: sql<number>`count(*)::int`,
      })
      .from(projects)
      .innerJoin(projectStages, eq(projectStages.code, projects.stage))
      .where(
        and(
          isNull(projects.deletedAt),
          eq(projectStages.isClosed, false),
          nelPeriodo(projects.createdAt, da, a),
        ),
      ),

    db
      .select({
        importo: sommaNumeric(paymentMilestones.amountNet),
        conteggio: sql<number>`count(*)::int`,
      })
      .from(paymentMilestones)
      .where(
        and(
          eq(paymentMilestones.status, 'previsto'),
          nelPeriodo(paymentMilestones.dueAt, da, a),
        ),
      ),
  ])

  const fatturatoTotale = importoDaEuro(fatturatoRiga?.totale ?? '0')
  const incassatoTotale = importoDaEuro(incassatoRiga?.totale ?? '0')

  return {
    fatturatoTotale,
    incassatoTotale,
    daIncassare: Math.max(0, fatturatoTotale - incassatoTotale),
    preventiviApertiImporto: importoDaEuro(preventiviAperti?.importo ?? '0'),
    preventiviApertiConteggio: preventiviAperti?.conteggio ?? 0,
    marginePrevistoAperto: mostraCosti
      ? importoDaEuro(preventiviAperti?.margine ?? '0')
      : null,
    contrattiFirmatiImporto: importoDaEuro(contratti?.importo ?? '0'),
    contrattiFirmatiConteggio: contratti?.conteggio ?? 0,
    commesseAttiveImporto: importoDaEuro(commesse?.importo ?? '0'),
    commesseAttiveConteggio: commesse?.conteggio ?? 0,
    incassiPrevisti: importoDaEuro(previsti?.importo ?? '0'),
    incassiPrevistiConteggio: previsti?.conteggio ?? 0,
  }
}

export interface PreventivoApertoInElenco {
  readonly versionId: string
  readonly opportunityId: string
  readonly code: string
  readonly titolo: string
  readonly cliente: string
  readonly totale: number
  readonly marginePct: number | null
  readonly stato: string
  readonly inviatoIl: Date | null
}

/** Dettaglio sintetico dei preventivi aperti (solo per la pagina Economia). */
export async function elencoPreventiviAperti(
  periodo: PeriodoEconomia,
  limite = 8,
): Promise<readonly PreventivoApertoInElenco[]> {
  const db = getDb()
  const { da, a } = periodo

  const righe = await db
    .select({
      versionId: quoteVersions.id,
      opportunityId: opportunities.id,
      code: quotes.code,
      titolo: quotes.title,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      totale: quoteVersions.grossTotal,
      marginePct: quoteVersions.marginPct,
      stato: quoteVersions.status,
      inviatoIl: quoteVersions.sentAt,
    })
    .from(quotes)
    .innerJoin(quoteVersions, eq(quoteVersions.id, quotes.currentVersionId))
    .innerJoin(opportunities, eq(opportunities.id, quotes.opportunityId))
    .innerJoin(pipelineStages, eq(pipelineStages.code, opportunities.stage))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .where(
      and(
        isNull(opportunities.deletedAt),
        isNull(contacts.deletedAt),
        eq(pipelineStages.isOpen, true),
        inArray(quoteVersions.status, [...PREVENTIVI_APERTI]),
        nelPeriodoPreferendo(quoteVersions.sentAt, quotes.createdAt, da, a),
      ),
    )
    .orderBy(desc(quoteVersions.sentAt), desc(quotes.createdAt))
    .limit(limite)

  return righe.map((r) => ({
    versionId: r.versionId,
    opportunityId: r.opportunityId,
    code: r.code,
    titolo: r.titolo,
    cliente: [r.firstName, r.lastName].filter(Boolean).join(' '),
    totale: importoDaEuro(r.totale),
    marginePct: r.marginePct ? Number.parseFloat(r.marginePct) : null,
    stato: r.stato,
    inviatoIl: r.inviatoIl,
  }))
}
