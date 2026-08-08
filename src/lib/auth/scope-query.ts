import { and, eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  contacts,
  documentFiles,
  documentRequirements,
  projectTasks,
  projects,
} from '@/db/schema'
import { AuthorizationError, scopeFor, type PolicySubject } from './policy'

/** Utente con identificativo, necessario per filtri «assigned». */
export type UtenteConId = PolicySubject & { readonly id: string }

/**
 * Condizione SQL: la commessa ha almeno un task assegnato all'utente.
 * Contratto esplicito per Fase 4 (work order); oggi usa `project_tasks`.
 */
export function filtroCommessaAssegnata(utenteId: string) {
  return sql`exists (
    select 1 from ${projectTasks}
    where ${projectTasks.projectId} = ${projects.id}
      and ${projectTasks.assignedTo} = ${utenteId}
  )`
}

/** Contatto raggiungibile solo tramite commesse con task assegnati all'utente. */
export function filtroContattoAssegnato(utenteId: string) {
  return sql`exists (
    select 1 from ${projects}
    inner join ${projectTasks} on ${projectTasks.projectId} = ${projects.id}
    where ${projects.contactId} = ${contacts.id}
      and ${projects.deletedAt} is null
      and ${projectTasks.assignedTo} = ${utenteId}
  )`
}

/**
 * Verifica che l'utente possa accedere a una commessa specifica.
 * Solleva `AuthorizationError` — per le pagine usare `commessaVisibile`.
 */
export async function assertCommessaInScope(
  utente: UtenteConId,
  projectId: string,
): Promise<void> {
  const scope = scopeFor(utente, 'project')
  if (scope === 'none') throw new AuthorizationError('read', 'project')
  if (scope === 'all') return

  const assegnato = await getDb().query.projectTasks.findFirst({
    where: and(eq(projectTasks.projectId, projectId), eq(projectTasks.assignedTo, utente.id)),
    columns: { id: true },
  })
  if (!assegnato) throw new AuthorizationError('read', 'project')
}

/** Come `assertCommessaInScope`, ma restituisce un booleano (per query detail → notFound). */
export async function commessaVisibile(utente: UtenteConId, projectId: string): Promise<boolean> {
  try {
    await assertCommessaInScope(utente, projectId)
    return true
  } catch (errore) {
    if (errore instanceof AuthorizationError) return false
    throw errore
  }
}

/** Verifica scope su un file documentale (join requisito → commessa → task). */
export async function assertDocumentoInScope(
  utente: UtenteConId,
  fileId: string,
): Promise<void> {
  const scope = scopeFor(utente, 'document')
  if (scope === 'none') throw new AuthorizationError('read', 'document')
  if (scope === 'all') return

  const db = getDb()
  const file = await db.query.documentFiles.findFirst({
    where: eq(documentFiles.id, fileId),
    columns: { requirementId: true },
  })
  if (!file) throw new AuthorizationError('read', 'document')

  const requisito = await db.query.documentRequirements.findFirst({
    where: eq(documentRequirements.id, file.requirementId),
    columns: { projectId: true },
  })
  if (!requisito) throw new AuthorizationError('read', 'document')

  await assertCommessaInScope(utente, requisito.projectId)
}
