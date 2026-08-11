import { and, count, eq, isNull, lt, min, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { documentFiles, outboxEvents, paymentReceipts, surveyFiles } from '@/db/schema'
import { driveConfigurato } from '@/lib/drive/client'

/**
 * Stato di salute delle parti che lavorano da sole.
 *
 * Esiste per un motivo preciso: tutto ciò che avviene in coda fallisce in
 * silenzio. La cartella di un cliente non viene creata, la copia di un
 * documento non parte, il reminder non arriva — e nessuno se ne accorge finché
 * qualcuno non va a cercare la cosa che manca, di solito settimane dopo.
 *
 * Le soglie sono deliberatamente generose: un avviso che scatta troppo spesso
 * si impara a ignorare, ed è peggio di nessun avviso.
 */

/** Oltre questo tempo, un evento ancora in attesa non è lentezza: è un blocco. */
const ORE_ATTESA_ANOMALA = 6

/** Oltre questo tempo senza copia su Drive, la seconda copia non sta arrivando. */
const ORE_SENZA_COPIA = 24

export interface StatoSalute {
  readonly eventiFalliti: number
  readonly primoFallitoIl: Date | null
  readonly eventiFermi: number
  readonly primoFermoIl: Date | null
  /** File in archivio senza seconda copia da più di un giorno. */
  readonly fileSenzaCopia: number
  readonly driveAttivo: boolean
  /** File nel cestino, ripristinabili. Non è un problema: è un'informazione. */
  readonly fileNelCestino: number
}

export function tuttoBene(stato: StatoSalute): boolean {
  return stato.eventiFalliti === 0 && stato.eventiFermi === 0 && stato.fileSenzaCopia === 0
}

export async function getStatoSalute(adesso = new Date()): Promise<StatoSalute> {
  const db = getDb()
  const sogliaAttesa = new Date(adesso.getTime() - ORE_ATTESA_ANOMALA * 3_600_000)
  const sogliaCopia = new Date(adesso.getTime() - ORE_SENZA_COPIA * 3_600_000)
  const driveAttivo = driveConfigurato()

  const [falliti] = await db
    .select({ n: count(), primo: min(outboxEvents.createdAt) })
    .from(outboxEvents)
    .where(eq(outboxEvents.status, 'fallito'))

  const [fermi] = await db
    .select({ n: count(), primo: min(outboxEvents.createdAt) })
    .from(outboxEvents)
    .where(
      and(eq(outboxEvents.status, 'in_attesa'), lt(outboxEvents.availableAt, sogliaAttesa)),
    )

  // Senza Drive configurato l'assenza di copie non è un guasto ma una scelta:
  // segnalarla trasformerebbe l'avviso in rumore permanente.
  const senzaCopia = driveAttivo
    ? await contaSenzaCopia(sogliaCopia)
    : 0

  const cestinati = await contaCestinati()

  return {
    eventiFalliti: falliti?.n ?? 0,
    primoFallitoIl: falliti?.primo ?? null,
    eventiFermi: fermi?.n ?? 0,
    primoFermoIl: fermi?.primo ?? null,
    fileSenzaCopia: senzaCopia,
    driveAttivo,
    fileNelCestino: cestinati,
  }
}

async function contaCestinati(): Promise<number> {
  const db = getDb()
  const [riga] = await db.execute<{ n: number }>(sql`
    select (
      (select count(*) from document_files where deleted_at is not null)
      + (select count(*) from payment_receipts where deleted_at is not null)
      + (select count(*) from survey_files where deleted_at is not null)
    )::int as n
  `)
  return riga?.n ?? 0
}

async function contaSenzaCopia(soglia: Date): Promise<number> {
  const db = getDb()

  const conta = async (
    tabella: typeof documentFiles | typeof paymentReceipts | typeof surveyFiles,
  ) => {
    const [riga] = await db
      .select({ n: count() })
      .from(tabella)
      .where(
        and(
          isNull(tabella.driveFileId),
          isNull(tabella.deletedAt),
          lt(tabella.uploadedAt, soglia),
        ),
      )
    return riga?.n ?? 0
  }

  // In serie e non con Promise.all: il pool è piccolo (vedere uno-alla-volta).
  return (
    (await conta(documentFiles)) +
    (await conta(paymentReceipts)) +
    (await conta(surveyFiles))
  )
}

/**
 * Righe pronte da mostrare o da mandare in un messaggio.
 * Vuoto significa che non c'è niente da dire.
 */
export function problemiLeggibili(stato: StatoSalute): readonly string[] {
  const righe: string[] = []

  if (stato.eventiFalliti > 0) {
    righe.push(
      `${stato.eventiFalliti} operazion${stato.eventiFalliti === 1 ? 'e' : 'i'} in coda ` +
        `${stato.eventiFalliti === 1 ? 'ha' : 'hanno'} smesso di riprovare` +
        (stato.primoFallitoIl ? ` (la più vecchia del ${data(stato.primoFallitoIl)})` : ''),
    )
  }

  if (stato.eventiFermi > 0) {
    righe.push(
      `${stato.eventiFermi} operazion${stato.eventiFermi === 1 ? 'e' : 'i'} ` +
        `in attesa da più di ${ORE_ATTESA_ANOMALA} ore: probabilmente la coda non viene smaltita`,
    )
  }

  if (stato.fileSenzaCopia > 0) {
    righe.push(
      `${stato.fileSenzaCopia} file ${stato.fileSenzaCopia === 1 ? 'esiste' : 'esistono'} ` +
        `in una copia sola da più di ${ORE_SENZA_COPIA} ore: la copia su Drive non è arrivata`,
    )
  }

  return righe
}

function data(valore: Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Rome',
  }).format(valore)
}
