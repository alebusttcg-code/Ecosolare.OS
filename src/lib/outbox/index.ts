import { and, eq, inArray, lte, sql } from 'drizzle-orm'
import { getDb, type Database, type Esecutore } from '@/db'
import { outboxEvents } from '@/db/schema'
import { prossimoTentativo } from './ritentativi'

/**
 * Outbox transazionale (ADR-005).
 *
 * `accoda` va chiamata con l'esecutore della transazione in corso, non con
 * `getDb()`: è tutto il senso del meccanismo. Se l'evento non nasce nella
 * stessa transazione del fatto che lo giustifica, si torna al problema che
 * l'outbox esiste per risolvere.
 */

export interface EventoDaAccodare {
  readonly type: string
  readonly payload: Record<string, unknown>
  /**
   * Rende l'accodamento ripetibile senza duplicare l'effetto. Ometterla
   * significa dire «se questo codice viene eseguito due volte, voglio due
   * effetti»: raramente è ciò che si vuole.
   */
  readonly dedupKey?: string
}

export async function accoda(db: Esecutore, evento: EventoDaAccodare): Promise<void> {
  await db
    .insert(outboxEvents)
    .values({
      type: evento.type,
      payload: evento.payload,
      dedupKey: evento.dedupKey ?? null,
    })
    // Un evento già in coda per la stessa chiave è già la risposta giusta:
    // non va né duplicato né riportato indietro a «in attesa», perché
    // potrebbe essere in corso proprio adesso.
    .onConflictDoNothing({ target: outboxEvents.dedupKey })
}

/** Un gestore restituisce nulla se ha finito; solleva se va ritentato. */
export type Gestore = (payload: Record<string, unknown>) => Promise<void>

export interface EsitoElaborazione {
  readonly elaborati: number
  readonly completati: number
  readonly rimandati: number
  readonly falliti: number
}

/**
 * Elabora gli eventi pronti.
 *
 * `for update skip locked` è ciò che rende sicuro eseguirla da più istanze
 * contemporaneamente: due processi non prendono mai la stessa riga, e nessuno
 * dei due aspetta l'altro.
 */
export async function elaboraOutbox(
  gestori: Record<string, Gestore>,
  opzioni: { limite?: number; db?: Database } = {},
): Promise<EsitoElaborazione> {
  // `db` iniettabile solo per i test: in esercizio è sempre la connessione
  // dell'applicazione.
  const db = opzioni.db ?? getDb()
  const limite = opzioni.limite ?? 20
  const adesso = new Date()

  const tipiNoti = Object.keys(gestori)
  if (tipiNoti.length === 0) {
    return { elaborati: 0, completati: 0, rimandati: 0, falliti: 0 }
  }

  const presi = await db.transaction(async (tx) => {
    const righe = await tx
      .select({ id: outboxEvents.id })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.status, 'in_attesa'),
          lte(outboxEvents.availableAt, adesso),
          // Solo tipi per cui abbiamo un gestore: così Drive non configurato
          // non fa fallire eventi Telegram (e viceversa).
          inArray(outboxEvents.type, tipiNoti),
        ),
      )
      .orderBy(outboxEvents.availableAt)
      .limit(limite)
      .for('update', { skipLocked: true })

    if (righe.length === 0) return []

    const ids = righe.map((r) => r.id)
    return tx
      .update(outboxEvents)
      .set({ status: 'in_corso', attempts: sql`${outboxEvents.attempts} + 1` })
      .where(sql`${outboxEvents.id} in ${ids}`)
      .returning({
        id: outboxEvents.id,
        type: outboxEvents.type,
        payload: outboxEvents.payload,
        attempts: outboxEvents.attempts,
      })
  })

  let completati = 0
  let rimandati = 0
  let falliti = 0

  for (const evento of presi) {
    const gestore = gestori[evento.type]

    if (!gestore) {
      // Non dovrebbe accadere: abbiamo filtrato per tipi noti. Difesa in profondità.
      await segnaFallito(db, evento.id, `Nessun gestore per il tipo "${evento.type}".`)
      falliti += 1
      continue
    }

    try {
      await gestore((evento.payload ?? {}) as Record<string, unknown>)
      await db
        .update(outboxEvents)
        .set({ status: 'completato', processedAt: new Date(), lastError: null })
        .where(eq(outboxEvents.id, evento.id))
      completati += 1
    } catch (errore) {
      const messaggio = errore instanceof Error ? errore.message : String(errore)
      const riprovaIl = prossimoTentativo(evento.attempts, new Date())

      if (riprovaIl) {
        await db
          .update(outboxEvents)
          .set({ status: 'in_attesa', availableAt: riprovaIl, lastError: messaggio })
          .where(eq(outboxEvents.id, evento.id))
        rimandati += 1
      } else {
        await segnaFallito(db, evento.id, messaggio)
        falliti += 1
      }

      // Rumoroso nei log, silenzioso verso l'utente: l'operazione che ha
      // generato l'evento è già andata a buon fine tempo fa.
      console.error('[outbox] evento non riuscito', {
        id: evento.id,
        type: evento.type,
        tentativi: evento.attempts,
        errore: messaggio,
      })
    }
  }

  return { elaborati: presi.length, completati, rimandati, falliti }
}

async function segnaFallito(db: Database, id: string, errore: string): Promise<void> {
  await db
    .update(outboxEvents)
    .set({ status: 'fallito', processedAt: new Date(), lastError: errore })
    .where(eq(outboxEvents.id, id))
}

/**
 * Rimette in coda gli eventi falliti.
 *
 * Serve dopo aver sistemato la causa: senza, l'unico modo per recuperare
 * sarebbe modificare le righe a mano, che è proprio ciò che non si fa.
 */
export async function riprovaFalliti(db: Database = getDb()): Promise<number> {
  const rimessi = await db
    .update(outboxEvents)
    .set({ status: 'in_attesa', attempts: 0, availableAt: new Date(), lastError: null })
    .where(eq(outboxEvents.status, 'fallito'))
    .returning({ id: outboxEvents.id })
  return rimessi.length
}
