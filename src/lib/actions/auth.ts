'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { chiudiSessione, chiudiSessioniDi, creaSessione } from '@/auth'
import { getDb } from '@/db'
import { users } from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { homeDopoAccesso } from '@/lib/auth/home'
import { getCurrentUser, requireUser } from '@/lib/auth/session'
import {
  calcolaImpronta,
  validaPassword,
  verificaPassword,
} from '@/lib/auth/password'
import { bloccoFinoA, minutiResidui } from '@/lib/auth/tentativi'
import type { ActionResult } from './opportunities'

/**
 * Impronta di scarto, usata quando l'email non esiste o l'utente non ha ancora
 * una password. Serve a far durare il tentativo fallito quanto uno riuscito:
 * senza, il tempo di risposta direbbe a chiunque quali indirizzi sono
 * registrati nel sistema.
 */
const IMPRONTA_FITTIZIA =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' +
  'ZG8gbm90IG1hdGNoIGFueXRoaW5nLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0='

/**
 * Messaggio unico per ogni fallimento che non sia un blocco.
 *
 * «Utente inesistente» e «password errata» sono due informazioni diverse per
 * chi ha dimenticato la password, e la stessa identica informazione utile per
 * chi sta compilando un elenco di indirizzi validi.
 */
const CREDENZIALI_ERRATE = 'Email o password non corretti.'

const accessoSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email(CREDENZIALI_ERRATE)),
  password: z.string().min(1, 'Inserire la password.'),
})

async function contesto(): Promise<{ ipAddress?: string; userAgent?: string }> {
  const h = await headers()
  // Su Vercel l'indirizzo reale è il primo della catena: gli altri sono proxy.
  const inoltrato = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  return {
    ...(inoltrato ? { ipAddress: inoltrato } : {}),
    ...(h.get('user-agent') ? { userAgent: h.get('user-agent')! } : {}),
  }
}

/**
 * Accesso con email e password (senza secondo fattore).
 *
 * Non restituisce mai un esito positivo tramite `redirect` interno: la pagina
 * chiamante decide dove mandare la persona, perché la destinazione dipende dal
 * fatto che debba o no cambiare la password.
 */
export async function accedi(
  input: z.input<typeof accessoSchema>,
): Promise<
  ActionResult<{
    deveCambiarePassword: boolean
    destinazione: string
  }>
> {
  const parsed = accessoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: { _: CREDENZIALI_ERRATE } }
  const { email, password } = parsed.data

  const db = getDb()
  const utente = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: {
      id: true,
      email: true,
      passwordHash: true,
      isActive: true,
      mustChangePassword: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      role: true,
      canViewCosts: true,
      isFieldOnly: true,
    },
  })

  const adesso = new Date()

  // Il blocco si verifica prima di tutto il resto: è l'unico controllo che deve
  // valere anche quando la password fornita è quella giusta.
  if (utente?.lockedUntil && utente.lockedUntil > adesso) {
    await registraTentativo(utente.id, utente.email, 'bloccato')
    const minuti = minutiResidui(utente.lockedUntil, adesso)
    return {
      ok: false,
      errors: {
        _: `Troppi tentativi falliti. Riprovare fra ${minuti} minut${minuti === 1 ? 'o' : 'i'}.`,
      },
    }
  }

  // Un utente inesistente, disattivato o senza password consuma comunque il
  // tempo di una verifica: da fuori i quattro casi sono indistinguibili.
  const impronta =
    utente && utente.isActive && utente.passwordHash
      ? utente.passwordHash
      : IMPRONTA_FITTIZIA
  const corretta = await verificaPassword(password, impronta)

  if (!utente || !utente.isActive || !utente.passwordHash || !corretta) {
    if (utente) {
      const tentativi = utente.failedLoginAttempts + 1
      await db
        .update(users)
        .set({ failedLoginAttempts: tentativi, lockedUntil: bloccoFinoA(tentativi, adesso) })
        .where(eq(users.id, utente.id))
      await registraTentativo(utente.id, utente.email, 'password_errata')
    } else {
      await registraTentativo(null, email, 'utente_inesistente')
    }
    return { ok: false, errors: { _: CREDENZIALI_ERRATE } }
  }

  await db
    .update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: adesso })
    .where(eq(users.id, utente.id))

  const dettagli = await contesto()
  await creaSessione({ userId: utente.id, ...dettagli })

  await recordAudit({
    actorType: 'user',
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'login',
    entityType: 'user',
    entityId: utente.id,
    ipAddress: dettagli.ipAddress ?? null,
    userAgent: dettagli.userAgent ?? null,
  })

  return {
    ok: true,
    data: {
      deveCambiarePassword: utente.mustChangePassword,
      destinazione: homeDopoAccesso(),
    },
  }
}

