import { redirect } from 'next/navigation'
import { Intestazione } from '@/components/ui'
import { homeDopoAccesso } from '@/lib/auth/home'
import { getCurrentUser, guard } from '@/lib/auth/session'
import { SezioneEconomia } from './dashboard/sezione-economia'
import { SezioneOggi } from './dashboard/sezione-oggi'
import { SezionePerformance } from './dashboard/sezione-performance'

export const metadata = { title: 'Dashboard — EcoSolare OS' }

/** Saluto secondo l'ora italiana: è la prima riga che si legge ogni mattina. */
function saluto(): string {
  const ora = Number(
    new Intl.DateTimeFormat('it-IT', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Europe/Rome',
    }).format(new Date()),
  )
  if (ora >= 5 && ora < 13) return 'Buongiorno'
  if (ora < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

function dataEstesa(): string {
  const testo = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Rome',
  }).format(new Date())
  return testo.charAt(0).toUpperCase() + testo.slice(1)
}

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
  if (utente.role !== 'amministratore') redirect(homeDopoAccesso(utente))

  // Risorsa dashboard ancora verificata (ADR-006); il ruolo restringe la pagina.
  await guard('read', 'dashboard')

  const params = await searchParams
  const adesso = new Date()
  const nome = (utente.name ?? utente.email).split(/[\s@]/)[0]
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
