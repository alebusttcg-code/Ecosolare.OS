import Link from 'next/link'
import { Intestazione } from '@/components/ui'
import { getDb } from '@/db'
import { contacts, opportunities, sites } from '@/db/schema'
import { env } from '@/env'
import { guard } from '@/lib/auth/session'
import type { SnapshotStudioTetto } from '@/lib/domain/studio-tetto'
import { percorsoAppSicuro } from '@/lib/percorso-app'
import { getStudioTetto } from '@/lib/queries/site-studies'
import { and, eq, isNull } from 'drizzle-orm'
import { LaboratorioSolar } from './laboratorio'

export const metadata = { title: 'Sviluppo — EcoSolare OS' }

export default async function SviluppoPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; studio?: string; da?: string }>
}) {
  await guard('read', 'sviluppo')
  const configurato = Boolean(env().GOOGLE_MAPS_API_KEY?.trim())
  const { lead, studio, da: daRaw } = await searchParams
  const ritorno = percorsoAppSicuro(daRaw)
  const daSopralluogo = ritorno?.startsWith('/agenda/') ?? false

  let contestoCrm: {
    opportunityId: string
    studyId?: string
    indirizzoProposto?: string
    titoloLead?: string
    snapshotIniziale?: SnapshotStudioTetto
  } | null = null

  if (lead && zUuid(lead)) {
    const db = getDb()
    const [riga] = await db
      .select({
        id: opportunities.id,
        title: opportunities.title,
        via: sites.addressLine,
        citta: sites.city,
        provincia: sites.province,
        cap: sites.postalCode,
        clienteNome: contacts.firstName,
        clienteCognome: contacts.lastName,
      })
      .from(opportunities)
      .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
      .leftJoin(sites, eq(sites.id, opportunities.siteId))
      .where(and(eq(opportunities.id, lead), isNull(opportunities.deletedAt)))
      .limit(1)

    if (riga) {
      const indirizzo = [
        riga.via,
        [riga.cap, riga.citta].filter(Boolean).join(' '),
        riga.provincia ? `(${riga.provincia})` : null,
      ]
        .filter(Boolean)
        .join(', ')

      let snapshotIniziale: SnapshotStudioTetto | undefined
      const studyId = studio && zUuid(studio) ? studio : undefined
      if (studyId) {
        const esistente = await getStudioTetto(studyId)
        if (esistente && esistente.opportunityId === riga.id) {
          snapshotIniziale = esistente.payload
        }
      }

      contestoCrm = {
        opportunityId: riga.id,
        studyId,
        indirizzoProposto:
          snapshotIniziale?.analisi.formattedAddress || indirizzo || undefined,
        titoloLead:
          riga.title ||
          [riga.clienteNome, riga.clienteCognome].filter(Boolean).join(' ') ||
          undefined,
        snapshotIniziale,
      }
    }
  }

  return (
    <div className="space-y-6">
      {ritorno && daSopralluogo ? (
        <Link
          href={ritorno}
          className="inline-block text-sm"
          style={{ color: 'var(--testo-tenue)' }}
        >
          ← Torna al sopralluogo
        </Link>
      ) : null}
      <Intestazione
        eyebrow={contestoCrm ? 'Studio tetto' : 'Laboratorio'}
        titolo="Sviluppo"
        sottotitolo={
          daSopralluogo
            ? 'Analizza il tetto e salva lo studio completo per tornare al sopralluogo con la geometria'
            : contestoCrm
              ? 'Analisi dell’immobile del lead e salvataggio per il preventivo'
              : 'Analisi del tetto da indirizzo e anteprima disposizione moduli'
        }
      />
      <LaboratorioSolar
        configurato={configurato}
        contestoCrm={contestoCrm}
        ritorno={ritorno}
      />
    </div>
  )
}

function zUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  )
}
