import { desc, eq, isNotNull, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  documentFiles,
  documentRequirements,
  outboxEvents,
  paymentMilestones,
  paymentReceipts,
  projects,
  surveyFiles,
  users,
} from '@/db/schema'

/**
 * Elenchi per la sezione Manutenzione.
 *
 * Il criterio con cui sono scritti: chi li guarda non è uno sviluppatore. Deve
 * capire *cosa* non è arrivato e *su quale cliente*, non il tipo tecnico
 * dell'evento — quello resta, ma in coda alla riga e in piccolo.
 */

export interface EventoInErrore {
  readonly id: string
  readonly tipo: string
  readonly tentativi: number
  readonly errore: string | null
  readonly creatoIl: Date
}

export async function getEventiFalliti(limite = 20): Promise<readonly EventoInErrore[]> {
  const righe = await getDb()
    .select({
      id: outboxEvents.id,
      tipo: outboxEvents.type,
      tentativi: outboxEvents.attempts,
      errore: outboxEvents.lastError,
      creatoIl: outboxEvents.createdAt,
    })
    .from(outboxEvents)
    .where(eq(outboxEvents.status, 'fallito'))
    .orderBy(desc(outboxEvents.createdAt))
    .limit(limite)

  return righe
}

/** Nome leggibile del tipo di evento. Sconosciuto ⇒ si mostra il codice. */
export function descriviTipoEvento(tipo: string): string {
  const nomi: Record<string, string> = {
    'drive.cartella_cliente': 'Creazione della cartella cliente su Drive',
    'drive.copia_documento': 'Copia di un documento su Drive',
    'drive.copia_contabile': 'Copia di una contabile su Drive',
    'drive.copia_foto_sopralluogo': 'Copia di una foto di sopralluogo su Drive',
    'telegram.fu_reminder': 'Promemoria di follow-up su Telegram',
    'telegram.avviso_salute': 'Avviso di malfunzionamento su Telegram',
  }
  return nomi[tipo] ?? tipo
}

export interface FileCestinato {
  readonly id: string
  readonly genere: 'documento' | 'contabile' | 'fotografia'
  readonly nome: string
  readonly contesto: string
  readonly eliminatoIl: Date
  readonly eliminatoDa: string | null
  readonly dimensione: number
}

/**
 * Il cestino: tutto ciò che è stato eliminato e si può ancora riprendere.
 *
 * Non ha scadenza (D-017). Un cestino che si svuota da solo è un cestino che
 * un giorno butterà via la cosa sbagliata, e il costo dello spazio è
 * incomparabilmente più basso di quello di un documento perso.
 */
export async function getCestino(limite = 100): Promise<readonly FileCestinato[]> {
  const db = getDb()

  const documenti = await db
    .select({
      id: documentFiles.id,
      nome: documentFiles.filename,
      dimensione: documentFiles.sizeBytes,
      eliminatoIl: documentFiles.deletedAt,
      eliminatoDa: users.name,
      eliminatoDaEmail: users.email,
      etichetta: documentRequirements.label,
      commessa: projects.code,
    })
    .from(documentFiles)
    .innerJoin(documentRequirements, eq(documentRequirements.id, documentFiles.requirementId))
    .innerJoin(projects, eq(projects.id, documentRequirements.projectId))
    .leftJoin(users, eq(users.id, documentFiles.deletedBy))
    .where(isNotNull(documentFiles.deletedAt))
    .orderBy(desc(documentFiles.deletedAt))
    .limit(limite)

  const contabili = await db
    .select({
      id: paymentReceipts.id,
      nome: paymentReceipts.filename,
      dimensione: paymentReceipts.sizeBytes,
      eliminatoIl: paymentReceipts.deletedAt,
      eliminatoDa: users.name,
      eliminatoDaEmail: users.email,
      etichetta: paymentMilestones.label,
      commessa: projects.code,
    })
    .from(paymentReceipts)
    .innerJoin(paymentMilestones, eq(paymentMilestones.id, paymentReceipts.milestoneId))
    .innerJoin(projects, eq(projects.id, paymentMilestones.projectId))
    .leftJoin(users, eq(users.id, paymentReceipts.deletedBy))
    .where(isNotNull(paymentReceipts.deletedAt))
    .orderBy(desc(paymentReceipts.deletedAt))
    .limit(limite)

  const foto = await db
    .select({
      id: surveyFiles.id,
      nome: surveyFiles.filename,
      dimensione: surveyFiles.sizeBytes,
      eliminatoIl: surveyFiles.deletedAt,
      eliminatoDa: users.name,
      eliminatoDaEmail: users.email,
      campo: surveyFiles.fieldCode,
    })
    .from(surveyFiles)
    .leftJoin(users, eq(users.id, surveyFiles.deletedBy))
    .where(isNotNull(surveyFiles.deletedAt))
    .orderBy(desc(surveyFiles.deletedAt))
    .limit(limite)

  const tutti: FileCestinato[] = [
    ...documenti.map((r) => ({
      id: r.id,
      genere: 'documento' as const,
      nome: r.nome,
      contesto: `${r.commessa} · ${r.etichetta}`,
      eliminatoIl: r.eliminatoIl!,
      eliminatoDa: r.eliminatoDa ?? r.eliminatoDaEmail ?? null,
      dimensione: r.dimensione,
    })),
    ...contabili.map((r) => ({
      id: r.id,
      genere: 'contabile' as const,
      nome: r.nome,
      contesto: `${r.commessa} · ${r.etichetta}`,
      eliminatoIl: r.eliminatoIl!,
      eliminatoDa: r.eliminatoDa ?? r.eliminatoDaEmail ?? null,
      dimensione: r.dimensione,
    })),
    ...foto.map((r) => ({
      id: r.id,
      genere: 'fotografia' as const,
      nome: r.nome,
      contesto: `Sopralluogo · ${r.campo}`,
      eliminatoIl: r.eliminatoIl!,
      eliminatoDa: r.eliminatoDa ?? r.eliminatoDaEmail ?? null,
      dimensione: r.dimensione,
    })),
  ]

  return tutti
    .sort((a, b) => b.eliminatoIl.getTime() - a.eliminatoIl.getTime())
    .slice(0, limite)
}

/** Spazio occupato dal cestino, per sapere se un giorno diventerà un problema. */
export async function getPesoCestino(): Promise<number> {
  // `coalesce` su OGNI addendo, non sulla somma: `sum()` su zero righe
  // restituisce NULL, e NULL + 108624 fa NULL — il totale risultava zero
  // ogni volta che una delle tre tabelle non aveva niente nel cestino.
  const [riga] = await getDb().execute<{ n: number }>(sql`
    select (
      coalesce((select sum(size_bytes) from document_files where deleted_at is not null), 0)
      + coalesce((select sum(size_bytes) from payment_receipts where deleted_at is not null), 0)
      + coalesce((select sum(size_bytes) from survey_files where deleted_at is not null), 0)
    )::bigint as n
  `)
  return Number(riga?.n ?? 0)
}
