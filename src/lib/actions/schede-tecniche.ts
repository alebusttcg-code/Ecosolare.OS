'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { PDFDocument } from 'pdf-lib'
import { z } from 'zod'
import { getDb } from '@/db'
import { productDocuments, products } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import { leggiSelezionePagine } from '@/lib/domain/selezione-pagine'
import { ripulisciNome, validaFile } from '@/lib/domain/upload'
import { getArchivio } from '@/lib/storage'
import type { ActionResult } from './opportunities'

/**
 * Le schede tecniche dei prodotti: caricamento e ritiro.
 *
 * Sono i fogli che chiudono il preventivo — la scheda del pannello, quella
 * dell'inverter, quella della batteria. Fino a ieri erano PDF sparsi su un
 * disco che qualcuno allegava a mano al momento dell'invio, e bastava una
 * distrazione perché il cliente ricevesse la scheda della batteria che non ha
 * comprato o la revisione dell'anno prima.
 *
 * Qui la scheda sta attaccata al **prodotto**: se il prodotto è nel preventivo,
 * la sua scheda ci finisce da sola (`getDocumentiTecniciProdotti`). Il
 * commerciale non sceglie e non può sbagliare.
 *
 * Tre proprietà che vale la pena dichiarare:
 *
 *  1. **Si controlla che sia davvero un PDF leggibile**, non che si chiami
 *     `.pdf`: il documento verrà aperto da pdf-lib in fase di generazione, e un
 *     file rotto scoperto lì è un preventivo che non esce mentre il cliente
 *     aspetta al telefono.
 *  2. **Le versioni convivono.** Una nuova revisione non sovrascrive la
 *     precedente: i preventivi già inviati congelano nello snapshot la scheda
 *     con cui sono partiti, e quel file deve restare leggibile.
 *  3. **Niente si cancella** (ADR-012). Ritirare una scheda significa
 *     `is_active = false`: sparisce dai preventivi futuri, resta per quelli
 *     passati.
 */

const PERCORSO = '/amministrazione/prodotti'

const schemaCaricamento = z.object({
  productId: z.uuid('Prodotto non indicato.'),
  title: z
    .string()
    .trim()
    .min(3, 'Il titolo deve avere almeno 3 caratteri.')
    .max(160, 'Il titolo è troppo lungo.'),
  versionLabel: z
    .string()
    .trim()
    .min(1, 'Indicare la revisione (per esempio «rev. 2026-03» o «v4»).')
    .max(40, 'La revisione è troppo lunga.'),
  category: z.enum(['scheda_tecnica', 'certificazione', 'garanzia', 'manuale']),
  sortOrder: z.coerce.number().int().min(0).max(999),
  /** Vuoto = tutte le pagine. Altrimenti «1,3,5» o «1-4». */
  includedPages: z.string().trim().max(120),
})

export interface EsitoSchedaTecnica {
  readonly id: string
  readonly pagine: number
}

