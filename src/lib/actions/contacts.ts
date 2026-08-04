'use server'

import { and, eq, isNull, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { contacts } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import { findDuplicates, type DedupSubject } from '@/lib/domain/dedup'
import { normalizeEmail, normalizePhone } from '@/lib/domain/phone'

const contactSchema = z.object({
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().min(1, 'Il cognome e obbligatorio').max(80),
  email: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  taxCode: z.string().trim().max(16).optional(),
  city: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
  marketingConsent: z.boolean().default(false),
  /** Conferma esplicita dell'utente che non si tratta di un duplicato. */
  confermaNonDuplicato: z.boolean().default(false),
})

export type ContactInput = z.input<typeof contactSchema>

export interface DuplicatoSegnalato {
  readonly id: string
  readonly nome: string
  readonly score: number
  readonly motivi: readonly string[]
}

export type CreateContactResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly errors: Record<string, string> }
  | { readonly ok: false; readonly duplicati: readonly DuplicatoSegnalato[] }

/**
 * Cerca i possibili duplicati restringendo i candidati con una query mirata:
 * si guardano solo i contatti che condividono una chiave forte o il cognome,
 * non l'intera anagrafica.
 */
async function cercaDuplicati(soggetto: DedupSubject) {
  const condizioni = [eq(contacts.lastName, soggetto.lastName)]
  if (soggetto.phoneE164) condizioni.push(eq(contacts.phoneE164, soggetto.phoneE164))
  if (soggetto.emailNormalized) {
    condizioni.push(eq(contacts.emailNormalized, soggetto.emailNormalized))
  }
  if (soggetto.taxCode) condizioni.push(eq(contacts.taxCode, soggetto.taxCode))

  const candidati = await getDb()
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      phoneE164: contacts.phoneE164,
      emailNormalized: contacts.emailNormalized,
      taxCode: contacts.taxCode,
    })
    .from(contacts)
    .where(and(or(...condizioni), isNull(contacts.deletedAt)))
    .limit(50)

  return findDuplicates(
    soggetto,
    candidati.map((c) => ({ ...c, city: null })),
  )
}

function raccogliErrori(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of issues) {
    const campo = issue.path.join('.') || '_'
    errors[campo] ??= issue.message
  }
  return errors
}

export async function createContact(input: ContactInput): Promise<CreateContactResult> {
  const utente = await guard('create', 'contact')

  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: raccogliErrori(parsed.error.issues) }

  const dati = parsed.data
  const telefono = normalizePhone(dati.phone)
  const email = normalizeEmail(dati.email)

  const soggetto: DedupSubject = {
    phoneE164: telefono.e164,
    emailNormalized: email,
    taxCode: dati.taxCode?.toUpperCase() ?? null,
    lastName: dati.lastName,
    firstName: dati.firstName ?? null,
    city: dati.city ?? null,
  }

  // Il duplicato viene proposto, mai fuso in automatico (US-02.2): serve una
  // conferma esplicita per creare comunque un contatto nuovo.
  if (!dati.confermaNonDuplicato) {
    const duplicati = await cercaDuplicati(soggetto)
    if (duplicati.length > 0) {
      return {
        ok: false,
        duplicati: duplicati.map((d) => ({
          id: d.record.id,
          nome: [d.record.firstName, d.record.lastName].filter(Boolean).join(' '),
          score: d.result.score,
          motivi: d.result.reasons,
        })),
      }
    }
  }

  const [creato] = await getDb()
    .insert(contacts)
    .values({
      firstName: dati.firstName ?? null,
      lastName: dati.lastName,
      email: dati.email ?? null,
      emailNormalized: email,
      phone: telefono.raw || null,
      phoneE164: telefono.e164,
      taxCode: dati.taxCode?.toUpperCase() ?? null,
      notes: dati.notes ?? null,
      marketingConsent: dati.marketingConsent,
      marketingConsentAt: dati.marketingConsent ? new Date() : null,
      marketingConsentSource: dati.marketingConsent ? 'inserimento manuale' : null,
      createdBy: utente.id,
      updatedBy: utente.id,
    })
    .returning({ id: contacts.id })

  if (!creato) return { ok: false, errors: { _: 'Creazione non riuscita.' } }

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'contact',
    entityId: creato.id,
  })

  revalidatePath('/clienti')
  return { ok: true, id: creato.id }
}
