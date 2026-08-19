import { redirect } from 'next/navigation'
import { Intestazione } from '@/components/ui'
import { getCurrentUser, guard } from '@/lib/auth/session'
import { dataEstesa, primoNome, saluto } from '@/lib/saluto'
import { FasciaSalute } from './dashboard/fascia-salute'
import { SezioneEconomia } from './dashboard/sezione-economia'
import { SezioneOggi } from './dashboard/sezione-oggi'
import { SezionePerformance } from './dashboard/sezione-performance'
import { HomeContabilita } from './home-contabilita'
import { HomeOperativa } from './home-operativa'

export const metadata = { title: 'Home — EcoSolare OS' }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodo?: string
    da?: string
    a?: string
    coorte?: string
  }>
}) {
  const utente = await getCurrentUser()
  if (!utente) redirect('/accedi')

  // Risorsa dashboard verificata per tutti (ADR-006); ogni ruolo ha però la sua
  // home: la direzione vede il cruscotto completo, gli altri il quadro della
  // loro giornata invece di un elenco.
  await guard('read', 'dashboard')

  if (utente.role === 'contabilita') return <HomeContabilita utente={utente} />
  if (utente.role !== 'amministratore') return <HomeOperativa utente={utente} />

  const params = await searchParams
  const adesso = new Date()
  const nome = primoNome(utente.name, utente.email)
  const periodoEco = {
    periodo: params.periodo,
    da: params.da,
    a: params.a,
  }

  return (
    <div className="space-y-14">
      <Intestazione
        eyebrow="Dashboard"
        titolo={`${saluto()}, ${nome}`}
        titoloOro
        sottotitolo={`${dataEstesa()} · economia, performance commerciale e operatività`}
      />

      <FasciaSalute />

      <SezioneEconomia
        canViewCosts={utente.canViewCosts}
        params={periodoEco}
        coorte={params.coorte}
        adesso={adesso}
      />

      <div className="filetto" />

      <SezionePerformance
        coorteCodice={params.coorte}
        periodoEconomia={periodoEco}
        adesso={adesso}
      />

      <div className="filetto" />

      <SezioneOggi userId={utente.id} />
    </div>
  )
}
