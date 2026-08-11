import { and, asc, isNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { documentFiles, paymentReceipts, surveyFiles } from '@/db/schema'
import {
  elaboraOutbox,
  accoda,
  riprovaFalliti,
  type EsitoElaborazione,
} from '@/lib/outbox'
import { driveConfigurato } from './client'
import {
  gestoriDrive,
  TIPO_COPIA_CONTABILE,
  TIPO_COPIA_DOCUMENTO,
  TIPO_COPIA_FOTO_SOPRALLUOGO,
} from './gestori'

export interface OpzioniSmaltimento {
  /** Rimette in coda gli eventi `fallito` (cron / manutenzione, non dopo ogni upload). */
  readonly ripristinaFalliti?: boolean
  /** Ripassa l'archivio in cerca di file senza copia su Drive. Solo dal cron. */
  readonly recuperaMancanti?: boolean
}

/**
 * Smaltisce la coda Drive.
 *
 * Se Drive non è configurato non tocca gli eventi: restano `in_attesa` finché
 * le credenziali non ci sono (meglio di segnarli `fallito` per «nessun gestore»).
 */
export async function smaltisciCodaDrive(
  opzioni: OpzioniSmaltimento = {},
): Promise<EsitoElaborazione> {
  if (!driveConfigurato()) {
    return { elaborati: 0, completati: 0, rimandati: 0, falliti: 0 }
  }

  if (opzioni.ripristinaFalliti) {
    await riprovaFalliti()
  }

  // Il recupero delle copie mancanti scansiona tre tabelle intere: ha senso dal
  // cron, non dopo ogni singolo caricamento — lì l'evento è già stato accodato
  // dalla transazione che ha creato la riga.
  if (opzioni.recuperaMancanti) {
    await accodaCopieDriveMancanti()
  }

  return elaboraOutbox(gestoriDrive())
}

/**
 * File in archivio senza copia su Drive: li rimette in coda.
 *
 * `order by` sulla data di caricamento non è un vezzo: con `limit` e senza
 * ordinamento PostgreSQL è libero di restituire sempre lo stesso insieme, e con
 * un arretrato di più di cento file i rimanenti non partirebbero mai.
 *
 * I cestinati sono esclusi: portare su Drive un file che qualcuno ha eliminato
 * lo farebbe ricomparire nella cartella del cliente.
 */
export async function accodaCopieDriveMancanti(): Promise<number> {
  const db = getDb()
  let considerati = 0

  const documenti = await db
    .select({ id: documentFiles.id })
    .from(documentFiles)
    .where(and(isNull(documentFiles.driveFileId), isNull(documentFiles.deletedAt)))
    .orderBy(asc(documentFiles.uploadedAt))
    .limit(100)

  for (const riga of documenti) {
    await accoda(db, {
      type: TIPO_COPIA_DOCUMENTO,
      payload: { documentFileId: riga.id },
      dedupKey: `${TIPO_COPIA_DOCUMENTO}:${riga.id}`,
    })
    considerati += 1
  }

  const contabili = await db
    .select({ id: paymentReceipts.id })
    .from(paymentReceipts)
    .where(and(isNull(paymentReceipts.driveFileId), isNull(paymentReceipts.deletedAt)))
    .orderBy(asc(paymentReceipts.uploadedAt))
    .limit(100)

  for (const riga of contabili) {
    await accoda(db, {
      type: TIPO_COPIA_CONTABILE,
      payload: { paymentReceiptId: riga.id },
      dedupKey: `${TIPO_COPIA_CONTABILE}:${riga.id}`,
    })
    considerati += 1
  }

  const foto = await db
    .select({ id: surveyFiles.id })
    .from(surveyFiles)
    .where(and(isNull(surveyFiles.driveFileId), isNull(surveyFiles.deletedAt)))
    .orderBy(asc(surveyFiles.uploadedAt))
    .limit(100)

  for (const riga of foto) {
    await accoda(db, {
      type: TIPO_COPIA_FOTO_SOPRALLUOGO,
      payload: { surveyFileId: riga.id },
      dedupKey: `${TIPO_COPIA_FOTO_SOPRALLUOGO}:${riga.id}`,
    })
    considerati += 1
  }

  return considerati
}
