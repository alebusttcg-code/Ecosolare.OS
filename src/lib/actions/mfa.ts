'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { chiudiSessioniDi } from '@/auth'
import { getDb } from '@/db'
import { users } from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { chiaveCifraturaConfigurata, cifra, decifra } from '@/lib/auth/cifratura'
import { improntaCodiceRecupero, mfaObbligatoria } from '@/lib/auth/mfa'
import { verificaPassword } from '@/lib/auth/password'
import { guard, requireUser } from '@/lib/auth/session'
import {
  generaCodiciRecupero,
  generaSegretoTotp,
  normalizzaCodiceRecupero,
  segretoLeggibile,
  uriOtpauth,
  verificaCodiceTotp,
} from '@/lib/auth/totp'
import type { ActionResult } from './opportunities'

/**
 * Attivazione e disattivazione della verifica in due passaggi.
 *
 * Enrollment (`prepara`/`attiva`) usa `requireUser({ consentitoSenzaMfa })`:
 * `guard` e il `requireUser` normale bloccano admin/contabilità senza TOTP
 * (D-018), ma senza questa eccezione non si potrebbe mai attivarlo.
 */

/**
 * Prepara un segreto e lo conserva come «in attesa».
 *
 * Segreto scritto subito nel database e non tenuto nella pagina: fra il momento
 * in cui si mostra il codice da inquadrare e quello in cui si conferma passano
 * minuti, e la pagina può essere ricaricata. Con il segreto in memoria del
 * browser, una ricarica costringerebbe a ricominciare dopo aver già
 * configurato l'app — che è il modo più veloce per far rinunciare qualcuno.
 *
 * `totp_enabled_at` nullo distingue «preparato» da «attivo»: finché è nullo,
 * l'accesso non chiede il codice.
 */
export async function preparaMfa(): Promise<
  ActionResult<{ segreto: string; segretoLeggibile: string; uri: string }>
> {
  const utente = await requireUser({ consentitoSenzaMfa: true })

  if (!chiaveCifraturaConfigurata()) {
    return {
      ok: false,
      errors: {
        _: 'Manca MFA_SECRET_KEY nella configurazione: senza, il segreto non può essere protetto. Genera la chiave con «openssl rand -hex 32» e aggiungila a .env.local.',
      },
    }
  }

  const db = getDb()
  const riga = await db.query.users.findFirst({
    where: eq(users.id, utente.id),
    columns: { totpSecretEnc: true, totpEnabledAt: true },
  })

  if (riga?.totpEnabledAt) {
    return { ok: false, errors: { _: 'La verifica in due passaggi è già attiva.' } }
  }

  // Se ce n'è già uno in attesa si riusa: rigenerarlo a ogni visita della
  // pagina invaliderebbe l'app appena configurata da chi ha ricaricato.
  let segreto: string
  if (riga?.totpSecretEnc) {
    try {
      segreto = decifra(riga.totpSecretEnc)
    } catch {
      segreto = generaSegretoTotp()
    }
  } else {
    segreto = generaSegretoTotp()
  }

  await db
    .update(users)
    .set({ totpSecretEnc: cifra(segreto), totpEnabledAt: null, totpLastStep: null })
    .where(eq(users.id, utente.id))

  return {
    ok: true,
    data: {
      segreto,
      segretoLeggibile: segretoLeggibile(segreto),
      uri: uriOtpauth({ segretoBase32: segreto, email: utente.email }),
    },
  }
}

const confermaSchema = z.object({ codice: z.string().trim() })

/**
 * Attiva davvero, dopo aver verificato un codice prodotto dall'app.
 *
 * Il codice serve a dimostrare che l'app è configurata *prima* di rendere
 * obbligatorio il secondo fattore: attivare sulla fiducia significa chiudere
 * fuori chi ha sbagliato a trascrivere il segreto.
 */
export async function attivaMfa(
  input: z.input<typeof confermaSchema>,
): Promise<ActionResult<{ codiciRecupero: string[] }>> {
  const utente = await requireUser({ consentitoSenzaMfa: true })

  const parsed = confermaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: { codice: 'Codice non valido.' } }

  const db = getDb()
  const riga = await db.query.users.findFirst({
    where: eq(users.id, utente.id),
    columns: { totpSecretEnc: true, totpEnabledAt: true },
  })

  if (!riga?.totpSecretEnc) {
    return { ok: false, errors: { _: 'Nessuna configurazione in corso. Ricarica la pagina.' } }
  }
  if (riga.totpEnabledAt) {
    return { ok: false, errors: { _: 'La verifica in due passaggi è già attiva.' } }
  }

  let segreto: string
  try {
    segreto = decifra(riga.totpSecretEnc)
  } catch {
    return { ok: false, errors: { _: 'Configurazione non leggibile. Ricarica la pagina.' } }
  }

  const esito = verificaCodiceTotp({
    segretoBase32: segreto,
    codice: parsed.data.codice,
    adesso: new Date(),
  })
  if (!esito.valido) {
    return {
      ok: false,
      errors: { codice: 'Codice non valido. Controlla che l’orario del telefono sia giusto.' },
    }
  }

  const codiciRecupero = generaCodiciRecupero()

  await db
    .update(users)
    .set({
      totpEnabledAt: new Date(),
      totpLastStep: esito.passo,
      totpRecoveryHashes: codiciRecupero.map((c) =>
        improntaCodiceRecupero(normalizzaCodiceRecupero(c)),
      ),
      updatedAt: new Date(),
    })
    .where(eq(users.id, utente.id))

  await recordAudit({
    actorType: 'user',
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'user',
    entityId: utente.id,
    field: 'totp',
    newValue: '(attivata)',
  })

  return { ok: true, data: { codiciRecupero } }
}

