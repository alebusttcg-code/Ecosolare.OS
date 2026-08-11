'use server'

import { randomBytes } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { clientLinks, projects } from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { assertCommessaInScope } from '@/lib/auth/scope-query'
import { guard } from '@/lib/auth/session'
import { env } from '@/env'
import { improntaToken } from '@/lib/queries/stato-pubblico'
import type { ActionResult } from './opportunities'

/**
 * Collegamento pubblico per il cliente (D-019).
 *
 * Il token si vede una volta sola, come la password iniziale: nel database ne
 * resta l'impronta. Se qualcuno perde il collegamento se ne genera un altro —
 * costa nulla — e si revoca il precedente.
 */

const schema = z.object({ projectId: z.uuid() })

function indirizzoBase(): string {
  const configurato = env().APP_BASE_URL
  if (configurato && configurato.length > 0) return configurato.replace(/\/$/, '')
  return 'https://app.ecosolare.it'
}

export async function creaLinkCliente(
  input: z.input<typeof schema>,
): Promise<ActionResult<{ url: string }>> {
  const utente = await guard('update', 'project')

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: { _: 'Richiesta non valida.' } }
  await assertCommessaInScope(utente, parsed.data.projectId)

  const db = getDb()
  const commessa = await db.query.projects.findFirst({
    where: and(eq(projects.id, parsed.data.projectId), isNull(projects.deletedAt)),
    columns: { id: true, code: true },
  })
  if (!commessa) return { ok: false, errors: { _: 'Commessa non trovata.' } }

  // 32 byte: lo stesso ordine di grandezza di una sessione, perché svolge la
  // stessa funzione — è l'unica cosa che separa questa pagina da chiunque.
  const token = randomBytes(32).toString('base64url')
  const adesso = new Date()

  await db.transaction(async (tx) => {
    // Un solo collegamento attivo per commessa: i precedenti smettono di
    // aprire la pagina (D-019). Generarne uno nuovo è anche il modo di
    // «ruotare» un link perso o inoltrato per sbaglio.
    await tx
      .update(clientLinks)
      .set({ revokedAt: adesso })
      .where(
        and(eq(clientLinks.projectId, commessa.id), isNull(clientLinks.revokedAt)),
      )

    await tx.insert(clientLinks).values({
      projectId: commessa.id,
      tokenHash: improntaToken(token),
      createdBy: utente.id,
    })
  })

  await recordAudit({
    actorType: 'user',
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'client_link',
    entityId: commessa.id,
    // Mai il token nell'audit: il registro è consultabile, e chi lo legge
    // potrebbe aprire la pagina del cliente.
    newValue: '(collegamento generato; precedenti revocati)',
  })

  revalidatePath(`/cantieri/${commessa.id}`)
  return { ok: true, data: { url: `${indirizzoBase()}/stato/${token}` } }
}

export async function revocaLinkCliente(
  input: { linkId: string },
): Promise<ActionResult> {
  const utente = await guard('update', 'project')

  const parsed = z.object({ linkId: z.uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, errors: { _: 'Richiesta non valida.' } }

  const db = getDb()
  const link = await db.query.clientLinks.findFirst({
    where: eq(clientLinks.id, parsed.data.linkId),
    columns: { id: true, projectId: true },
  })
  if (!link) return { ok: false, errors: { _: 'Collegamento non trovato.' } }
  await assertCommessaInScope(utente, link.projectId)

  await db
    .update(clientLinks)
    .set({ revokedAt: new Date() })
    .where(eq(clientLinks.id, link.id))

  await recordAudit({
    actorType: 'user',
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'delete',
    entityType: 'client_link',
    entityId: link.projectId,
    newValue: '(collegamento revocato)',
  })

  revalidatePath(`/cantieri/${link.projectId}`)
  return { ok: true, data: undefined }
}
