import { asc } from 'drizzle-orm'
import { getDb } from '@/db'
import { pipelineStages } from '@/db/schema'
import type { StageDefinition } from '@/lib/domain/pipeline'

/**
 * Etichette leggibili per stati chiusi ancora salvati col gergo CRM inglese
 * («Vinto» / «Perso»). Il codice resta `vinto`/`perso`; cambia solo cosa si vede.
 */
function etichettaStatoPipeline(code: string, label: string): string {
  if (code === 'vinto' && /^vinto$/i.test(label.trim())) return 'Contratto firmato'
  if (code === 'perso' && /^perso$/i.test(label.trim())) return 'Non concluso'
  return label
}

/** Gli stati configurati, nell'ordine della pipeline. */
export async function getStages(): Promise<StageDefinition[]> {
  const righe = await getDb()
    .select()
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.sortOrder))

  return righe.map((r) => ({
    code: r.code,
    label: etichettaStatoPipeline(r.code, r.label),
    sortOrder: r.sortOrder,
    isOpen: r.isOpen,
    isWon: r.isWon,
    isLost: r.isLost,
    defaultProbability: r.defaultProbability,
    isActive: r.isActive,
  }))
}