const disattivaSchema = z.object({ password: z.string().min(1, 'Inserire la password.') })

/**
 * Disattiva, chiedendo la password.
 *
 * La password serve perché disattivare il secondo fattore è esattamente ciò
 * che tenterebbe chi si è impossessato di una sessione aperta: senza, basterebbe
 * un computer lasciato sbloccato per togliere la protezione a un amministratore.
 */
export async function disattivaMfa(
  input: z.input<typeof disattivaSchema>,
): Promise<ActionResult> {
  const utente = await requireUser()

  if (mfaObbligatoria(utente.role)) {
    return {
      ok: false,
      errors: {
        _: 'Per il tuo ruolo la verifica in due passaggi è obbligatoria e non può essere disattivata.',
      },
    }
  }

  const parsed = disattivaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: { password: 'Inserire la password.' } }

  const db = getDb()
  const riga = await db.query.users.findFirst({
    where: eq(users.id, utente.id),
    columns: { passwordHash: true },
  })
  if (!riga?.passwordHash) return { ok: false, errors: { _: 'Nessuna password impostata.' } }
  if (!(await verificaPassword(parsed.data.password, riga.passwordHash))) {
    return { ok: false, errors: { password: 'Password non corretta.' } }
  }

  await db
    .update(users)
    .set({
      totpSecretEnc: null,
      totpEnabledAt: null,
      totpLastStep: null,
      totpRecoveryHashes: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, utente.id))

  await recordAudit({
    actorType: 'user',
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'user',
    entityId: utente.id,
    field: 'totp',
    newValue: '(disattivata)',
  })

  return { ok: true, data: undefined }
}

/**
 * Rigenera i codici di recupero, invalidando i precedenti.
 *
 * Chiede la password come la disattivazione: senza, una sessione rubata
 * basterebbe a invalidare i foglietti di recupero e a sostituirli con altri
 * noti solo a chi ha il computer aperto.
 */
export async function rigeneraCodiciRecupero(
  input: z.input<typeof disattivaSchema>,
): Promise<ActionResult<{ codiciRecupero: string[] }>> {
  const utente = await requireUser()

  const parsed = disattivaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: { password: 'Inserire la password.' } }

  const db = getDb()
  const riga = await db.query.users.findFirst({
    where: eq(users.id, utente.id),
    columns: { totpEnabledAt: true, passwordHash: true },
  })
  if (!riga?.totpEnabledAt) {
    return { ok: false, errors: { _: 'La verifica in due passaggi non è attiva.' } }
  }
  if (!riga.passwordHash) return { ok: false, errors: { _: 'Nessuna password impostata.' } }
  if (!(await verificaPassword(parsed.data.password, riga.passwordHash))) {
    return { ok: false, errors: { password: 'Password non corretta.' } }
  }

  const codiciRecupero = generaCodiciRecupero()
  await db
    .update(users)
    .set({
      totpRecoveryHashes: codiciRecupero.map((c) =>
        improntaCodiceRecupero(normalizzaCodiceRecupero(c)),
      ),
    })
    .where(eq(users.id, utente.id))

  await recordAudit({
    actorType: 'user',
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'user',
    entityId: utente.id,
    field: 'totp_recovery',
    newValue: '(rigenerati)',
  })

  return { ok: true, data: { codiciRecupero } }
}

/**
 * Azzera la verifica in due passaggi di un altro utente.
 *
 * È la via d'uscita quando qualcuno perde telefono e codici insieme. Sta qui e
 * non fra le azioni di amministrazione perché chiude anche tutte le sessioni
 * della persona: dopo un azzeramento non si resta collegati da nessuna parte.
 */
export async function azzeraMfaUtente(input: { userId: string }): Promise<ActionResult> {
  const amministratore = await guard('update', 'user')

  const parsed = z.object({ userId: z.uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, errors: { _: 'Richiesta non valida.' } }

  const db = getDb()
  const bersaglio = await db.query.users.findFirst({
    where: eq(users.id, parsed.data.userId),
    columns: { id: true, email: true, totpEnabledAt: true },
  })
  if (!bersaglio) return { ok: false, errors: { _: 'Utente non trovato.' } }
  if (bersaglio.id === amministratore.id) {
    return {
      ok: false,
      errors: {
        _: 'Non puoi azzerare la tua verifica in due passaggi: chiedi a un altro amministratore.',
      },
    }
  }

  await db
    .update(users)
    .set({
      totpSecretEnc: null,
      totpEnabledAt: null,
      totpLastStep: null,
      totpRecoveryHashes: null,
      updatedAt: new Date(),
      updatedBy: amministratore.id,
    })
    .where(eq(users.id, bersaglio.id))

  await chiudiSessioniDi(bersaglio.id)

  await recordAudit({
    actorType: 'user',
    actorId: amministratore.id,
    actorLabel: amministratore.email,
    action: 'update',
    entityType: 'user',
    entityId: bersaglio.id,
    field: 'totp',
    newValue: '(azzerata dall’amministratore)',
  })

  revalidatePath('/amministrazione/utenti')
  return { ok: true, data: undefined }
}
