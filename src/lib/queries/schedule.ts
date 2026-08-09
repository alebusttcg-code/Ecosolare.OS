import { and, asc, desc, eq, gte, inArray, isNull, or } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  contacts,
  projectStages,
  projects,
  sites,
  workOrderAssignments,
  workOrders,
  workers,
} from '@/db/schema'
import {
  isoDaDataGiorno,
  nomeOperaio,
  STATI_WO_ATTIVI,
  woAttivo,
} from '@/lib/domain/schedule'

export interface OperaioInElenco {
  readonly id: string
  readonly firstName: string
  readonly lastName: string
  readonly name: string
  readonly phone: string | null
  readonly isActive: boolean
}

export async function listWorkers(opzioni?: {
  soloAttivi?: boolean
}): Promise<OperaioInElenco[]> {
  const condizioni = opzioni?.soloAttivi ? [eq(workers.isActive, true)] : []
  const righe = await getDb()
    .select({
      id: workers.id,
      firstName: workers.firstName,
      lastName: workers.lastName,
      phone: workers.phone,
      isActive: workers.isActive,
    })
    .from(workers)
    .where(condizioni.length > 0 ? and(...condizioni) : undefined)
    .orderBy(asc(workers.lastName), asc(workers.firstName))

  return righe.map((r) => ({
    ...r,
    name: nomeOperaio(r.firstName, r.lastName),
  }))
}

export interface AssegnazioneOperaio {
  readonly id: string
  readonly name: string
  readonly phone: string | null
  readonly isActive: boolean
}

export interface WorkOrderAttivo {
  readonly id: string
  readonly scheduledOn: Date
  readonly scheduledOnIso: string
  readonly notes: string | null
  readonly status: string
  readonly operai: readonly AssegnazioneOperaio[]
}

async function operaiPerWorkOrders(
  woIds: readonly string[],
): Promise<Map<string, AssegnazioneOperaio[]>> {
  const perWo = new Map<string, AssegnazioneOperaio[]>()
  if (woIds.length === 0) return perWo

  const assegnati = await getDb()
    .select({
      workOrderId: workOrderAssignments.workOrderId,
      id: workers.id,
      firstName: workers.firstName,
      lastName: workers.lastName,
      phone: workers.phone,
      isActive: workers.isActive,
    })
    .from(workOrderAssignments)
    .innerJoin(workers, eq(workers.id, workOrderAssignments.workerId))
    .where(inArray(workOrderAssignments.workOrderId, [...woIds]))
    .orderBy(asc(workers.lastName), asc(workers.firstName))

  for (const a of assegnati) {
    const lista = perWo.get(a.workOrderId) ?? []
    lista.push({
      id: a.id,
      name: nomeOperaio(a.firstName, a.lastName),
      phone: a.phone,
      isActive: a.isActive,
    })
    perWo.set(a.workOrderId, lista)
  }
  return perWo
}

/**
 * Work order corrente della commessa: attivo (pianificato/in corso),
 * altrimenti l’ultimo completato (per non riproporre il form di pianificazione).
 */
export async function getWorkOrderAttivo(
  projectId: string,
): Promise<WorkOrderAttivo | null> {
  const db = getDb()
  const [attivo] = await db
    .select()
    .from(workOrders)
    .where(
      and(
        eq(workOrders.projectId, projectId),
        inArray(workOrders.status, [...STATI_WO_ATTIVI]),
      ),
    )
    .limit(1)

  const wo =
    attivo ??
    (
      await db
        .select()
        .from(workOrders)
        .where(
          and(eq(workOrders.projectId, projectId), eq(workOrders.status, 'completato')),
        )
        .orderBy(desc(workOrders.updatedAt))
        .limit(1)
    )[0]

  if (!wo) return null

  const perWo = await operaiPerWorkOrders([wo.id])
  return {
    id: wo.id,
    scheduledOn: wo.scheduledOn,
    scheduledOnIso: isoDaDataGiorno(wo.scheduledOn),
    notes: wo.notes,
    status: wo.status,
    operai: perWo.get(wo.id) ?? [],
  }
}

export interface RiepilogoPianificazioneElenco {
  readonly scheduledOn: Date
  readonly operaiLabel: string
  readonly nOperai: number
  readonly status: string
}

