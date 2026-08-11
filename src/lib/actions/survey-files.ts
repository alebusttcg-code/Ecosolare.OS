'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { surveyFiles, surveyTemplates, surveys } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import { ripulisciNome, validaFoto } from '@/lib/domain/upload'
import {
  campiVisibili,
  type DefinizioneQuestionario,
  type Risposte,
} from '@/lib/domain/questionnaire'
import { avviaSmaltimentoOutbox } from '@/lib/drive/avvia-outbox'
import { TIPO_COPIA_FOTO_SOPRALLUOGO } from '@/lib/drive/gestori'
import { accoda } from '@/lib/outbox'
import { getArchivio } from '@/lib/storage'
import type { ActionResult } from './opportunities'

export interface EsitoFotoSopralluogo {
  readonly fileId: string
  readonly nome: string
  readonly fieldCode: string
}

function idsCampo(risposte: Risposte, fieldCode: string): string[] {
  const valore = risposte[fieldCode]
  if (!Array.isArray(valore)) return []
  return valore.filter((v): v is string => typeof v === 'string')
}

function campoFotoValido(
  definizione: DefinizioneQuestionario,
  risposte: Risposte,
  fieldCode: string,
): boolean {
  return campiVisibili(definizione, risposte).some(
    (c) => c.code === fieldCode && c.type === 'foto',
  )
}

/**
 * Carica una fotografia per un campo del sopralluogo.
 *
 * Il file viene salvato subito (non al «Salva bozza»): sul tetto la connessione
 * puo' saltare e non si vuole perdere uno scatto gia' fatto.
 */
export async function uploadSurveyPhoto(
  formData: FormData,
): Promise<ActionResult<EsitoFotoSopralluogo>> {
  const utente = await guard('update', 'survey')

  const surveyId = String(formData.get('surveyId') ?? '')
  const fieldCode = String(formData.get('fieldCode') ?? '').trim()
  const file = formData.get('file')

  if (!z.uuid().safeParse(surveyId).success) {
    return { ok: false, errors: { _: 'Sopralluogo non indicato.' } }
  }
  if (!fieldCode) return { ok: false, errors: { fieldCode: 'Campo non indicato.' } }
  if (!(file instanceof File)) return { ok: false, errors: { file: 'Nessun file scelto.' } }

  const db = getDb()
  const sopralluogo = await db.query.surveys.findFirst({
    where: eq(surveys.id, surveyId),
  })
  if (!sopralluogo) return { ok: false, errors: { _: 'Sopralluogo non trovato.' } }
  if (sopralluogo.status === 'completato') {
    return { ok: false, errors: { _: 'Il sopralluogo è chiuso e non accetta nuove fotografie.' } }
  }

  const template = await db.query.surveyTemplates.findFirst({
    where: eq(surveyTemplates.id, sopralluogo.templateId),
  })
  if (!template) return { ok: false, errors: { _: 'Checklist non trovata.' } }

  const definizione = template.definition as DefinizioneQuestionario
  const risposteAttuali = (sopralluogo.answers ?? {}) as Risposte
  if (!campoFotoValido(definizione, risposteAttuali, fieldCode)) {
    return { ok: false, errors: { fieldCode: 'Campo fotografico non valido.' } }
  }

  const contenuto = new Uint8Array(await file.arrayBuffer())
  const esito = validaFoto({ byte: contenuto, dimensione: contenuto.byteLength })
  if (!esito.ok) return { ok: false, errors: { file: esito.motivo } }

  const archiviato = await getArchivio().salva({
    contenuto,
    estensione: esito.estensione,
    cartella: `sopralluoghi/${surveyId}`,
  })

  const nome = ripulisciNome(file.name)
  const adesso = new Date()

  const salvato = await db.transaction(async (tx) => {
    const [conteggio] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(surveyFiles)
      .where(and(eq(surveyFiles.surveyId, surveyId), eq(surveyFiles.fieldCode, fieldCode)))

    const [riga] = await tx
      .insert(surveyFiles)
      .values({
        surveyId,
        fieldCode,
        sortOrder: conteggio?.n ?? 0,
        storageKey: archiviato.chiave,
        filename: nome,
        mimeType: esito.tipo,
        sizeBytes: archiviato.dimensione,
        checksum: archiviato.checksum,
        uploadedBy: utente.id,
      })
      .returning({ id: surveyFiles.id })

    const ids = [...idsCampo(risposteAttuali, fieldCode), riga!.id]
    await tx
      .update(surveys)
      .set({
        answers: { ...risposteAttuali, [fieldCode]: ids },
        updatedAt: adesso,
      })
      .where(eq(surveys.id, surveyId))

    // Copia su Drive nella stessa transazione dell'inserimento (ADR-005):
    // una copia accodata per una foto che poi non esiste sarebbe un errore
    // ricorrente e inspiegabile.
    await accoda(tx, {
      type: TIPO_COPIA_FOTO_SOPRALLUOGO,
      payload: { surveyFileId: riga!.id },
      dedupKey: `${TIPO_COPIA_FOTO_SOPRALLUOGO}:${riga!.id}`,
    })

    return riga!
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'survey_file',
    entityId: salvato.id,
  })

  avviaSmaltimentoOutbox()
  revalidatePath(`/agenda/${surveyId}`)
  return { ok: true, data: { fileId: salvato.id, nome, fieldCode } }
}

/** Elimina una fotografia allegata al sopralluogo. */
export async function deleteSurveyPhoto(fileId: string): Promise<ActionResult> {
  const utente = await guard('update', 'survey')

  if (!z.uuid().safeParse(fileId).success) {
    return { ok: false, errors: { _: 'Identificativo non valido.' } }
  }

  const db = getDb()
  const file = await db.query.surveyFiles.findFirst({
    where: eq(surveyFiles.id, fileId),
  })
  if (!file) return { ok: false, errors: { _: 'Fotografia non trovata.' } }

  const sopralluogo = await db.query.surveys.findFirst({
    where: eq(surveys.id, file.surveyId),
  })
  if (!sopralluogo) return { ok: false, errors: { _: 'Sopralluogo non trovato.' } }
  if (sopralluogo.status === 'completato') {
    return { ok: false, errors: { _: 'Il sopralluogo è chiuso: le fotografie non si eliminano.' } }
  }

  const risposteAttuali = (sopralluogo.answers ?? {}) as Risposte
  const ids = idsCampo(risposteAttuali, file.fieldCode).filter((id) => id !== fileId)

  // Cestino, non cancellazione (D-017). Una foto di sopralluogo si rifà solo
  // tornando sul tetto: è il file meno ricostruibile di tutto il sistema.
  await db.transaction(async (tx) => {
    await tx
      .update(surveyFiles)
      .set({ deletedAt: new Date(), deletedBy: utente.id })
      .where(eq(surveyFiles.id, fileId))
    await tx
      .update(surveys)
      .set({
        answers: { ...risposteAttuali, [file.fieldCode]: ids.length > 0 ? ids : null },
        updatedAt: new Date(),
      })
      .where(eq(surveys.id, file.surveyId))
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'delete',
    entityType: 'survey_file',
    entityId: fileId,
  })

  revalidatePath(`/agenda/${file.surveyId}`)
  return { ok: true, data: undefined }
}
