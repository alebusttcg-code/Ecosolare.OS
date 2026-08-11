import { and, asc, count, desc, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  approvals,
  companies,
  contacts,
  opportunities,
  products,
  quoteLines,
  quoteVersions,
  quotes,
  siteStudies,
  sites,
} from '@/db/schema'
import { normalizzaDossier } from '@/lib/domain/dossier-preventivo'
import { formattaImporto, importoDaEuro } from '@/lib/domain/money'
import { simulaImpiantoFv } from '@/lib/domain/simulazione-fv'
import {
  layoutsAttivi,
  type SnapshotStudioTetto,
} from '@/lib/domain/studio-tetto'
import {
  formattaDataIt,
  formattaEuroDb,
  formattaPrezzoUnitario,
  formattaQuantita,
  type DatiPdfPreventivo,
} from '@/lib/pdf/dati-preventivo'
import {
  ESCLUSO_OFFERTA,
  GARANZIE_TESTI,
  INCLUSO_FV,
  NOTA_GARANZIA,
} from '@/lib/pdf/dossier-testi'
import { mappaSimulazionePerPdf } from '@/lib/pdf/mappa-simulazione-pdf'
import { planimetriaDaStudio } from '@/lib/pdf/planimetria-moduli'
import { getParametriSimulazioneFv } from '@/lib/queries/parametri-simulazione'

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

/**
 * Carica una versione di preventivo per il PDF cliente.
 *
 * Non include costi né margini: il documento esce dall'azienda e non deve
 * rivelare prezzi di acquisto (ADR-006).
 */
export type QuoteVersionPdfBundle = {
  readonly dati: DatiPdfPreventivo
  /** Snapshot studio per ortofoto satellitare in generazione PDF. */
  readonly studio: SnapshotStudioTetto | null
}

