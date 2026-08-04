import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { getDb } from '@/db'
import { users } from '@/db/schema'
import { recordAccessDenied } from '@/lib/audit'
import {
  AuthorizationError,
  authorize,
  type Action,
  type PolicySubject,
  type Resource,
} from './policy'

export interface CurrentUser extends PolicySubject {
  readonly id: string
  readonly email: string
  readonly name: string | null
}

/**
 * L'utente corrente, riletto dal database.
 *
 * La sessione contiene gia' ruolo e capacita', ma non sono la fonte di verita':
 * se un amministratore revoca una capacita' mentre l'utente e' collegato, la
 * sessione resterebbe indietro. Il costo e' una query per richiesta; il beneficio
 * e' che una revoca ha effetto immediato.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null

  const utente = await getDb().query.users.findFirst({
    where: eq(users.id, id),
    columns: {
      id: true,
      email: true,
      name: true,
      role: true,
      canViewCosts: true,
      isFieldOnly: true,
      isActive: true,
    },
  })

  if (!utente || !utente.isActive) return null

  return utente
}

/** Come `getCurrentUser`, ma solleva invece di restituire null. */
export async function requireUser(): Promise<CurrentUser> {
  const utente = await getCurrentUser()
  if (!utente) throw new AuthorizationError('read', 'contact')
  return utente
}

/**
 * Da chiamare all'inizio di ogni endpoint e server action, prima di toccare i dati.
 *
 * Restituisce l'utente cosi' che il chiamante non debba rileggerlo, e registra
 * il diniego quando l'autorizzazione fallisce.
 */
export async function guard(
  action: Action,
  resource: Resource,
  context?: { ipAddress?: string; userAgent?: string },
): Promise<CurrentUser> {
  const utente = await getCurrentUser()

  if (!utente) {
    await recordAccessDenied({
      userId: undefined,
      userLabel: undefined,
      action,
      resource,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    })
    throw new AuthorizationError(action, resource)
  }

  try {
    authorize(utente, action, resource)
  } catch (error) {
    await recordAccessDenied({
      userId: utente.id,
      userLabel: utente.email,
      action,
      resource,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    })
    throw error
  }

  return utente
}
