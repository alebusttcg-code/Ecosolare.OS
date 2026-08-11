'use server'

import { and, desc, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { documentFiles, documentRequirements } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import { TIPO_COPIA_DOCUMENTO } from '@/lib/drive/gestori'
import { avviaSmaltimentoOutbox } from '@/lib/drive/avvia-outbox'
import { cestinaFile } from '@/lib/drive/client'
import { accoda } from '@/lib/outbox'
import { ripulisciNome, validaFile } from '@/lib/domain/upload'
import { getArchivio } from '@/lib/storage'
import type { ActionResult } from './opportunities'
import { ricalcolaReadiness } from '@/lib/readiness'

export interface EsitoCaricamento {
  readonly fileId: string
  readonly versione: number
  readonly nome: string
}

/**
 * Carica un file a fronte di un requisito documentale.
 *
 * Tre proprietà:
 *
 *  1. **Si valida il contenuto, non l'etichetta.** Il tipo dichiarato dal
 *     browser non è una prova (vedere `validaFile`).
 *  2. **Le versioni si accumulano, non si sovrascrivono.** Se il cliente manda
 *     una bolletta migliore, la precedente resta: serve a ricostruire cosa era
 *     stato allegato a una pratica già inviata.
 *  3. **Caricare non vuol dire approvare.** Il requisito passa a
 *     «da verificare», e finché qualcuno non lo approva resta un impedimento
 *     alla partenza del cantiere.
 */
export async function uploadDocument(
  formData: FormData,
): Promise<ActionResult<EsitoCaricamento>> {
  const utente = await guard('update', 'document')

  const requirementId = String(formData.get('requirementId') ?? '')
  const file = formData.get('file')

  if (!z.uuid().safeParse(requirementId).success) {
    return { ok: false, errors: { _: 'Requisito non indicato.' } }
  }
  if (!(file instanceof File)) return { ok: false, errors: { file: 'Nessun file scelto.' } }

  const db = getDb()
  const requisito = await db.query.documentRequirements.findFirst({
    where: eq(documentRequirements.id, requirementId),
  })
  if (!requisito) return { ok: false, errors: { _: 'Requisito non trovato.' } }

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
    cartella: `commesse/${requisito.projectId}`,
  })

  // Deliberatamente SENZA filtro sul cestino: i numeri di versione devono
  // crescere sempre. Riusare il numero di una versione cestinata farebbe
  // fallire il ripristino contro l'indice univoco (requisito, versione).
  const [ultima] = await db
    .select({ versionNo: documentFiles.versionNo })
    .from(documentFiles)
    .where(eq(documentFiles.requirementId, requirementId))
    .orderBy(desc(documentFiles.versionNo))
    .limit(1)

  const versione = (ultima?.versionNo ?? 0) + 1
  const nome = ripulisciNome(file.name)

  // Riga del file e richiesta di copia su Drive nella stessa transazione: una
  // copia accodata per un file che poi non esiste sarebbe un errore ricorrente
  // e inspiegabile (ADR-005).
  const salvato = await db.transaction(async (tx) => {
    const [riga] = await tx
      .insert(documentFiles)
      .values({
        requirementId,
        versionNo: versione,
        storageKey: archiviato.chiave,
        filename: nome,
        mimeType: esito.tipo,
        sizeBytes: archiviato.dimensione,
        checksum: archiviato.checksum,
        source: 'interno',
        uploadedBy: utente.id,
      })
      .returning({ id: documentFiles.id })

    await accoda(tx, {
      type: TIPO_COPIA_DOCUMENTO,
      payload: { documentFileId: riga!.id },
      dedupKey: `${TIPO_COPIA_DOCUMENTO}:${riga!.id}`,
    })

    return riga!
  })

  // Caricato ≠ verificato: resta un impedimento finché qualcuno non lo approva.
  await db
    .update(documentRequirements)
    .set({ status: 'da_verificare', statusSince: new Date(), rejectionReason: null })
    .where(eq(documentRequirements.id, requirementId))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'document_file',
    entityId: salvato.id,
  })

  await ricalcolaReadiness(requisito.projectId)
  revalidatePath(`/cantieri/${requisito.projectId}`)
  revalidatePath('/cantieri')

  avviaSmaltimentoOutbox()
  return { ok: true, data: { fileId: salvato.id, versione, nome } }
}

/** Elimina l'ultima versione caricata, riportando il requisito a «richiesto». */
/**
 * Elimina un documento — cioè lo mette nel cestino (D-017).
 *
 * **Non cancella niente.** La riga resta con `deleted_at`, il file resta in
 * archivio, la copia su Drive va nel cestino di Drive per non restare visibile
 * in una cartella dove non dovrebbe più stare.
 *
 * Il motivo è asimmetrico e vale la pena dirlo: tenere un file che nessuno
 * voleva costa qualche centesimo di spazio; perdere una bolletta che il cliente
 * aveva mandato una volta sola costa una telefonata, una settimana di attesa e
 * la fiducia di chi la sta chiedendo per la seconda volta.
 */
export async function deleteDocumentFile(fileId: string): Promise<ActionResult> {
  const utente = await guard('delete', 'document')

  if (!z.uuid().safeParse(fileId).success) {
    return { ok: false, errors: { _: 'Identificativo non valido.' } }
  }

  const db = getDb()
  const file = await db.query.documentFiles.findFirst({
    where: and(eq(documentFiles.id, fileId), isNull(documentFiles.deletedAt)),
  })
  if (!file) return { ok: false, errors: { _: 'File non trovato.' } }

  const requisito = await db.query.documentRequirements.findFirst({
    where: eq(documentRequirements.id, file.requirementId),
  })

  await db
    .update(documentFiles)
    .set({ deletedAt: new Date(), deletedBy: utente.id })
    .where(eq(documentFiles.id, fileId))

  if (file.driveFileId) {
    try {
      await cestinaFile(file.driveFileId)
    } catch (errore) {
      // Drive irraggiungibile non deve impedire l'eliminazione: la verità è la
      // riga, e la copia su Drive si riallinea al prossimo passaggio.
      console.warn('[drive] spostamento nel cestino non riuscito', {
        fileId,
        driveFileId: file.driveFileId,
        errore: errore instanceof Error ? errore.message : errore,
      })
    }
  }

  const [rimasto] = await db
    .select({ id: documentFiles.id })
    .from(documentFiles)
    .where(
      and(
        eq(documentFiles.requirementId, file.requirementId),
        isNull(documentFiles.deletedAt),
      ),
    )
    .limit(1)

  if (!rimasto) {
    await db
      .update(documentRequirements)
      .set({ status: 'richiesto', statusSince: new Date() })
      .where(eq(documentRequirements.id, file.requirementId))
  }

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'delete',
    entityType: 'document_file',
    entityId: fileId,
  })

  if (requisito) {
    await ricalcolaReadiness(requisito.projectId)
    revalidatePath(`/cantieri/${requisito.projectId}`)
  }
  return { ok: true, data: undefined }
}

