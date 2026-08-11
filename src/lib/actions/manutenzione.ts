'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { documentFiles, documentRequirements, paymentReceipts, surveyFiles, surveys } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import { avviaSmaltimentoOutbox } from '@/lib/drive/avvia-outbox'
import { ripristinaFile } from '@/lib/drive/client'
import { riprovaFalliti } from '@/lib/outbox'
import type { ActionResult } from './opportunities'

/**
 * Azioni di manutenzione.
 *
 * Tutte sotto `settings`, cioè solo amministratore: ripristinare un documento
 * che qualcun altro ha eliminato e rimettere in coda operazioni fallite sono
 * decisioni che devono passare da una persona sola, con l'audit che lo registra.
 */

const cestinoSchema = z.object({
  genere: z.enum(['documento', 'contabile', 'fotografia']),
  id: z.uuid(),
})

/**
 * Rimette in coda tutto ciò che si era arreso.
 *
 * Da usare **dopo** aver risolto la causa — credenziali sistemate, permesso
 * concesso, spazio liberato. Rilanciarlo prima non fa danni: gli eventi
 * ritentano, falliscono di nuovo e tornano nello stesso stato.
 */
export async function riprovaOperazioniFallite(): Promise<ActionResult<{ rimessi: number }>> {
  const utente = await guard('update', 'settings')

  const rimessi = await riprovaFalliti()

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'outbox',
    entityId: 'falliti',
    after: { rimessiInCoda: rimessi },
  })

  // Parte subito invece di aspettare il cron: chi preme il pulsante si aspetta
  // di vedere un risultato, non di scoprirlo domani mattina.
  avviaSmaltimentoOutbox()
  revalidatePath('/amministrazione/impostazioni')
  revalidatePath('/')
  return { ok: true, data: { rimessi } }
}

/**
 * Riporta fuori dal cestino un file eliminato.
 *
 * Il file non è mai stato cancellato dall'archivio (D-017): ripristinare
 * significa togliere `deleted_at` e rimettere la copia fuori dal cestino di
 * Drive. È per questo che l'operazione riesce sempre, anche a mesi di distanza.
 */
export async function ripristinaDalCestino(
  input: z.input<typeof cestinoSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'settings')

  const parsed = cestinoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: { _: 'Richiesta non valida.' } }
  const { genere, id } = parsed.data

  const db = getDb()

  if (genere === 'documento') {
    const file = await db.query.documentFiles.findFirst({
      where: eq(documentFiles.id, id),
    })
    if (!file?.deletedAt) return { ok: false, errors: { _: 'Documento non nel cestino.' } }

    await db
      .update(documentFiles)
      .set({ deletedAt: null, deletedBy: null })
      .where(eq(documentFiles.id, id))
    await fuoriDalCestinoDrive(file.driveFileId)

    // Il requisito era tornato «richiesto» quando era rimasto senza file:
    // se questo è di nuovo l'unico, va rimesso in verifica.
    await db
      .update(documentRequirements)
      .set({ status: 'da_verificare', statusSince: new Date() })
      .where(eq(documentRequirements.id, file.requirementId))

    revalidatePath('/cantieri')
  }

  if (genere === 'contabile') {
    const file = await db.query.paymentReceipts.findFirst({
      where: eq(paymentReceipts.id, id),
    })
    if (!file?.deletedAt) return { ok: false, errors: { _: 'Contabile non nel cestino.' } }

    await db
      .update(paymentReceipts)
      .set({ deletedAt: null, deletedBy: null })
      .where(eq(paymentReceipts.id, id))
    await fuoriDalCestinoDrive(file.driveFileId)

    revalidatePath('/controllo-bancario')
  }

  if (genere === 'fotografia') {
    const file = await db.query.surveyFiles.findFirst({
      where: eq(surveyFiles.id, id),
    })
    if (!file?.deletedAt) return { ok: false, errors: { _: 'Fotografia non nel cestino.' } }

    const sopralluogo = await db.query.surveys.findFirst({
      where: eq(surveys.id, file.surveyId),
    })

    await db
      .update(surveyFiles)
      .set({ deletedAt: null, deletedBy: null })
      .where(eq(surveyFiles.id, id))
    await fuoriDalCestinoDrive(file.driveFileId)

    // Le risposte del questionario elencano gli id delle foto: eliminandola era
    // stata tolta da lì, e senza rimetterla il file esisterebbe senza comparire.
    if (sopralluogo) {
      const risposte = (sopralluogo.answers ?? {}) as Record<string, unknown>
      const attuali = Array.isArray(risposte[file.fieldCode])
        ? (risposte[file.fieldCode] as unknown[]).filter(
            (v): v is string => typeof v === 'string',
          )
        : []
      if (!attuali.includes(id)) {
        await db
          .update(surveys)
          .set({
            answers: { ...risposte, [file.fieldCode]: [...attuali, id] },
            updatedAt: new Date(),
          })
          .where(eq(surveys.id, file.surveyId))
      }
      revalidatePath(`/agenda/${file.surveyId}`)
    }
  }

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: genere === 'documento' ? 'document_file' : genere === 'contabile' ? 'payment_receipt' : 'survey_file',
    entityId: id,
    before: { deletedAt: '(nel cestino)' },
    after: { deletedAt: null },
  })

  revalidatePath('/amministrazione/impostazioni')
  return { ok: true, data: undefined }
}

/**
 * Rimette il file fuori dal cestino di Drive.
 *
 * Non solleva: il ripristino nel gestionale è già avvenuto e vale comunque —
 * la copia su Drive si riallinea al passaggio successivo della coda.
 */
async function fuoriDalCestinoDrive(driveFileId: string | null): Promise<void> {
  if (!driveFileId) return
  try {
    await ripristinaFile(driveFileId)
  } catch (errore) {
    console.warn('[drive] ripristino dal cestino non riuscito', {
      driveFileId,
      errore: errore instanceof Error ? errore.message : errore,
    })
  }
}
