'use server'

import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/db'
import { documentFiles, documentRequirements } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import { TIPO_COPIA_DOCUMENTO } from '@/lib/drive/gestori'
import { accoda } from '@/lib/outbox'
import { ripulisciNome, validaFile } from '@/lib/domain/upload'
import { getArchivio } from '@/lib/storage'
import type { ActionResult } from './opportunities'
import { ricalcolaReadinessInterno } from './projects'

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

  if (!requirementId) return { ok: false, errors: { _: 'Requisito non indicato.' } }
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

  await ricalcolaReadinessInterno(requisito.projectId)
  revalidatePath(`/commesse/${requisito.projectId}`)
  revalidatePath('/commesse')

  return { ok: true, data: { fileId: salvato.id, versione, nome } }
}

/** Elimina l'ultima versione caricata, riportando il requisito a «richiesto». */
export async function deleteDocumentFile(fileId: string): Promise<ActionResult> {
  const utente = await guard('delete', 'document')

  const db = getDb()
  const file = await db.query.documentFiles.findFirst({
    where: eq(documentFiles.id, fileId),
  })
  if (!file) return { ok: false, errors: { _: 'File non trovato.' } }

  const requisito = await db.query.documentRequirements.findFirst({
    where: eq(documentRequirements.id, file.requirementId),
  })

  await getArchivio().elimina(file.storageKey)
  await db.delete(documentFiles).where(eq(documentFiles.id, fileId))

  const [rimasto] = await db
    .select({ id: documentFiles.id })
    .from(documentFiles)
    .where(eq(documentFiles.requirementId, file.requirementId))
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
    await ricalcolaReadinessInterno(requisito.projectId)
    revalidatePath(`/commesse/${requisito.projectId}`)
  }
  return { ok: true, data: undefined }
}
