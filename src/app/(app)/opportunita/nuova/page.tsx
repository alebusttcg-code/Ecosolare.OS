import { guard } from '@/lib/auth/session'
import { getContattiRecenti, getLeadSources, getUtentiAttivi } from '@/lib/queries/lookup'
import { CHIAVI, getSetting } from '@/lib/settings'
import { FormNuovaOpportunita } from './form'

export const metadata = { title: 'Nuova opportunita — EcoSolare OS' }

export default async function NuovaOpportunitaPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>
}) {
  await guard('create', 'opportunity')

  const [{ cliente }, contatti, fonti, utenti, giorniDefault] = await Promise.all([
    searchParams,
    getContattiRecenti(),
    getLeadSources(),
    getUtentiAttivi(),
    getSetting(CHIAVI.giorniDefaultProssimaAzione, 2),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Nuova opportunita</h1>
      <FormNuovaOpportunita
        contatti={contatti}
        fonti={fonti}
        utenti={utenti}
        contattoPreselezionato={cliente}
        giorniDefault={giorniDefault}
      />
    </div>
  )
}
