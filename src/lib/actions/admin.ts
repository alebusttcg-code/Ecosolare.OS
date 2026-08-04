'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { appSettings, users } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import type { ActionResult } from './opportunities'

function errori(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) out[issue.path.join('.') || '_'] ??= issue.message
  return out
}

const RUOLI = ['amministratore', 'contabilita', 'commerciale', 'cantiere'] as const

const nuovoUtenteSchema = z.object({
  email: z.email('Indirizzo email non valido'),
  name: z.string().trim().max(120).optional(),
  role: z.enum(RUOLI),
  canViewCosts: z.boolean().default(false),
  isFieldOnly: z.boolean().default(false),
})

/**
 * Crea un utente abilitato all'accesso.
 *
 * Non esiste password: la persona entra con il proprio account Google del
 * dominio aziendale. Questa riga e' cio' che glielo consente — senza, il login
 * viene rifiutato (nessuna auto-registrazione, D-003a).
 */
export async function createUser(
  input: z.input<typeof nuovoUtenteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const utente = await guard('create', 'user')

  const parsed = nuovoUtenteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const email = dati.email.trim().toLowerCase()
  const esistente = await getDb().query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  })
  if (esistente) {
    return { ok: false, errors: { email: 'Esiste gia un utente con questa email.' } }
  }

  const [creato] = await getDb()
    .insert(users)
    .values({
      email,
      name: dati.name ?? null,
      role: dati.role,
      // is_field_only ha senso solo sul ruolo cantiere: altrove sarebbe una
      // restrizione senza significato che confonde chi legge la scheda utente.
      canViewCosts: dati.canViewCosts,
      isFieldOnly: dati.role === 'cantiere' ? dati.isFieldOnly : false,
      createdBy: utente.id,
      updatedBy: utente.id,
    })
    .returning({ id: users.id })

  if (!creato) return { ok: false, errors: { _: 'Creazione non riuscita.' } }

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'user',
    entityId: creato.id,
  })

  revalidatePath('/amministrazione/utenti')
  return { ok: true, data: creato }
}

const aggiornaUtenteSchema = z.object({
  userId: z.uuid(),
  role: z.enum(RUOLI),
  canViewCosts: z.boolean().default(false),
  isFieldOnly: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export async function updateUser(
  input: z.input<typeof aggiornaUtenteSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'user')

  const parsed = aggiornaUtenteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()
  const precedente = await db.query.users.findFirst({ where: eq(users.id, dati.userId) })
  if (!precedente) return { ok: false, errors: { _: 'Utente non trovato.' } }

  // Nessuno puo' togliersi da solo i permessi di amministratore o disattivarsi:
  // e' il modo piu' comune di restare chiusi fuori dal proprio sistema.
  if (dati.userId === utente.id) {
    if (dati.role !== 'amministratore') {
      return { ok: false, errors: { role: 'Non puoi cambiare il tuo stesso ruolo.' } }
    }
    if (!dati.isActive) {
      return { ok: false, errors: { isActive: 'Non puoi disattivare te stesso.' } }
    }
  }

  const modifiche = {
    role: dati.role,
    canViewCosts: dati.canViewCosts,
    isFieldOnly: dati.role === 'cantiere' ? dati.isFieldOnly : false,
    isActive: dati.isActive,
  }

  await db
    .update(users)
    .set({ ...modifiche, updatedAt: new Date(), updatedBy: utente.id })
    .where(eq(users.id, dati.userId))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'user',
    entityId: dati.userId,
    before: {
      role: precedente.role,
      canViewCosts: precedente.canViewCosts,
      isFieldOnly: precedente.isFieldOnly,
      isActive: precedente.isActive,
    },
    after: modifiche,
  })

  revalidatePath('/amministrazione/utenti')
  return { ok: true, data: undefined }
}

const configurazioneSchema = z.object({
  key: z.string().trim().min(1),
  /** JSON grezzo: la forma del valore cambia per chiave. */
  value: z.string().trim().min(1, 'Indicare un valore'),
})

export async function updateSetting(
  input: z.input<typeof configurazioneSchema>,
): Promise<ActionResult> {
  const utente = await guard('update', 'settings')

  const parsed = configurazioneSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }

  let valore: unknown
  try {
    valore = JSON.parse(parsed.data.value)
  } catch {
    return {
      ok: false,
      errors: {
        value: 'Valore non valido. Usare JSON: un numero (5), una stringa ("testo") o un oggetto.',
      },
    }
  }

  const db = getDb()
  const precedente = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, parsed.data.key),
  })
  if (!precedente) return { ok: false, errors: { _: 'Configurazione non trovata.' } }

  await db
    .update(appSettings)
    .set({ value: valore, updatedAt: new Date(), updatedBy: utente.id })
    .where(eq(appSettings.key, parsed.data.key))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'app_setting',
    entityId: parsed.data.key,
    before: { value: precedente.value },
    after: { value: valore },
  })

  revalidatePath('/amministrazione/configurazioni')
  return { ok: true, data: undefined }
}
