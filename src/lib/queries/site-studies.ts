import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { siteStudies } from '@/db/schema'
import type { SnapshotStudioTetto } from '@/lib/domain/studio-tetto'

export async function getStudiTettoPerLead(opportunityId: string) {
  return getDb()
    .select({
      id: siteStudies.id,
      title: siteStudies.title,
      status: siteStudies.status,
      moduliCount: siteStudies.moduliCount,
      powerKwp: siteStudies.powerKwp,
      produzioneKwh: siteStudies.produzioneKwh,
      consumoKwh: siteStudies.consumoKwh,
      formattedAddress: siteStudies.formattedAddress,
      updatedAt: siteStudies.updatedAt,
      completedAt: siteStudies.completedAt,
    })
    .from(siteStudies)
    .where(eq(siteStudies.opportunityId, opportunityId))
    .orderBy(desc(siteStudies.updatedAt))
}

export async function getStudioTetto(studyId: string) {
  const riga = await getDb().query.siteStudies.findFirst({
    where: eq(siteStudies.id, studyId),
  })
  if (!riga) return null
  return {
    ...riga,
    payload: riga.payload as SnapshotStudioTetto,
  }
}

/** Studio completo sullo stesso lead, per il gate del preventivo. */
export async function getStudioCompletoPerLead(
  opportunityId: string,
  studyId: string,
) {
  return getDb().query.siteStudies.findFirst({
    where: and(
      eq(siteStudies.id, studyId),
      eq(siteStudies.opportunityId, opportunityId),
      eq(siteStudies.status, 'completo'),
    ),
    columns: {
      id: true,
      moduliCount: true,
      powerKwp: true,
      produzioneKwh: true,
      consumoKwh: true,
      formattedAddress: true,
    },
  })
}
