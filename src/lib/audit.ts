import { getDb } from '@/db'
import { auditLogs, type NewAuditLog } from '@/db/schema'

/**
 * Scrittura dell'audit log (§3.3 e §14 del blueprint).
 *
 * Non solleva mai: un errore nel registro non deve far fallire l'operazione
 * dell'utente. Fallisce rumorosamente sui log applicativi, silenziosamente
 * verso l'interfaccia.
 */
export async function recordAudit(entry: NewAuditLog): Promise<void> {
  try {
    await getDb().insert(auditLogs).values(entry)
  } catch (error) {
    console.error('[audit] scrittura fallita', { entry, error })
  }
}

/**
 * Registra un tentativo di accesso negato (§11.4 regola 6).
 *
 * Un singolo diniego e' rumore: capita a chiunque sbagli link. Un pattern di
 * dinieghi ripetuti dallo stesso utente sulla stessa risorsa e' un segnale,
 * e senza questa riga non sarebbe osservabile.
 */
export async function recordAccessDenied(params: {
  userId: string | undefined
  userLabel: string | undefined
  action: string
  resource: string
  ipAddress?: string | undefined
  userAgent?: string | undefined
}): Promise<void> {
  await recordAudit({
    actorType: params.userId ? 'user' : 'system',
    actorId: params.userId ?? null,
    actorLabel: params.userLabel ?? null,
    action: 'access_denied',
    entityType: params.resource,
    context: { attemptedAction: params.action },
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  })
}
