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
  users,
} from '@/db/schema'
import { ECOSOLARE } from '@/lib/brand/ecosolare'
import { normalizzaDossier } from '@/lib/domain/dossier-preventivo'
import { formattaImporto, importoDaEuro } from '@/lib/domain/money'
import {
  leggiConfigurazione,
  nomeComponente,
  prezzoTermicoEffettivoCents,
  quantitaEComponente,
  scopEffettivo,
} from '@/lib/domain/componenti-impianto'
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
  ATTIVITA_TERMICO,
  TITOLO_TERMICO,
  ESCLUSO_OFFERTA,
  GARANZIE_TESTI,
  INCLUSO_FV,
  NOTA_GARANZIA,
} from '@/lib/pdf/dossier-testi'
import { mappaSimulazionePerPdf } from '@/lib/pdf/mappa-simulazione-pdf'
import {
  leggiDocumentiTecniciSnapshot,
  type DocumentoTecnicoPreventivo,
} from '@/lib/pdf/premium/documenti-tecnici'
import { planimetriaDaStudio } from '@/lib/pdf/planimetria-moduli'
import { getDocumentiTecniciProdotti } from '@/lib/queries/documenti-tecnici'
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
  /**
   * Ruolo del prodotto collegato. Serve all'editor per dedurre quanto pesa
   * l'impianto termico senza farlo riscrivere a mano.
   */
  readonly componentRole: string | null
  /** SCOP dal catalogo: serve all'avviso «il termico non entra nel piano». */
  readonly scop: number | null
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
      /*
       * Il gas dell'ultimo anno vive nello studio tetto, non nel preventivo:
       * serve qui solo per dire al commerciale che senza quel dato la pompa di
       * calore resta una voce di spesa.
       */
      studioPayload: siteStudies.payload,
    })
    .from(quoteVersions)
    .innerJoin(quotes, eq(quotes.id, quoteVersions.quoteId))
    .innerJoin(opportunities, eq(opportunities.id, quotes.opportunityId))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .leftJoin(siteStudies, eq(siteStudies.id, quotes.siteStudyId))
    .where(eq(quoteVersions.id, versionId))
    .limit(1)

  if (!riga) return null

  const righeDb = await db
    .select({
      riga: quoteLines,
      componentRole: products.componentRole,
      scop: products.scop,
    })
    .from(quoteLines)
    .leftJoin(products, eq(products.id, quoteLines.productId))
    .where(eq(quoteLines.quoteVersionId, versionId))
    .orderBy(asc(quoteLines.sortOrder))

  const righe: RigaVisibile[] = righeDb.map(({ riga: r, componentRole, scop }) => ({
    id: r.id,
    productId: r.productId,
    description: r.description,
    unit: r.unit,
    quantity: Number.parseFloat(r.quantity),
    unitPrice: Number.parseFloat(r.unitPrice),
    ...(mostraCosti ? { unitCost: Number.parseFloat(r.unitCost) } : {}),
    discountPct: Number.parseFloat(r.discountPct),
    vatRate: Number.parseFloat(r.vatRate),
    componentRole,
    scop: scop ? Number.parseFloat(scop) : null,
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

  const studio = riga.studioPayload as { consumoGasAnnuoSmc?: unknown } | null
  const consumoGasAnnuoSmc =
    typeof studio?.consumoGasAnnuoSmc === 'number' ? studio.consumoGasAnnuoSmc : null

  // Il payload dello studio non esce di qui: e' grosso e al browser serve
  // soltanto il gas consumato.
  const resto = { ...riga, studioPayload: undefined }
  delete (resto as { studioPayload?: unknown }).studioPayload

  return { ...resto, consumoGasAnnuoSmc, righe, versioni }
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
  /** Schede versionate selezionate dai prodotti effettivamente quotati. */
  readonly documentiTecnici: readonly DocumentoTecnicoPreventivo[]
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
      snapshotPreventivo: quoteVersions.snapshot,
      ownerName: users.name,
      ownerEmail: users.email,
      ownerRole: users.role,
    })
    .from(quoteVersions)
    .innerJoin(quotes, eq(quotes.id, quoteVersions.quoteId))
    .innerJoin(opportunities, eq(opportunities.id, quotes.opportunityId))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .leftJoin(users, eq(users.id, opportunities.ownerId))
    .leftJoin(companies, eq(companies.id, contacts.companyId))
    .leftJoin(sites, eq(sites.id, opportunities.siteId))
    .leftJoin(siteStudies, eq(siteStudies.id, quotes.siteStudyId))
    .where(eq(quoteVersions.id, versionId))
    .limit(1)

  if (!riga) return null

  const righeDb = await db
    .select({
      productId: quoteLines.productId,
      description: quoteLines.description,
      unit: quoteLines.unit,
      quantity: quoteLines.quantity,
      unitPrice: quoteLines.unitPrice,
      discountPct: quoteLines.discountPct,
      vatRate: quoteLines.vatRate,
      lineNet: quoteLines.lineNet,
      // Dati tecnici del prodotto collegato: sono ciò che rende il preventivo
      // calcolato invece che raccontato (D-021). Nulli finché il catalogo non
      // è compilato: `leggiConfigurazione` sa ripiegare sulla descrizione.
      componentRole: products.componentRole,
      ratedPowerW: products.ratedPowerW,
      acPowerKw: products.acPowerKw,
      capacityKwh: products.capacityKwh,
      scop: products.scop,
      brand: products.brand,
      model: products.model,
    })
    .from(quoteLines)
    .leftJoin(products, eq(products.id, quoteLines.productId))
    .where(eq(quoteLines.quoteVersionId, versionId))
    .orderBy(asc(quoteLines.sortOrder))

  if (righeDb.length === 0) return null

  const productIds = [
    ...new Set(
      righeDb
        .map((riga) => riga.productId)
        .filter((id): id is string => id != null),
    ),
  ]
  const documentiCongelati = leggiDocumentiTecniciSnapshot(riga.snapshotPreventivo)
  const documentiTecnici: readonly DocumentoTecnicoPreventivo[] =
    documentiCongelati ?? (await getDocumentiTecniciProdotti(db, productIds))

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

  /*
   * La configurazione tecnica esce dalle righe: numero moduli, Watt di picco,
   * potenza in alternata dell'inverter, capacità di accumulo. Cambiare la
   * batteria nel listino cambia i numeri del PDF, non il suo stile.
   */
  const configurazione = leggiConfigurazione(
    righeDb.map((r) => ({
      descrizione: r.description,
      quantita: Number.parseFloat(r.quantity),
      ruolo: r.componentRole,
      potenzaModuloW: r.ratedPowerW,
      potenzaCaKw: r.acPowerKw ? Number.parseFloat(r.acPowerKw) : null,
      capacitaKwh: r.capacityKwh ? Number.parseFloat(r.capacityKwh) : null,
      scop: r.scop ? Number.parseFloat(r.scop) : null,
      marca: r.brand,
      modello: r.model,
      /*
       * L'importo IVA inclusa serve a dedurre quanto pesa il termico nel
       * totale. `lineNet` e' l'imponibile di riga: l'aliquota si riapplica qui
       * perche' la divisione degli incentivi ragiona sul lordo, come il totale
       * del preventivo.
       */
      importoLordoCents: importoDaEuro(
        Number.parseFloat(r.lineNet) * (1 + Number.parseFloat(r.vatRate) / 100),
      ),
    })),
  )

  /*
   * Il dossier va letto PRIMA della simulazione: se il preventivo comprende
   * una pompa di calore, il suo risparmio deve entrare nel piano economico
   * insieme al suo costo, che e' gia' dentro il totale del preventivo.
   */
  const dossier = normalizzaDossier(riga.dossier)

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
      capacitaAccumuloKwh: configurazione.capacitaAccumuloKwh,
      potenzaCaKw: configurazione.potenzaCaKw,
      /*
       * Il costo e l'agevolazione termica vanno sempre separati dalla quota
       * FV. Il risparmio operativo, invece, nasce solo quando sono presenti
       * gas consumato, SCOP e prezzo del gas: i valori zero fanno quindi
       * restare il capitolo descrittivo senza inventare un beneficio.
       */
      termico: dossier.termico?.presente
        ? {
              consumoGasAnnuoSmc: payload.consumoGasAnnuoSmc ?? 0,
              ...(payload.gasNonSostituitoSmc != null
                ? { gasNonSostituitoSmc: payload.gasNonSostituitoSmc }
                : {}),
              // Lo SCOP e' una proprieta' della macchina, non del preventivo:
              // il catalogo vince, il valore scritto a mano resta da ripiego.
              scop: scopEffettivo(configurazione, dossier.termico.scop),
              // Il prezzo del gas e' del cliente, dalla sua bolletta; quando
              // manca si usa quello configurato in azienda invece di spegnere
              // in silenzio il calcolo del risparmio.
              prezzoGasEurSmc:
                dossier.termico.prezzoGasEurSmc ?? parametri.prezzoGasEurSmc,
              /*
               * Il prezzo del termico si deduce dalle righe, non si riscrive.
               * Era un campo a mano nel blocco termico: lo stesso importo in
               * due punti, senza niente che verificasse che coincidessero.
               * Il valore scritto a mano resta solo come ripiego per i
               * preventivi in cui nessuna riga e' riconosciuta come termica.
               */
              prezzoLordoCents: prezzoTermicoEffettivoCents(
                configurazione,
                importoDaEuro(dossier.termico.prezzoLordoEur),
              ),
              incentivo: dossier.termico.incentivo,
              detrazionePct: dossier.termico.detrazionePct,
              anniDetrazione:
                dossier.termico.anniDetrazione ?? parametri.detrazioneAnni,
              contoTermicoCents:
                dossier.termico.incentivo === 'conto_termico' &&
                dossier.termico.contoTermicoEur != null
                  ? importoDaEuro(dossier.termico.contoTermicoEur)
                  : 0,
              anniErogazioneContoTermico: dossier.termico.anniContoTermico ?? 5,
            }
        : null,
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

  let bloccoTermico: DatiPdfPreventivo['bloccoTermico'] = null
  if (dossier.termico?.presente) {
    const t = dossier.termico
    /*
     * Lo stesso prezzo che entra nel piano economico, dedotto dalle righe.
     * Stamparne un altro qui vorrebbe dire mettere due verita' sullo stesso
     * impianto nella stessa pagina — ed e' gia' successo.
     */
    const prezzoCents = prezzoTermicoEffettivoCents(
      configurazione,
      importoDaEuro(t.prezzoLordoEur),
    )
    const incentivoCents =
      t.incentivo === 'detrazione'
        ? Math.round((prezzoCents * t.detrazionePct) / 100)
        : t.incentivo === 'conto_termico' && t.contoTermicoEur != null
          ? importoDaEuro(t.contoTermicoEur)
          : 0
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
      incentivoEtichetta:
        t.incentivo === 'detrazione'
          ? `Detrazione fiscale ${t.detrazionePct.toLocaleString('it-IT')}%`
          : t.incentivo === 'conto_termico'
            ? 'Conto Termico 3.0'
            : 'Nessuna agevolazione inclusa',
      incentivoImporto:
        incentivoCents > 0 ? formattaImporto(incentivoCents) : null,
      notaIncentivo:
        t.incentivo === 'conto_termico'
          ? 'Il Conto Termico e la detrazione fiscale sono alternativi sulle stesse spese; il piano usa soltanto il contributo selezionato.'
          : t.incentivo === 'detrazione'
            ? 'Il piano usa la detrazione termica selezionata e non somma il Conto Termico sulle stesse spese.'
            : 'Nessuna agevolazione termica è inclusa nel piano economico.',
      nettoIndicativo: formattaImporto(
        Math.max(0, prezzoCents - incentivoCents),
      ),
    }
  }

  const studio =
    payload && layoutsAttivi(payload).length > 0 ? payload : null

  const vociFotovoltaico = [
    dettagliImpianto
      ? `Campo fotovoltaico da ${dettagliImpianto.potenzaKwp}, con produzione annua stimata di ${dettagliImpianto.produzioneKwh}.`
      : null,
    ...configurazione.moduliDescritti.map(
      (c) =>
        `${quantitaEComponente(c.quantita, { uno: 'modulo', molti: 'moduli' }, c)}${configurazione.wattPicco ? ` da ${configurazione.wattPicco.toLocaleString('it-IT')} Wp` : ''}.`,
    ),
    ...configurazione.inverterDescritti.map(
      (c) =>
        `${quantitaEComponente(c.quantita, { uno: 'inverter', molti: 'inverter' }, c)}${configurazione.potenzaCaKw ? ` - potenza CA complessiva ${configurazione.potenzaCaKw.toLocaleString('it-IT', { maximumFractionDigits: 2 })} kW` : ''}.`,
    ),
    ...configurazione.struttureDescritte.map(
      (c) => `${c.quantita.toLocaleString('it-IT')} ${nomeComponente(c)}.`,
    ),
    ...configurazione.quadriDescritti.map(
      (c) => `${c.quantita.toLocaleString('it-IT')} ${nomeComponente(c)}.`,
    ),
  ].filter((x): x is string => !!x)

  const configurazioneTecnica: DatiPdfPreventivo['configurazioneTecnica'] = [
    ...(vociFotovoltaico.length > 0
      ? [{ titolo: 'Impianto fotovoltaico', voci: vociFotovoltaico }]
      : []),
    ...(configurazione.accumuliDescritti.length > 0
      ? [
          {
            titolo: 'Sistema di accumulo',
            voci: configurazione.accumuliDescritti.map(
              (c) =>
                `${quantitaEComponente(c.quantita, { uno: 'sistema di accumulo', molti: 'sistemi di accumulo' }, c)} - capacità complessiva ${configurazione.capacitaAccumuloKwh.toLocaleString('it-IT', { maximumFractionDigits: 2 })} kWh.`,
            ),
          },
        ]
      : []),
    /*
     * Il blocco termico compare solo se il cliente lo compra. Non è una scelta
     * estetica: le sue voci parlano di caldaia da smontare, lavaggio impianto
     * e iscrizione FGAS, e su un preventivo di solo fotovoltaico
     * descriverebbero un lavoro che nessuno farà.
     */
    ...(dossier.termico?.presente
      ? [
          {
            titolo: TITOLO_TERMICO[dossier.termico.tipo],
            voci: [
              dossier.termico.descrizione,
              ...ATTIVITA_TERMICO[dossier.termico.tipo],
              ...(dossier.termico.scop
                ? [`Rendimento stagionale dichiarato (SCOP): ${dossier.termico.scop.toLocaleString('it-IT')}.`]
                : []),
            ],
          },
        ]
      : []),
  ]

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
    mittente: {
      nome: riga.ownerName?.trim() || ECOSOLARE.nome,
      ruolo:
        riga.ownerRole === 'commerciale'
          ? 'Resp. Commerciale'
          : riga.ownerRole === 'amministratore'
            ? 'Amministratore'
            : null,
      email: riga.ownerEmail ?? ECOSOLARE.email,
      telefono: null,
    },
    copertinaKpi,
    dettagliImpianto,
    condizioniEconomiche,
    bloccoTermico,
    configurazioneTecnica,
    dossierTestuale: {
      incluso: INCLUSO_FV,
      escluso: ESCLUSO_OFFERTA,
      garanzie: GARANZIE_TESTI,
      notaGaranzia: NOTA_GARANZIA,
    },
    planimetria,
    simulazione,
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

  return { dati, studio, documentiTecnici }
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
      componentRole: products.componentRole,
      scop: products.scop,
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
    componentRole: r.componentRole,
    scop: r.scop ? Number.parseFloat(r.scop) : null,
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
