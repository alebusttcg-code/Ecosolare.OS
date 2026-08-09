'use server'

import { and, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import {
  bankStatements,
  bankTransactions,
  companies,
  contacts,
  paymentMilestones,
  paymentReceipts,
  projects,
  reconciliationChecks,
} from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import { leggiCsv } from '@/lib/domain/estratto-conto'
import { importoAStringa, importoDaEuro } from '@/lib/domain/money'
import { riconcilia, type PagamentoAtteso } from '@/lib/domain/riconciliazione'
import { validaFile } from '@/lib/domain/upload'
import { ripulisciNome } from '@/lib/domain/upload'
import { getArchivio } from '@/lib/storage'
import type { ActionResult } from './opportunities'
import { ricalcolaReadiness } from '@/lib/readiness'

function errori(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) out[issue.path.join('.') || '_'] ??= issue.message
  return out
}

/* -------------------------------------------------------------------------- */
/*  OK amministrativo                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Concede l'OK amministrativo su una scadenza di pagamento.
 *
 * Richiede che la contabile sia stata caricata: è il documento su cui l'OK si
 * fonda, ed è quello che si andrà a rileggere se l'estratto conto non
 * confermerà l'incasso.
 */
export async function concediOkAmministrativo(
  input: { milestoneId: string; nota?: string },
): Promise<ActionResult> {
  const utente = await guard('update', 'invoice')

  const schema = z.object({
    milestoneId: z.uuid(),
    nota: z.string().trim().max(400).optional(),
  })
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  const db = getDb()
  const scadenza = await db.query.paymentMilestones.findFirst({
    where: eq(paymentMilestones.id, parsed.data.milestoneId),
  })
  if (!scadenza) return { ok: false, errors: { _: 'Scadenza non trovata.' } }

  const [contabile] = await db
    .select({ id: paymentReceipts.id })
    .from(paymentReceipts)
    .where(eq(paymentReceipts.milestoneId, parsed.data.milestoneId))
    .limit(1)

  if (!contabile) {
    return {
      ok: false,
      errors: {
        _: 'Carica prima la contabile di pagamento: l’OK amministrativo si fonda su quella.',
      },
    }
  }

  await db
    .update(paymentMilestones)
    .set({
      adminOkAt: new Date(),
      adminOkBy: utente.id,
      adminOkNote: parsed.data.nota ?? null,
    })
    .where(eq(paymentMilestones.id, parsed.data.milestoneId))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'approve',
    entityType: 'payment_milestone',
    entityId: parsed.data.milestoneId,
  })

  await ricalcolaReadiness(scadenza.projectId)
  revalidatePath(`/cantieri/${scadenza.projectId}`)
  revalidatePath('/controllo-bancario')
  return { ok: true, data: undefined }
}

export async function revocaOkAmministrativo(milestoneId: string): Promise<ActionResult> {
  const utente = await guard('update', 'invoice')

  if (!z.uuid().safeParse(milestoneId).success) {
    return { ok: false, errors: { _: 'Identificativo non valido.' } }
  }

  const db = getDb()
  const scadenza = await db.query.paymentMilestones.findFirst({
    where: eq(paymentMilestones.id, milestoneId),
  })
  if (!scadenza) return { ok: false, errors: { _: 'Scadenza non trovata.' } }

  await db
    .update(paymentMilestones)
    .set({ adminOkAt: null, adminOkBy: null, adminOkNote: null })
    .where(eq(paymentMilestones.id, milestoneId))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'payment_milestone',
    entityId: milestoneId,
    before: { adminOkAt: scadenza.adminOkAt },
    after: { adminOkAt: null },
  })

  await ricalcolaReadiness(scadenza.projectId)
  revalidatePath(`/cantieri/${scadenza.projectId}`)
  return { ok: true, data: undefined }
}

export interface ContabileSalvata {
  readonly id: string
  readonly filename: string
  readonly sizeBytes: number
}