async function registraTentativo(
  userId: string | null,
  etichetta: string,
  motivo: string,
): Promise<void> {
  const dettagli = await contesto()
  await recordAudit({
    actorType: userId ? 'user' : 'system',
    actorId: userId,
    // L'etichetta contiene l'email tentata anche quando non esiste un utente:
    // è ciò che permette di riconoscere un attacco mirato a un indirizzo.
    actorLabel: etichetta,
    action: 'access_denied',
    entityType: 'user',
    entityId: userId,
    context: { attemptedAction: 'login', motivo },
    ipAddress: dettagli.ipAddress ?? null,
    userAgent: dettagli.userAgent ?? null,
  })
}

export async function esci(): Promise<never> {
  const utente = await getCurrentUser()
  await chiudiSessione()

  if (utente) {
    await recordAudit({
      actorType: 'user',
      actorId: utente.id,
      actorLabel: utente.email,
      action: 'logout',
      entityType: 'user',
      entityId: utente.id,
    })
  }

  redirect('/accedi')
}

const cambioSchema = z
  .object({
    corrente: z.string().min(1, 'Inserire la password attuale.'),
    nuova: z.string(),
    conferma: z.string(),
  })
  .refine((d) => d.nuova === d.conferma, {
    message: 'Le due password non coincidono.',
    path: ['conferma'],
  })

/**
 * Cambio password da parte della persona stessa.
 *
 * Non passa da `guard`: cambiare la propria password è possibile per chiunque
 * sia collegato, indipendentemente dal ruolo — ed è obbligatorio al primo
 * accesso, quando la persona non ha ancora potuto fare nient'altro.
 */
export async function cambiaPassword(
  input: z.input<typeof cambioSchema>,
): Promise<ActionResult> {
  const utente = await requireUser()

  const parsed = cambioSchema.safeParse(input)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      errors[issue.path.join('.') || '_'] ??= issue.message
    }
    return { ok: false, errors }
  }
  const dati = parsed.data

  const problema = validaPassword(dati.nuova)
  if (problema) return { ok: false, errors: { nuova: problema } }
  if (dati.nuova === dati.corrente) {
    return { ok: false, errors: { nuova: 'La nuova password deve essere diversa.' } }
  }

  const db = getDb()
  const riga = await db.query.users.findFirst({
    where: eq(users.id, utente.id),
    columns: { passwordHash: true },
  })
  if (!riga?.passwordHash) {
    return { ok: false, errors: { _: 'Nessuna password impostata. Contattare un amministratore.' } }
  }
  if (!(await verificaPassword(dati.corrente, riga.passwordHash))) {
    return { ok: false, errors: { corrente: 'Password attuale non corretta.' } }
  }

  await db
    .update(users)
    .set({
      passwordHash: await calcolaImpronta(dati.nuova),
      passwordUpdatedAt: new Date(),
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, utente.id))

  // Tutte le sessioni cadono, compresa quella corrente: se la password è stata
  // cambiata perché qualcuno la conosceva, lasciarlo collegato vanificherebbe
  // il cambio. La persona rientra subito con la nuova.
  await chiudiSessioniDi(utente.id)

  await recordAudit({
    actorType: 'user',
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'user',
    entityId: utente.id,
    field: 'password',
    // Mai il valore, nemmeno l'impronta: l'audit è consultabile.
    newValue: '(modificata)',
  })

  return { ok: true, data: undefined }
}
