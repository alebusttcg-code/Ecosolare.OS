import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/db'
import { workOrderAssignments, workOrders, workers } from '@/db/schema'
import { isoDaDataGiorno, nomeOperaio } from '@/lib/domain/schedule'

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

export async function getWorkOrderAttivo(
  projectId: string,
): Promise<WorkOrderAttivo | null> {
  const db = getDb()
  const [wo] = await db
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.projectId, projectId), eq(workOrders.status, 'pianificato')))
    .limit(1)

  if (!wo) return null

  const assegnati = await db
    .select({
      id: workers.id,
      firstName: workers.firstName,
      lastName: workers.lastName,
      phone: workers.phone,
      isActive: workers.isActive,
    })
    .from(workOrderAssignments)
    .innerJoin(workers, eq(workers.id, workOrderAssignments.workerId))
    .where(eq(workOrderAssignments.workOrderId, wo.id))
    .orderBy(asc(workers.lastName), asc(workers.firstName))

  return {
    id: wo.id,
    scheduledOn: wo.scheduledOn,
    scheduledOnIso: isoDaDataGiorno(wo.scheduledOn),
    notes: wo.notes,
    status: wo.status,
    operai: assegnati.map((o) => ({
      id: o.id,
      name: nomeOperaio(o.firstName, o.lastName),
      phone: o.phone,
      isActive: o.isActive,
    })),
  }
}

/** Riepilogo compatto per l'elenco commesse. */
export async function mappaPianificazioniAttive(
  projectIds: readonly string[],
): Promise<
  ReadonlyMap<
    string,
    { readonly scheduledOn: Date; readonly operaiLabel: string; readonly nOperai: number }
  >
> {
  const mappa = new Map<
    string,
    { readonly scheduledOn: Date; readonly operaiLabel: string; readonly nOperai: number }
  >()
  if (projectIds.length === 0) return mappa

  const db = getDb()
  const ordini = await db
    .select({
      id: workOrders.id,
      projectId: workOrders.projectId,
      scheduledOn: workOrders.scheduledOn,
    })
    .from(workOrders)
    .where(
      and(inArray(workOrders.projectId, [...projectIds]), eq(workOrders.status, 'pianificato')),
    )
    .orderBy(desc(workOrders.scheduledOn))

  if (ordini.length === 0) return mappa

  const woIds = ordini.map((o) => o.id)
  const assegnati = await db
    .select({
      workOrderId: workOrderAssignments.workOrderId,
      firstName: workers.firstName,
      lastName: workers.lastName,
    })
    .from(workOrderAssignments)
    .innerJoin(workers, eq(workers.id, workOrderAssignments.workerId))
    .where(inArray(workOrderAssignments.workOrderId, woIds))
    .orderBy(asc(workers.lastName), asc(workers.firstName))

  const perWo = new Map<string, string[]>()
  for (const a of assegnati) {
    const lista = perWo.get(a.workOrderId) ?? []
    lista.push(nomeOperaio(a.firstName, a.lastName))
    perWo.set(a.workOrderId, lista)
  }

  for (const o of ordini) {
    if (mappa.has(o.projectId)) continue
    const nomi = perWo.get(o.id) ?? []
    mappa.set(o.projectId, {
      scheduledOn: o.scheduledOn,
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
