import { isNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { documentFiles, paymentReceipts } from '@/db/schema'
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
} from './gestori'

export interface OpzioniSmaltimento {
  /** Rimette in coda gli eventi `fallito` (cron / manutenzione, non dopo ogni upload). */
  readonly ripristinaFalliti?: boolean
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
  await accodaCopieDriveMancanti()
  return elaboraOutbox(gestoriDrive())
}

/**
 * Documenti e contabili già in archivio ma senza `drive_file_id`: li rimette
 * in coda (upload precedenti all’accodamento, o eventi mai creati).
 */
export async function accodaCopieDriveMancanti(): Promise<number> {
  const db = getDb()
  let considerati = 0

  const documenti = await db
    .select({ id: documentFiles.id })
    .from(documentFiles)
    .where(isNull(documentFiles.driveFileId))
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
    .where(isNull(paymentReceipts.driveFileId))
    .limit(100)

  for (const riga of contabili) {
    await accoda(db, {
      type: TIPO_COPIA_CONTABILE,
      payload: { paymentReceiptId: riga.id },
      dedupKey: `${TIPO_COPIA_CONTABILE}:${riga.id}`,
    })
    considerati += 1
  }

  return considerati
}
