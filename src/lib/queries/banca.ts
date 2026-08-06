import { and, count, desc, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  bankStatements,
  bankTransactions,
  companies,
  contacts,
  paymentMilestones,
  projects,
  reconciliationChecks,
  users,
} from '@/db/schema'
import type { EsitoAbbinamento } from '@/lib/domain/riconciliazione'

export interface EstrattoInElenco {
  readonly id: string
  readonly label: string
  readonly filename: string
  readonly periodFrom: Date | null
  readonly periodTo: Date | null
  readonly importedRows: number
  readonly skippedRows: number
  readonly uploadedAt: Date
  readonly caricatoDa: string | null
  readonly daVerificare: number
}

export async function listEstratti(limite = 20): Promise<EstrattoInElenco[]> {
  const db = getDb()

  const righe = await db
    .select({
      id: bankStatements.id,
      label: bankStatements.label,
      filename: bankStatements.filename,
      periodFrom: bankStatements.periodFrom,
      periodTo: bankStatements.periodTo,
      importedRows: bankStatements.importedRows,
      skippedRows: bankStatements.skippedRows,
      uploadedAt: bankStatements.uploadedAt,
      caricatoDa: users.name,
      caricatoDaEmail: users.email,
    })
    .from(bankStatements)
    .leftJoin(users, eq(users.id, bankStatements.uploadedBy))
    .orderBy(desc(bankStatements.uploadedAt))
    .limit(limite)

  if (righe.length === 0) return []

  // Quanti riscontri restano da chiarire su ciascun estratto: è l'unico numero
  // che serve nell'elenco, perché è l'unico che richiede un'azione.
  const aperti = await db
    .select({
      statementId: reconciliationChecks.statementId,
      totale: count(),
    })
    .from(reconciliationChecks)
    .where(
      and(
        sql`${reconciliationChecks.outcome} <> 'abbinato'`,
        isNull(reconciliationChecks.reviewedAt),
      ),
    )
    .groupBy(reconciliationChecks.statementId)

  const perEstratto = new Map(aperti.map((a) => [a.statementId, a.totale]))

  return righe.map((r) => ({
    id: r.id,
    label: r.label,
    filename: r.filename,
    periodFrom: r.periodFrom,
    periodTo: r.periodTo,
    importedRows: r.importedRows,
    skippedRows: r.skippedRows,
    uploadedAt: r.uploadedAt,
    caricatoDa: r.caricatoDa ?? r.caricatoDaEmail,
    daVerificare: perEstratto.get(r.id) ?? 0,
  }))
}

export interface Riscontro {
  readonly id: string
  readonly esito: EsitoAbbinamento
  readonly nome: string
  readonly differenza: string | null
  readonly verificatoIl: Date | null
  readonly verificatoDa: string | null
  readonly notaVerifica: string | null

  readonly cliente: string
  readonly commessaId: string
  readonly commessaCodice: string
  readonly scadenza: string
  readonly importoAtteso: string
  readonly okAmministrativoIl: Date | null

  readonly movimentoData: Date | null
  readonly movimentoDescrizione: string | null
  readonly movimentoImporto: string | null
}

export interface DettaglioEstratto {
  readonly estratto: EstrattoInElenco
  readonly riscontri: readonly Riscontro[]
  readonly entrateNonAttese: readonly {
    id: string
    valueDate: Date
    description: string
    amount: string
  }[]
  readonly scartate: readonly { riga: number; motivo: string; contenuto: string }[]
  readonly colonne: Record<string, string | null> | null
}