export async function getQuoteVersionPerPdf(
  versionId: string,
): Promise<QuoteVersionPdfBundle | null> {
  const db = getDb()

  const [riga] = await db
    .select({
      quoteCode: quotes.code,
      quoteTitle: quotes.title,
      versionNo: quoteVersions.versionNo,
      status: quoteVersions.status,
      globalDiscountPct: quoteVersions.globalDiscountPct,
      revenueNet: quoteVersions.revenueNet,
      vatAmount: quoteVersions.vatAmount,
      grossTotal: quoteVersions.grossTotal,
      vatBreakdown: quoteVersions.vatBreakdown,
      validUntil: quoteVersions.validUntil,
      sentAt: quoteVersions.sentAt,
      createdAt: quoteVersions.createdAt,
      notes: quoteVersions.notes,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
      aziendaNome: companies.legalName,
      immobileEtichetta: sites.label,
      immobileVia: sites.addressLine,
      immobileCitta: sites.city,
      immobileProvincia: sites.province,
      immobileCap: sites.postalCode,
      studioModuli: siteStudies.moduliCount,
      studioKwp: siteStudies.powerKwp,
      studioProduzione: siteStudies.produzioneKwh,
      studioConsumo: siteStudies.consumoKwh,
      studioIndirizzo: siteStudies.formattedAddress,
      studioPayload: siteStudies.payload,
      dossier: quoteVersions.dossier,
    })
    .from(quoteVersions)
    .innerJoin(quotes, eq(quotes.id, quoteVersions.quoteId))
    .innerJoin(opportunities, eq(opportunities.id, quotes.opportunityId))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .leftJoin(companies, eq(companies.id, contacts.companyId))
    .leftJoin(sites, eq(sites.id, opportunities.siteId))
    .leftJoin(siteStudies, eq(siteStudies.id, quotes.siteStudyId))
    .where(eq(quoteVersions.id, versionId))
    .limit(1)

  if (!riga) return null

  const righeDb = await db
    .select({
      description: quoteLines.description,
      unit: quoteLines.unit,
      quantity: quoteLines.quantity,
      unitPrice: quoteLines.unitPrice,
      discountPct: quoteLines.discountPct,
      vatRate: quoteLines.vatRate,
      lineNet: quoteLines.lineNet,
    })
    .from(quoteLines)
    .where(eq(quoteLines.quoteVersionId, versionId))
    .orderBy(asc(quoteLines.sortOrder))

  if (righeDb.length === 0) return null

  const scontoGlobale = Number.parseFloat(riga.globalDiscountPct)
  const ripartizioneGrezza = Array.isArray(riga.vatBreakdown)
    ? (riga.vatBreakdown as { aliquota: number; imponibile: string; imposta: string }[])
    : []

  const indirizzoImmobile =
    riga.immobileVia && riga.immobileCitta
      ? [
          riga.immobileVia,
          [riga.immobileCap, riga.immobileCitta].filter(Boolean).join(' '),
          riga.immobileProvincia ? `(${riga.immobileProvincia})` : null,
        ]
          .filter(Boolean)
          .join(', ')
      : null

  const dataRiferimento = riga.sentAt ?? riga.createdAt

  const indirizzoDaStudio =
    !indirizzoImmobile && riga.studioIndirizzo ? riga.studioIndirizzo : null

  let dettagliImpianto: DatiPdfPreventivo['dettagliImpianto'] = null
  let condizioniEconomiche: DatiPdfPreventivo['condizioniEconomiche'] = null
  let simulazione: DatiPdfPreventivo['simulazione'] = null
  let planimetria: DatiPdfPreventivo['planimetria'] = null
  let copertinaKpi: DatiPdfPreventivo['copertinaKpi'] = null

  const payload = riga.studioPayload as SnapshotStudioTetto | null
  if (
    payload &&
    layoutsAttivi(payload).length > 0 &&
    payload.produzioneAnnuakWh > 0
  ) {
    const parametri = await getParametriSimulazioneFv()
    const sim = simulaImpiantoFv({
      snapshot: payload,
      investimentoLordoCents: importoDaEuro(riga.grossTotal),
      parametri,
    })
    const mappata = mappaSimulazionePerPdf(sim)
    dettagliImpianto = mappata.dettagliImpianto
    condizioniEconomiche = mappata.condizioniEconomiche
    simulazione = mappata.simulazione
    planimetria = planimetriaDaStudio(payload)
    // Stessa fonte di dettagli/planimetria/simulazione (niente colonne denormalizzate).
    if (sim.moduli > 0 && sim.kWp > 0 && sim.produzioneKwh > 0) {
      copertinaKpi = {
        moduli: sim.moduli,
        kWp: sim.kWp.toLocaleString('it-IT', { maximumFractionDigits: 2 }),
        produzioneMwh: (sim.produzioneKwh / 1000).toLocaleString('it-IT', {
          maximumFractionDigits: 2,
        }),
        consumoMwh:
          sim.consumoKwh > 0
            ? (sim.consumoKwh / 1000).toLocaleString('it-IT', {
                maximumFractionDigits: 2,
              })
            : null,
      }
    }
  }

  const dossier = normalizzaDossier(riga.dossier)
  let bloccoTermico: DatiPdfPreventivo['bloccoTermico'] = null
  if (dossier.termico?.presente) {
    const t = dossier.termico
    const prezzoCents = importoDaEuro(t.prezzoLordoEur)
    const detrazioneCents = Math.round((prezzoCents * t.detrazionePct) / 100)
    const tipoEtichetta =
      t.tipo === 'pdc'
        ? 'Pompa di calore'
        : t.tipo === 'ibrido'
          ? 'Caldaia ibrida'
          : 'Impianto termico'
    bloccoTermico = {
      tipoEtichetta,
      descrizione: t.descrizione,
      prezzoLordo: formattaImporto(prezzoCents),
      detrazionePct: `${t.detrazionePct.toLocaleString('it-IT')}%`,
      detrazioneImporto: formattaImporto(detrazioneCents),
      contoTermico:
        t.contoTermicoEur != null
          ? formattaImporto(importoDaEuro(t.contoTermicoEur))
          : null,
      nettoIndicativo: formattaImporto(prezzoCents - detrazioneCents),
    }
  }

  const studio =
    payload && layoutsAttivi(payload).length > 0 ? payload : null

  const dati: DatiPdfPreventivo = {
    codice: riga.quoteCode,
    titolo: riga.quoteTitle,
    versione: riga.versionNo,
    dataDocumento: formattaDataIt(dataRiferimento),
    validita: riga.validUntil ? formattaDataIt(riga.validUntil) : null,
    clienteNome: [riga.clienteNome, riga.clienteCognome].filter(Boolean).join(' '),
    aziendaCliente: riga.aziendaNome,
    immobileEtichetta: riga.immobileEtichetta,
    immobileIndirizzo: indirizzoImmobile ?? indirizzoDaStudio,
    copertinaKpi,
    dettagliImpianto,
    condizioniEconomiche,
    bloccoTermico,
    dossierTestuale: {
      incluso: INCLUSO_FV,
      escluso: ESCLUSO_OFFERTA,
      garanzie: GARANZIE_TESTI,
      notaGaranzia: NOTA_GARANZIA,
    },
    planimetria,
    simulazione,
    pagineMarketing: [],
    righe: righeDb.map((r) => {
      const sconto = Number.parseFloat(r.discountPct)
      return {
        descrizione: r.description,
        quantita: formattaQuantita(r.quantity),
        unita: r.unit,
        prezzoUnitario: formattaPrezzoUnitario(r.unitPrice),
        scontoPct: sconto > 0 ? `${sconto.toLocaleString('it-IT')}%` : null,
        ivaPct: `${Number.parseFloat(r.vatRate).toLocaleString('it-IT')}%`,
        importo: formattaEuroDb(r.lineNet),
      }
    }),
    scontoGlobalePct:
      scontoGlobale > 0 ? `${scontoGlobale.toLocaleString('it-IT')}%` : null,
    imponibile: formattaEuroDb(riga.revenueNet),
    ripartizioneIva: ripartizioneGrezza.map((v) => ({
      etichetta: `IVA ${Number(v.aliquota).toLocaleString('it-IT')}%`,
      imponibile: formattaEuroDb(v.imponibile),
      imposta: formattaEuroDb(v.imposta),
    })),
    totaleIva: formattaEuroDb(riga.vatAmount),
    totaleLordo: formattaEuroDb(riga.grossTotal),
    note: riga.notes?.trim() || null,
  }

  return { dati, studio }
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