/** Riepilogo compatto per l'elenco commesse. */
export async function mappaPianificazioniAttive(
  projectIds: readonly string[],
): Promise<ReadonlyMap<string, RiepilogoPianificazioneElenco>> {
  const mappa = new Map<string, RiepilogoPianificazioneElenco>()
  if (projectIds.length === 0) return mappa

  const db = getDb()
  const ordini = await db
    .select({
      id: workOrders.id,
      projectId: workOrders.projectId,
      scheduledOn: workOrders.scheduledOn,
      status: workOrders.status,
    })
    .from(workOrders)
    .where(
      and(
        inArray(workOrders.projectId, [...projectIds]),
        inArray(workOrders.status, [...STATI_WO_ATTIVI]),
      ),
    )
    .orderBy(desc(workOrders.scheduledOn))

  if (ordini.length === 0) return mappa

  const perWo = await operaiPerWorkOrders(ordini.map((o) => o.id))

  for (const o of ordini) {
    if (mappa.has(o.projectId)) continue
    const nomi = (perWo.get(o.id) ?? []).map((x) => x.name)
    mappa.set(o.projectId, {
      scheduledOn: o.scheduledOn,
      status: o.status,
      nOperai: nomi.length,
      operaiLabel:
        nomi.length === 0
          ? 'nessun operaio'
          : nomi.length <= 2
            ? nomi.join(', ')
            : `${nomi.slice(0, 2).join(', ')} +${nomi.length - 2}`,
    })
  }

  return mappa
}

export interface VoceAgendaCantiere {
  readonly workOrderId: string
  readonly projectId: string
  readonly scheduledOn: Date
  readonly scheduledOnIso: string
  readonly status: string
  readonly notes: string | null
  readonly cliente: string
  readonly title: string
  readonly code: string
  readonly stageLabel: string
  readonly indirizzo: string | null
  readonly operai: readonly AssegnazioneOperaio[]
}

/**
 * Agenda operativa: work order pianificati / in corso, più i completati
 * degli ultimi 14 giorni, ordinati per giorno.
 */
export async function listAgendaCantieri(): Promise<readonly VoceAgendaCantiere[]> {
  const db = getDb()
  const oggi = new Date()
  const inizioCompletati = new Date(
    Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate() - 14, 0, 0, 0),
  )

  const righe = await db
    .select({
      workOrderId: workOrders.id,
      projectId: workOrders.projectId,
      scheduledOn: workOrders.scheduledOn,
      status: workOrders.status,
      notes: workOrders.notes,
      title: projects.title,
      code: projects.code,
      stageLabel: projectStages.label,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
      sitoIndirizzo: sites.addressLine,
      sitoComune: sites.city,
    })
    .from(workOrders)
    .innerJoin(projects, eq(projects.id, workOrders.projectId))
    .innerJoin(projectStages, eq(projectStages.code, projects.stage))
    .innerJoin(contacts, eq(contacts.id, projects.contactId))
    .leftJoin(sites, eq(sites.id, projects.siteId))
    .where(
      and(
        isNull(projects.deletedAt),
        or(
          inArray(workOrders.status, [...STATI_WO_ATTIVI]),
          and(
            eq(workOrders.status, 'completato'),
            gte(workOrders.scheduledOn, inizioCompletati),
          ),
        ),
      ),
    )
    .orderBy(asc(workOrders.scheduledOn), asc(contacts.lastName))

  const perWo = await operaiPerWorkOrders(righe.map((r) => r.workOrderId))

  return righe.map((r) => {
    const partiSito = [r.sitoIndirizzo, r.sitoComune].filter(Boolean)
    return {
      workOrderId: r.workOrderId,
      projectId: r.projectId,
      scheduledOn: r.scheduledOn,
      scheduledOnIso: isoDaDataGiorno(r.scheduledOn),
      status: r.status,
      notes: r.notes,
      cliente: [r.clienteNome, r.clienteCognome].filter(Boolean).join(' '),
      title: r.title,
      code: r.code,
      stageLabel: r.stageLabel,
      indirizzo: partiSito.length > 0 ? partiSito.join(', ') : null,
      operai: perWo.get(r.workOrderId) ?? [],
    }
  })
}

/** Esporta helper per test/UI che filtrano stati attivi. */
export { woAttivo }
