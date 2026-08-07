import { and, eq, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { getDb } from '@/db'
import { contacts } from '@/db/schema'
import { guard } from '@/lib/auth/session'
import { getLeadSources, getCommercialiAttivi } from '@/lib/queries/lookup'
import { CHIAVI, getSetting } from '@/lib/settings'
import { FormNuovoLead } from './form'

export const metadata = { title: 'Nuovo lead — EcoSolare OS' }

export default async function NuovoLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>
}) {
  await guard('create', 'opportunity')

  const [{ cliente }, fonti, commerciali, giorniDefault] = await Promise.all([
    searchParams,
    getLeadSources(),
    getCommercialiAttivi(),
    getSetting(CHIAVI.giorniDefaultProssimaAzione, 2),
  ])

  const contattoEsistente = cliente
    ? await getDb().query.contacts.findFirst({
        where: and(eq(contacts.id, cliente), isNull(contacts.deletedAt)),
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      })
    : undefined

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/lead" className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
          ← Lead
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Nuovo lead</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
          Inserisci chi ha chiesto e cosa serve. L’anagrafica nasce insieme al lead.
        </p>
      </div>
      <FormNuovoLead
        fonti={fonti}
        commerciali={commerciali}
        giorniDefault={giorniDefault}
        contattoEsistente={contattoEsistente}
      />
    </div>
  )
}
