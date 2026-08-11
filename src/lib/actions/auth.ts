'use server'

import { and, eq, isNull, lt, or } from 'drizzle-orm'
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
import { decifra } from '@/lib/auth/cifratura'
import { consumaCodiceRecupero } from '@/lib/auth/mfa'
import { bloccoFinoA, minutiResidui } from '@/lib/auth/tentativi'
import { normalizzaCodiceRecupero, verificaCodiceTotp } from '@/lib/auth/totp'
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
  /** Codice a sei cifre o codice di recupero, al secondo passaggio. */
  codice: z.string().trim().optional(),
})

const CODICE_ERRATO = 'Codice non valido. Controlla l’app e riprova.'

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
 * Accesso con email e password.
 *
 * Non restituisce mai un esito positivo tramite `redirect` interno: la pagina
 * chiamante decide dove mandare la persona, perché la destinazione dipende dal
 * fatto che debba o no cambiare la password.
 */
export async function accedi(
  input: z.input<typeof accessoSchema>,
): Promise<
  ActionResult<{
    /** Vero quando password e email sono giuste ma manca il secondo fattore. */
    richiedeCodice?: boolean
    deveCambiarePassword: boolean
    destinazione: string
  }>
> {
  const parsed = accessoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: { _: CREDENZIALI_ERRATE } }
  const { email, password, codice } = parsed.data

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
      totpSecretEnc: true,
      totpEnabledAt: true,
      totpLastStep: true,
      totpRecoveryHashes: true,
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

  /*
   * Password giusta. Se la verifica in due passaggi è attiva, la sessione NON
   * viene ancora aperta: si chiede il codice e si rifà tutto da capo con
   * password e codice insieme. Costa una seconda verifica della password, e in
   * cambio non esiste in nessun momento uno stato «mezzo autenticato» da
   * proteggere — che è la parte in cui questi flussi sbagliano di solito.
   */
  if (utente.totpEnabledAt && utente.totpSecretEnc) {
    if (!codice) {
      return { ok: true, data: { richiedeCodice: true, deveCambiarePassword: false, destinazione: '' } }
    }

    const esito = await verificaSecondoFattore(utente, codice)

    if (!esito.valido) {
      // Un codice sbagliato conta come tentativo fallito: senza, il secondo
      // fattore sarebbe attaccabile all'infinito conoscendo la password.
      const tentativi = utente.failedLoginAttempts + 1
      await db
        .update(users)
        .set({ failedLoginAttempts: tentativi, lockedUntil: bloccoFinoA(tentativi, adesso) })
        .where(eq(users.id, utente.id))
      await registraTentativo(utente.id, utente.email, 'codice_errato')
      return { ok: false, errors: { codice: CODICE_ERRATO } }
    }

    // Passo TOTP: update condizionale contro due login paralleli con lo stesso
    // codice (stesso passo temporale). Solo il primo avanzamento vince.
    const passo = esito.aggiornamento.totpLastStep
    if (typeof passo === 'number') {
      const aggiornati = await db
        .update(users)
        .set(esito.aggiornamento)
        .where(
          and(
            eq(users.id, utente.id),
            or(isNull(users.totpLastStep), lt(users.totpLastStep, passo)),
          ),
        )
        .returning({ id: users.id })
      if (aggiornati.length === 0) {
        await registraTentativo(utente.id, utente.email, 'codice_gia_usato')
        return { ok: false, errors: { codice: CODICE_ERRATO } }
      }
    } else {
      await db.update(users).set(esito.aggiornamento).where(eq(users.id, utente.id))
    }
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
      destinazione: homeDopoAccesso({
        role: utente.role,
        canViewCosts: utente.canViewCosts,
        isFieldOnly: utente.isFieldOnly,
        isActive: utente.isActive,
      }),
    },
  }
}

/**
 * Il secondo fattore: prima il codice dell'app, poi i codici di recupero.
 *
 * Restituisce anche cosa scrivere sull'utente, perché entrambe le strade
 * consumano qualcosa — il passo temporale nel primo caso, il codice di
 * recupero nel secondo — e dimenticarsene renderebbe il fattore riutilizzabile.
 */
async function verificaSecondoFattore(
  utente: {
    totpSecretEnc: string | null
    totpLastStep: number | null
    totpRecoveryHashes: string[] | null
  },
  codice: string,
): Promise<{ valido: boolean; aggiornamento: Record<string, unknown> }> {
  let segreto: string
  try {
    segreto = decifra(utente.totpSecretEnc!)
  } catch {
    // Chiave mancante o cambiata: il segreto non è più leggibile. Restano i
    // codici di recupero, che non dipendono da MFA_SECRET_KEY apposta.
    console.error('[mfa] segreto non decifrabile: serve MFA_SECRET_KEY corretta')
    return verificaRecupero(utente, codice)
  }

  const esito = verificaCodiceTotp({
    segretoBase32: segreto,
    codice,
    adesso: new Date(),
    ultimoPassoUsato: utente.totpLastStep,
  })

  if (esito.valido) {
    return { valido: true, aggiornamento: { totpLastStep: esito.passo } }
  }

  return verificaRecupero(utente, codice)
}

function verificaRecupero(
  utente: { totpRecoveryHashes: string[] | null },
  codice: string,
): { valido: boolean; aggiornamento: Record<string, unknown> } {
  const rimasti = consumaCodiceRecupero(
    utente.totpRecoveryHashes ?? [],
    normalizzaCodiceRecupero(codice),
  )
  if (rimasti === null) return { valido: false, aggiornamento: {} }
  return { valido: true, aggiornamento: { totpRecoveryHashes: rimasti } }
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
 * `consentitoSenzaMfa` perché il cambio password iniziale precede l’enrollment.
 */
export async function cambiaPassword(
  input: z.input<typeof cambioSchema>,
): Promise<ActionResult> {
  const utente = await requireUser({ consentitoSenzaMfa: true })

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
