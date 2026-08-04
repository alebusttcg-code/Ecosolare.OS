import { asc } from 'drizzle-orm'
import { getDb } from '@/db'
import { pipelineStages } from '@/db/schema'
import type { StageDefinition } from '@/lib/domain/pipeline'

/** Gli stati configurati, nell'ordine della pipeline. */
export async function getStages(): Promise<StageDefinition[]> {
  const righe = await getDb()
    .select()
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.sortOrder))

  return righe.map((r) => ({
    code: r.code,
    label: r.label,
    sortOrder: r.sortOrder,
    isOpen: r.isOpen,
    isWon: r.isWon,
    isLost: r.isLost,
    defaultProbability: r.defaultProbability,
    isActive: r.isActive,
  }))
}
