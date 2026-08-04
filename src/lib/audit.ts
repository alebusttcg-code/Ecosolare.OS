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

function rappresenta(valore: unknown): string | null {
  if (valore === null || valore === undefined) return null
  if (valore instanceof Date) return valore.toISOString()
  if (typeof valore === 'object') return JSON.stringify(valore)
  return String(valore)
}

/**
 * Registra la modifica di un'entita', una riga per campo cambiato.
 *
 * Una riga per campo e non una per operazione perche' la domanda che si pone
 * mesi dopo e' sempre "chi ha cambiato QUESTO valore, e da cosa a cosa".
 * Un blob JSON con l'intero oggetto prima e dopo non risponde a quella domanda
 * senza lavoro manuale.
 */
export async function recordEntityChange(params: {
  actorId: string
  actorLabel?: string | undefined
  action: 'create' | 'update' | 'delete' | 'approve'
  entityType: string
  entityId: string
  before?: Record<string, unknown> | undefined
  after?: Record<string, unknown> | undefined
  correlationId?: string | undefined
}): Promise<void> {
  const { before, after } = params

  // Creazione e cancellazione non hanno un diff significativo: una riga sola.
  if (params.action !== 'update' || !before || !after) {
    await recordAudit({
      actorType: 'user',
      actorId: params.actorId,
      actorLabel: params.actorLabel ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      correlationId: params.correlationId ?? null,
    })
    return
  }

  const righe: NewAuditLog[] = []
  for (const campo of Object.keys(after)) {
    const precedente = rappresenta(before[campo])
    const nuovo = rappresenta(after[campo])
    if (precedente === nuovo) continue

    righe.push({
      actorType: 'user',
      actorId: params.actorId,
      actorLabel: params.actorLabel ?? null,
      action: 'update',
      entityType: params.entityType,
      entityId: params.entityId,
      field: campo,
      oldValue: precedente,
      newValue: nuovo,
      correlationId: params.correlationId ?? null,
    })
  }

  if (righe.length === 0) return

  try {
    await getDb().insert(auditLogs).values(righe)
  } catch (error) {
    console.error('[audit] scrittura del diff fallita', { entity: params.entityType, error })
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