export async function caricaSchedaTecnica(
  formData: FormData,
): Promise<ActionResult<EsitoSchedaTecnica>> {
  const utente = await guard('update', 'settings')

  const analisi = schemaCaricamento.safeParse({
    productId: formData.get('productId') ?? '',
    title: formData.get('title') ?? '',
    versionLabel: formData.get('versionLabel') ?? '',
    category: formData.get('category') ?? 'scheda_tecnica',
    sortOrder: formData.get('sortOrder') ?? 0,
    includedPages: formData.get('includedPages') ?? '',
  })
  if (!analisi.success) {
    const errori: Record<string, string> = {}
    for (const problema of analisi.error.issues) {
      errori[String(problema.path[0] ?? '_')] = problema.message
    }
    return { ok: false, errors: errori }
  }
  const dati = analisi.data

  const selezione = leggiSelezionePagine(dati.includedPages)
  if (selezione === 'errore') {
    return {
      ok: false,
      errors: { includedPages: 'Scrivere le pagine come «1,3,5» o «2-6», oppure lasciare vuoto.' },
    }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, errors: { file: 'Nessun file scelto.' } }

  const contenuto = new Uint8Array(await file.arrayBuffer())
  const esito = validaFile({
    byte: contenuto,
    dimensione: contenuto.byteLength,
    tipoDichiarato: file.type,
  })
  if (!esito.ok) return { ok: false, errors: { file: esito.motivo } }
  if (esito.tipo !== 'application/pdf') {
    return { ok: false, errors: { file: 'La scheda tecnica deve essere un PDF.' } }
  }

  // Si apre qui, non alla generazione del preventivo: un PDF cifrato o
  // corrotto deve fermarsi mentre chi l'ha caricato è ancora davanti allo
  // schermo e può rimediare.
  let numeroPagine: number
  try {
    numeroPagine = (await PDFDocument.load(contenuto)).getPageCount()
  } catch {
    return {
      ok: false,
      errors: { file: 'Il PDF non è leggibile (protetto da password o danneggiato).' },
    }
  }
  if (numeroPagine === 0) {
    return { ok: false, errors: { file: 'Il PDF non contiene pagine.' } }
  }

  const fuori = selezione?.filter((pagina) => pagina > numeroPagine) ?? []
  if (fuori.length > 0) {
    return {
      ok: false,
      errors: {
        includedPages: `Il documento ha ${numeroPagine} pagine: ${fuori.join(', ')} non esiste.`,
      },
    }
  }

  const db = getDb()
  const prodotto = await db.query.products.findFirst({
    where: eq(products.id, dati.productId),
    columns: { id: true, name: true },
  })
  if (!prodotto) return { ok: false, errors: { _: 'Prodotto non trovato.' } }

  const gemella = await db.query.productDocuments.findFirst({
    where: and(
      eq(productDocuments.productId, dati.productId),
      eq(productDocuments.category, dati.category),
      eq(productDocuments.versionLabel, dati.versionLabel),
    ),
    columns: { id: true },
  })
  if (gemella) {
    return {
      ok: false,
      errors: { versionLabel: 'Esiste già un documento con questa revisione per il prodotto.' },
    }
  }

  const archiviato = await getArchivio().salva({
    contenuto,
    estensione: 'pdf',
    cartella: `prodotti/${dati.productId}`,
  })

  const [riga] = await db
    .insert(productDocuments)
    .values({
      productId: dati.productId,
      category: dati.category,
      title: dati.title,
      versionLabel: dati.versionLabel,
      storageKey: archiviato.chiave,
      filename: ripulisciNome(file.name),
      mimeType: 'application/pdf',
      checksum: archiviato.checksum,
      includedPages: selezione,
      sortOrder: dati.sortOrder,
      createdBy: utente.id,
    })
    .returning({ id: productDocuments.id })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'product_document',
    entityId: riga!.id,
  })

  revalidatePath(PERCORSO)
  return {
    ok: true,
    data: { id: riga!.id, pagine: selezione?.length ?? numeroPagine },
  }
}

/**
 * Ritira una scheda dai preventivi futuri.
 *
 * Non cancella: i preventivi già inviati la citano nel loro snapshot e devono
 * poter essere ristampati identici a come sono partiti.
 */
export async function ritiraSchedaTecnica(id: string): Promise<ActionResult> {
  const utente = await guard('update', 'settings')
  if (!z.uuid().safeParse(id).success) {
    return { ok: false, errors: { _: 'Identificativo non valido.' } }
  }

  const db = getDb()
  const aggiornate = await db
    .update(productDocuments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(productDocuments.id, id), eq(productDocuments.isActive, true)))
    .returning({ id: productDocuments.id })

  if (aggiornate.length === 0) {
    return { ok: false, errors: { _: 'Documento non trovato o già ritirato.' } }
  }

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'product_document',
    entityId: id,
  })

  revalidatePath(PERCORSO)
  return { ok: true, data: undefined }
}

/** Rimette in servizio una scheda ritirata per errore. */
export async function ripristinaSchedaTecnica(id: string): Promise<ActionResult> {
  const utente = await guard('update', 'settings')
  if (!z.uuid().safeParse(id).success) {
    return { ok: false, errors: { _: 'Identificativo non valido.' } }
  }

  const db = getDb()
  const aggiornate = await db
    .update(productDocuments)
    .set({ isActive: true, updatedAt: new Date() })
    .where(and(eq(productDocuments.id, id), eq(productDocuments.isActive, false)))
    .returning({ id: productDocuments.id })

  if (aggiornate.length === 0) {
    return { ok: false, errors: { _: 'Documento non trovato o già in servizio.' } }
  }

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'product_document',
    entityId: id,
  })

  revalidatePath(PERCORSO)
  return { ok: true, data: undefined }
}
