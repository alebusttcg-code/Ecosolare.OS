import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/db'
import { contacts, opportunities, sites } from '@/db/schema'
import { can } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import { scomponiIndirizzo } from '@/lib/geo/tipi-via'
import { getCommercialiAttivi, getLeadSources } from '@/lib/queries/lookup'
import { FormModificaLead } from './form'

export const metadata = { title: 'Modifica lead — EcoSolare OS' }

export default async function ModificaLeadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const utente = await guard('update', 'opportunity')
  const { id } = await params

  const [riga] = await getDb()
    .select({
      opp: opportunities,
      contatto: contacts,
      sito: sites,
    })
    .from(opportunities)
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .leftJoin(sites, eq(sites.id, opportunities.siteId))
    .where(and(eq(opportunities.id, id), isNull(opportunities.deletedAt)))
    .limit(1)

  if (!riga) notFound()

  // Difesa in profondità: guard ha già filtrato, ma il form non va mostrato
  // a chi ha solo lettura se la policy cambiasse.
  if (!can(utente, 'update', 'opportunity')) notFound()

  const [fonti, commerciali] = await Promise.all([getLeadSources(), getCommercialiAttivi()])
  const pezzi = scomponiIndirizzo(riga.sito?.addressLine)
  const canale = riga.contatto.preferredChannel

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/lead/${id}`}
          className="text-sm"
          style={{ color: 'var(--testo-tenue)' }}
        >
          ← {riga.opp.code}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Modifica lead</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
          Anagrafica, indirizzo e dati della richiesta. Lo stato della pipeline si
          cambia dalla scheda.
        </p>
      </div>

      <FormModificaLead
        opportunityId={id}
        fonti={fonti}
        commerciali={commerciali}
        iniziale={{
          firstName: riga.contatto.firstName ?? '',
          lastName: riga.contatto.lastName,
          phone: riga.contatto.phone ?? '',
          email: riga.contatto.email ?? '',
          taxCode: riga.contatto.taxCode ?? '',
          preferredChannel:
            canale === 'telefono' || canale === 'email' || canale === 'whatsapp'
              ? canale
              : '',
          marketingConsent: riga.contatto.marketingConsent,
          businessLine: riga.opp.businessLine as
            | 'fotovoltaico'
            | 'elettrico'
            | 'idraulico',
          title: riga.opp.title,
          sourceId: riga.opp.sourceId ?? '',
          ownerId: riga.opp.ownerId,
          notes: riga.opp.notes ?? '',
          indirizzo: {
            streetType: pezzi.tipoVia,
            streetName: pezzi.nomeVia,
            houseNumber: pezzi.civico,
            province: riga.sito?.province ?? undefined,
            city: riga.sito?.city,
            postalCode: riga.sito?.postalCode ?? undefined,
          },
        }}
      />
    </div>
  )
}