export async function getDettaglioEstratto(id: string): Promise<DettaglioEstratto | null> {
  const db = getDb()

  const elenco = await listEstratti(50)
  const estratto = elenco.find((e) => e.id === id)
  if (!estratto) return null

  const [grezzo] = await db
    .select({ parseReport: bankStatements.parseReport })
    .from(bankStatements)
    .where(eq(bankStatements.id, id))
    .limit(1)

  const righe = await db
    .select({
      id: reconciliationChecks.id,
      esito: reconciliationChecks.outcome,
      nome: reconciliationChecks.nameMatch,
      differenza: reconciliationChecks.difference,
      verificatoIl: reconciliationChecks.reviewedAt,
      verificatoDa: users.name,
      verificatoDaEmail: users.email,
      notaVerifica: reconciliationChecks.reviewNote,

      commessaId: projects.id,
      commessaCodice: projects.code,
      scadenza: paymentMilestones.label,
      importoAtteso: paymentMilestones.amountNet,
      okAmministrativoIl: paymentMilestones.adminOkAt,

      cognome: contacts.lastName,
      nomeCliente: contacts.firstName,
      ragioneSociale: companies.legalName,

      movimentoData: bankTransactions.valueDate,
      movimentoDescrizione: bankTransactions.description,
      movimentoImporto: bankTransactions.amount,
    })
    .from(reconciliationChecks)
    .innerJoin(paymentMilestones, eq(paymentMilestones.id, reconciliationChecks.milestoneId))
    .innerJoin(projects, eq(projects.id, paymentMilestones.projectId))
    .innerJoin(contacts, eq(contacts.id, projects.contactId))
    .leftJoin(companies, eq(companies.id, contacts.companyId))
    .leftJoin(bankTransactions, eq(bankTransactions.id, reconciliationChecks.transactionId))
    .leftJoin(users, eq(users.id, reconciliationChecks.reviewedBy))
    .where(eq(reconciliationChecks.statementId, id))

  /* Entrate senza alcun riscontro: denaro arrivato che non aspettavamo. */
  const nonAttese = await db
    .select({
      id: bankTransactions.id,
      valueDate: bankTransactions.valueDate,
      description: bankTransactions.description,
      amount: bankTransactions.amount,
    })
    .from(bankTransactions)
    .leftJoin(
      reconciliationChecks,
      eq(reconciliationChecks.transactionId, bankTransactions.id),
    )
    .where(
      and(
        eq(bankTransactions.statementId, id),
        sql`${bankTransactions.amount} > 0`,
        isNull(reconciliationChecks.id),
      ),
    )
    .orderBy(desc(bankTransactions.valueDate))

  const report = (grezzo?.parseReport ?? null) as {
    colonne?: Record<string, string | null>
    scartate?: { riga: number; motivo: string; contenuto: string }[]
  } | null

  /** Prima i casi da chiarire: sono l'unica ragione per cui si apre la pagina. */
  const peso: Record<string, number> = {
    non_trovato: 0,
    importo_diverso: 1,
    solo_importo: 2,
    abbinato: 3,
  }

  return {
    estratto,
    riscontri: righe
      .map((r) => ({
        id: r.id,
        esito: r.esito as EsitoAbbinamento,
        nome: r.nome,
        differenza: r.differenza,
        verificatoIl: r.verificatoIl,
        verificatoDa: r.verificatoDa ?? r.verificatoDaEmail,
        notaVerifica: r.notaVerifica,
        cliente:
          r.ragioneSociale ??
          [r.nomeCliente, r.cognome].filter(Boolean).join(' '),
        commessaId: r.commessaId,
        commessaCodice: r.commessaCodice,
        scadenza: r.scadenza,
        importoAtteso: r.importoAtteso,
        okAmministrativoIl: r.okAmministrativoIl,
        movimentoData: r.movimentoData,
        movimentoDescrizione: r.movimentoDescrizione,
        movimentoImporto: r.movimentoImporto,
      }))
      .sort(
        (a, b) =>
          (peso[a.esito] ?? 9) - (peso[b.esito] ?? 9) ||
          a.cliente.localeCompare(b.cliente),
      ),
    entrateNonAttese: nonAttese,
    scartate: report?.scartate ?? [],
    colonne: report?.colonne ?? null,
  }
}

/**
 * OK amministrativi concessi che nessun estratto conto ha ancora confrontato.
 *
 * È il promemoria che rende utile questa pagina anche quando non si carica
 * nulla: dice quanto lavoro di verifica è in arretrato.
 */
export async function contaNonAncoraControllati(): Promise<number> {
  const [riga] = await getDb()
    .select({ totale: count() })
    .from(paymentMilestones)
    .leftJoin(
      reconciliationChecks,
      eq(reconciliationChecks.milestoneId, paymentMilestones.id),
    )
    .where(
      and(isNotNull(paymentMilestones.adminOkAt), isNull(reconciliationChecks.id)),
    )
  return riga?.totale ?? 0
}

/** Riepilogo degli OK amministrativi concessi in un periodo. */
export async function contaOkAmministrativi(da: Date, a: Date): Promise<number> {
  const [riga] = await getDb()
    .select({ totale: count() })
    .from(paymentMilestones)
    .where(
      and(
        isNotNull(paymentMilestones.adminOkAt),
        gte(paymentMilestones.adminOkAt, da),
        lte(paymentMilestones.adminOkAt, a),
      ),
    )
  return riga?.totale ?? 0
}
