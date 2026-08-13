import { and, asc, eq, isNotNull, isNull, or } from 'drizzle-orm'
import { getDb } from '@/db'
import { activities, contacts, opportunities, users } from '@/db/schema'
import type { Role } from '@/lib/auth/policy'
import { etichettaFase } from '@/lib/domain/follow-up'

/**
 * Tutto quello che una persona ha da fare, in un elenco solo.
 *
 * Prima erano due voci di menu che leggevano la stessa tabella: «Le mie
 * scadenze» filtrava per assegnatario, «Follow-up» per fase commerciale, e
 * **il primo filtro non escludeva il secondo insieme**. Ogni follow-up aperto
 * compariva quindi in tutte e due, e completandolo in una spariva dall'altra
 * senza spiegazione.
 *
 * Il sintomo più chiaro era che l'interfaccia provava a rimediare da sola, con
 * una parentesi nel sottotitolo: «to-do personali (i follow-up commerciali
 * stanno in Follow-up)». Un'etichetta che ha bisogno di una nota esplicativa
 * sta descrivendo una divisione che chi lavora non ha in testa.
 *
 * Qui la divisione resta, ma come **filtro dentro un elenco**, che è il posto
 * dove serve: la domanda è sempre «cosa devo fare», e solo qualche volta
 * «cosa devo fare di commerciale».
 */

export type TipoDaFare = 'follow_up' | 'personale'
export type FiltroTipo = TipoDaFare | 'tutte'
export type FiltroPersone = 'mie' | 'tutte'

export interface VoceDaFare {
  readonly id: string
  readonly tipo: TipoDaFare
  readonly subject: string
  readonly kind: string
  readonly dueAt: Date | null
  readonly scaduta: boolean
  readonly isNextAction: boolean
  readonly opportunityId: string | null
  readonly opportunityCode: string | null
  readonly clienteNome: string | null
  /** Chi la deve fare: serve solo quando si guardano anche gli altri. */
  readonly assegnatario: string
  /** Solo per i follow-up: fase e passo della sequenza. */
  readonly faseLabel: string | null
  readonly step: number | null
  readonly fase: string | null
}

export interface FiltriDaFare {
  readonly tipo: FiltroTipo
  readonly persone: FiltroPersone
}

/**
 * Chi può guardare oltre le proprie.
 *
 * Il commerciale vede le sue e basta, come prima. Gli altri ruoli vedevano
 * tutti i follow-up dell'azienda: quel quadro non si perde, ma diventa una
 * scelta invece che un effetto collaterale della voce di menu aperta.
 */
export function puoVedereAltrui(ruolo: Role): boolean {
  return ruolo !== 'commerciale'
}

export async function listDaFare(
  utente: { readonly id: string; readonly role: Role },
  filtri: FiltriDaFare,
): Promise<readonly VoceDaFare[]> {
  const db = getDb()
  const adesso = Date.now()

  const soloMie = filtri.persone === 'mie' || !puoVedereAltrui(utente.role)

  const condizioni = [isNull(activities.completedAt)]
  if (soloMie) condizioni.push(eq(activities.assignedTo, utente.id))
  if (filtri.tipo === 'follow_up') condizioni.push(isNotNull(activities.followUpPhase))
  if (filtri.tipo === 'personale') condizioni.push(isNull(activities.followUpPhase))

  /*
   * Un'attività legata a un lead archiviato non è più «da fare». I follow-up
   * escono anche quando l'opportunità è chiusa: la sequenza commerciale non ha
   * più senso su una trattativa conclusa.
   */
  condizioni.push(
    or(isNull(activities.opportunityId), isNull(opportunities.deletedAt))!,
  )
  condizioni.push(
    or(
      isNull(activities.followUpPhase),
      and(isNull(opportunities.deletedAt), isNull(opportunities.closedAt)),
    )!,
  )

  const righe = await db
    .select({
      id: activities.id,
      subject: activities.subject,
      kind: activities.kind,
      dueAt: activities.dueAt,
      isNextAction: activities.isNextAction,
      fase: activities.followUpPhase,
      step: activities.followUpStep,
      opportunityId: activities.opportunityId,
      opportunityCode: opportunities.code,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
      assegnatarioNome: users.name,
      assegnatarioEmail: users.email,
    })
    .from(activities)
    .leftJoin(opportunities, eq(opportunities.id, activities.opportunityId))
    .leftJoin(contacts, eq(contacts.id, opportunities.contactId))
    .leftJoin(users, eq(users.id, activities.assignedTo))
    .where(and(...condizioni))
    .orderBy(asc(activities.dueAt), asc(activities.followUpStep))
    .limit(200)

  return righe.map((r) => ({
    id: r.id,
    tipo: r.fase ? ('follow_up' as const) : ('personale' as const),
    subject: r.subject,
    kind: String(r.kind),
    dueAt: r.dueAt,
    scaduta: r.dueAt !== null && r.dueAt.getTime() < adesso,
    isNextAction: r.isNextAction,
    opportunityId: r.opportunityId,
    opportunityCode: r.opportunityCode,
    clienteNome:
      [r.clienteNome, r.clienteCognome].filter(Boolean).join(' ') || null,
    assegnatario: r.assegnatarioNome ?? r.assegnatarioEmail ?? '—',
    faseLabel: r.fase ? etichettaFase(r.fase) : null,
    step: r.step,
    fase: r.fase,
  }))
}

/** Quante ne sono in ritardo: è il numero che il menu mostra. */
export function contaScadute(voci: readonly VoceDaFare[]): number {
  return voci.filter((voce) => voce.scaduta).length
}