/** Carica la contabile di pagamento inviata dal cliente. */
export async function caricaContabile(
  formData: FormData,
): Promise<ActionResult<ContabileSalvata>> {
  const utente = await guard('update', 'invoice')

  const milestoneId = String(formData.get('milestoneId') ?? '')
  const file = formData.get('file')
  if (!z.uuid().safeParse(milestoneId).success) {
    return { ok: false, errors: { _: 'Scadenza non indicata.' } }
  }
  if (!(file instanceof File)) return { ok: false, errors: { file: 'Nessun file scelto.' } }

  const db = getDb()
  const scadenza = await db.query.paymentMilestones.findFirst({
    where: eq(paymentMilestones.id, milestoneId),
  })
  if (!scadenza) return { ok: false, errors: { _: 'Scadenza non trovata.' } }

  const contenuto = new Uint8Array(await file.arrayBuffer())
  const esito = validaFile({
    byte: contenuto,
    dimensione: contenuto.byteLength,
    tipoDichiarato: file.type,
  })
  if (!esito.ok) return { ok: false, errors: { file: esito.motivo } }

  const archiviato = await getArchivio().salva({
    contenuto,
    estensione: esito.estensione,
    cartella: `contabili/${scadenza.projectId}`,
  })

  const nome = ripulisciNome(file.name)
  const [riga] = await db
    .insert(paymentReceipts)
    .values({
      milestoneId,
      storageKey: archiviato.chiave,
      filename: nome,
      mimeType: esito.tipo,
      sizeBytes: archiviato.dimensione,
      checksum: archiviato.checksum,
      uploadedBy: utente.id,
    })
    .returning({
      id: paymentReceipts.id,
      filename: paymentReceipts.filename,
      sizeBytes: paymentReceipts.sizeBytes,
    })

  revalidatePath(`/cantieri/${scadenza.projectId}`)
  return {
    ok: true,
    data: {
      id: riga!.id,
      filename: riga!.filename,
      sizeBytes: riga!.sizeBytes,
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Estratto conto e riconciliazione                                           */
/* -------------------------------------------------------------------------- */

export interface EsitoImportazione {
  readonly statementId: string
  readonly movimentiLetti: number
  readonly righeScartate: number
  readonly daVerificare: number
  readonly abbinati: number
  readonly entrateNonAttese: number
}

/**
 * Carica un estratto conto ed esegue il controllo.
 *
 * Il confronto avviene subito, non su richiesta: il senso di questo strumento è
 * che chi carica il file veda immediatamente cosa non torna.
 */
export async function caricaEstrattoConto(
  formData: FormData,
): Promise<ActionResult<EsitoImportazione>> {
  const utente = await guard('update', 'invoice')

  const file = formData.get('file')
  const etichettaEsito = z
    .string()
    .trim()
    .max(160, 'Etichetta troppo lunga (massimo 160 caratteri).')
    .safeParse(String(formData.get('label') ?? ''))
  if (!etichettaEsito.success) {
    return { ok: false, errors: { label: etichettaEsito.error.issues[0]!.message } }
  }
  const etichetta = etichettaEsito.data
  if (!(file instanceof File)) return { ok: false, errors: { file: 'Nessun file scelto.' } }

  const contenuto = new Uint8Array(await file.arrayBuffer())
  if (contenuto.byteLength === 0) {
    return { ok: false, errors: { file: 'Il file è vuoto.' } }
  }

  const nome = ripulisciNome(file.name)
  const eCsv = /\.csv$|\.txt$/i.test(nome) || file.type.includes('csv') || file.type.includes('text')

  if (!eCsv) {
    // Onestà sul limite: un estratto conto in PDF ha un impaginato diverso per
    // ogni banca, e leggerlo a tentativi produrrebbe importi sbagliati in un
    // controllo contabile. Meglio dirlo che sbagliare in silenzio.
    return {
      ok: false,
      errors: {
        file:
          'Per ora si legge solo il CSV. L’estratto conto in PDF ha un impaginato diverso per ogni banca e non è abbastanza affidabile per un controllo contabile: esporta il CSV dall’home banking.',
      },
    }
  }

  const testo = new TextDecoder('utf-8').decode(contenuto)
  const lettura = leggiCsv(testo)

  if (lettura.movimenti.length === 0) {
    return {
      ok: false,
      errors: {
        file:
          lettura.errori[0]?.motivo ??
          'Nessun movimento riconosciuto nel file.',
      },
    }
  }

  const date = lettura.movimenti.map((m) => m.data.getTime())
  const daData = new Date(Math.min(...date))
  const aData = new Date(Math.max(...date))

  const archiviato = await getArchivio().salva({
    contenuto,
    estensione: 'csv',
    cartella: 'estratti-conto',
  })

  const db = getDb()

  /* Pagamenti attesi: quelli con OK amministrativo nel periodo, più margine. */
  const margine = 30 * 86_400_000
  const righeAttese = await db
    .select({
      milestoneId: paymentMilestones.id,
      etichetta: paymentMilestones.label,
      importo: paymentMilestones.amountNet,
      okIl: paymentMilestones.adminOkAt,
      commessaId: projects.id,
      commessaCodice: projects.code,
      cognome: contacts.lastName,
      nome: contacts.firstName,
      ragioneSociale: companies.legalName,
    })
    .from(paymentMilestones)
    .innerJoin(projects, eq(projects.id, paymentMilestones.projectId))
    .innerJoin(contacts, eq(contacts.id, projects.contactId))
    .leftJoin(companies, eq(companies.id, contacts.companyId))
    .where(
      and(
        isNotNull(paymentMilestones.adminOkAt),
        gte(paymentMilestones.adminOkAt, new Date(daData.getTime() - margine)),
        lte(paymentMilestones.adminOkAt, new Date(aData.getTime() + margine)),
        // Le commesse archiviate non partecipano all'abbinamento dei nuovi
        // estratti: un pagamento su una commessa rimossa sarebbe un falso match.
        isNull(projects.deletedAt),
        isNull(contacts.deletedAt),
      ),
    )

  const attesi: PagamentoAtteso[] = righeAttese.map((r) => ({
    id: r.milestoneId,
    commessaId: r.commessaId,
    commessaCodice: r.commessaCodice,
    // Per le aziende si cerca la ragione sociale: in banca il bonifico arriva
    // da quella, non dal referente.
    cliente: r.ragioneSociale
      ? { cognome: r.ragioneSociale, nome: null }
      : { cognome: r.cognome, nome: r.nome },
    etichetta: r.etichetta,
    importo: importoDaEuro(r.importo),
    okAmministrativoIl: r.okIl!,
  }))

  const esito = riconcilia(attesi, lettura.movimenti)

  const risultato = await db.transaction(async (tx) => {
    const [estratto] = await tx
      .insert(bankStatements)
      .values({
        label: etichetta || `Estratto conto ${nome}`,
        storageKey: archiviato.chiave,
        filename: nome,
        mimeType: 'text/csv',
        sizeBytes: archiviato.dimensione,
        periodFrom: daData,
        periodTo: aData,
        importedRows: lettura.movimenti.length,
        skippedRows: lettura.errori.length,
        parseReport: {
          colonne: lettura.colonneRiconosciute,
          scartate: lettura.errori.slice(0, 50),
        },
        uploadedBy: utente.id,
      })
      .returning({ id: bankStatements.id })

    const statementId = estratto!.id

    const movimentiInseriti = await tx
      .insert(bankTransactions)
      .values(
        lettura.movimenti.map((m) => ({
          statementId,
          rowNumber: m.riga,
          valueDate: m.data,
          description: m.descrizione,
          amount: importoAStringa(m.importo),
        })),
      )
      .returning({ id: bankTransactions.id, rowNumber: bankTransactions.rowNumber })

    const perRiga = new Map(movimentiInseriti.map((m) => [m.rowNumber, m.id]))

    if (esito.abbinamenti.length > 0) {
      await tx.insert(reconciliationChecks).values(
        esito.abbinamenti.map((a) => ({
          statementId,
          milestoneId: a.pagamento.id,
          transactionId: a.movimento ? (perRiga.get(a.movimento.riga) ?? null) : null,
          outcome: a.esito,
          nameMatch: a.nome,
          difference: a.differenza === null ? null : importoAStringa(a.differenza),
        })),
      )
    }

    return statementId
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'bank_statement',
    entityId: risultato,
  })

  revalidatePath('/controllo-bancario')
  return {
    ok: true,
    data: {
      statementId: risultato,
      movimentiLetti: lettura.movimenti.length,
      righeScartate: lettura.errori.length,
      daVerificare: esito.daVerificare.length,
      abbinati: esito.abbinamenti.length - esito.daVerificare.length,
      entrateNonAttese: esito.entrateNonAttese.length,
    },
  }
}

/** Segna un riscontro come verificato a mano, con la spiegazione. */
export async function segnaVerificato(
  input: { checkId: string; nota: string },
): Promise<ActionResult> {
  const utente = await guard('update', 'invoice')

  const schema = z.object({
    checkId: z.uuid(),
    nota: z.string().trim().min(1, 'Scrivi cosa hai verificato').max(400),
  })
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  await getDb()
    .update(reconciliationChecks)
    .set({
      reviewedAt: new Date(),
      reviewedBy: utente.id,
      reviewNote: parsed.data.nota,
    })
    .where(eq(reconciliationChecks.id, parsed.data.checkId))

  revalidatePath('/controllo-bancario')
  return { ok: true, data: undefined }
}
