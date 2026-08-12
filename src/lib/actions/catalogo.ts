'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { products } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import type { ActionResult } from './opportunities'

/**
 * I dati tecnici del catalogo prodotti.
 *
 * Le colonne esistono dalla migrazione 0021 e fino a oggi **nessuno poteva
 * compilarle**: su ogni prodotto in archivio erano tutte nulle. Il preventivo
 * girava interamente sui ripieghi — il ruolo dedotto dalla descrizione, la
 * capacità estratta con un'espressione regolare da «Batteria di accumulo 10
 * kWh». Funziona finché qualcuno non scrive la riga diversamente, e allora
 * l'accumulo sparisce dai calcoli senza che niente lo dica.
 *
 * Questi campi sono ciò che rende il preventivo calcolato invece che
 * raccontato: cambiare la batteria nel listino deve cambiare i numeri del PDF.
 */

const PERCORSO = '/amministrazione/prodotti'

/** Un numero scritto da una persona: virgola o punto, vuoto significa «non so». */
const numeroOpzionale = (massimo: number) =>
  z
    .string()
    .trim()
    .transform((valore) => valore.replace(',', '.'))
    .refine(
      (valore) => valore === '' || Number.isFinite(Number.parseFloat(valore)),
      'Non è un numero.',
    )
    .transform((valore) => (valore === '' ? null : Number.parseFloat(valore)))
    .refine(
      (valore) => valore === null || (valore > 0 && valore <= massimo),
      `Deve stare fra 0 e ${massimo.toLocaleString('it-IT')}.`,
    )

const schema = z.object({
  productId: z.uuid('Prodotto non indicato.'),
  componentRole: z.enum([
    'modulo',
    'inverter',
    'accumulo',
    'struttura',
    'quadro',
    'pompa_calore',
    'altro',
    '',
  ]),
  brand: z.string().trim().max(80),
  model: z.string().trim().max(80),
  /** Potenza di picco del singolo modulo. Oltre gli 800 W non è un modulo. */
  ratedPowerW: numeroOpzionale(800),
  /** Potenza nominale in alternata dell'inverter. */
  acPowerKw: numeroOpzionale(200),
  /** Capacità di targa dell'accumulo. */
  capacityKwh: numeroOpzionale(500),
  /** SCOP: sotto 1 non è una pompa di calore, sopra 8 non esiste. */
  scop: numeroOpzionale(8),
})

export async function aggiornaDatiTecniciProdotto(
  formData: FormData,
): Promise<ActionResult> {
  const utente = await guard('update', 'settings')

  const analisi = schema.safeParse({
    productId: formData.get('productId') ?? '',
    componentRole: formData.get('componentRole') ?? '',
    brand: formData.get('brand') ?? '',
    model: formData.get('model') ?? '',
    ratedPowerW: formData.get('ratedPowerW') ?? '',
    acPowerKw: formData.get('acPowerKw') ?? '',
    capacityKwh: formData.get('capacityKwh') ?? '',
    scop: formData.get('scop') ?? '',
  })
  if (!analisi.success) {
    const errori: Record<string, string> = {}
    for (const problema of analisi.error.issues) {
      errori[String(problema.path[0] ?? '_')] = problema.message
    }
    return { ok: false, errors: errori }
  }
  const dati = analisi.data

  if (dati.scop !== null && dati.scop < 1) {
    return { ok: false, errors: { scop: 'Uno SCOP sotto 1 non è una pompa di calore.' } }
  }

  const db = getDb()
  const prodotto = await db.query.products.findFirst({
    where: eq(products.id, dati.productId),
    columns: { id: true },
  })
  if (!prodotto) return { ok: false, errors: { _: 'Prodotto non trovato.' } }

  await db
    .update(products)
    .set({
      componentRole: dati.componentRole === '' ? null : dati.componentRole,
      brand: dati.brand || null,
      model: dati.model || null,
      ratedPowerW: dati.ratedPowerW === null ? null : Math.round(dati.ratedPowerW),
      // I numerici di Postgres viaggiano come stringhe: passare un `number`
      // farebbe arrotondare al driver invece che al database.
      acPowerKw: dati.acPowerKw === null ? null : String(dati.acPowerKw),
      capacityKwh: dati.capacityKwh === null ? null : String(dati.capacityKwh),
      scop: dati.scop === null ? null : String(dati.scop),
      updatedAt: new Date(),
      updatedBy: utente.id,
    })
    .where(eq(products.id, dati.productId))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'product',
    entityId: dati.productId,
  })

  revalidatePath(PERCORSO)
  return { ok: true, data: undefined }
}
