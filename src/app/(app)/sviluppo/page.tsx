import { Intestazione } from '@/components/ui'
import { env } from '@/env'
import { guard } from '@/lib/auth/session'
import { LaboratorioSolar } from './laboratorio'

export const metadata = { title: 'Sviluppo — EcoSolare OS' }

export default async function SviluppoPage() {
  await guard('read', 'sviluppo')
  const configurato = Boolean(env().GOOGLE_MAPS_API_KEY?.trim())

  return (
    <div className="space-y-6">
      <Intestazione
        eyebrow="Laboratorio"
        titolo="Sviluppo"
        sottotitolo="Analisi tetto da indirizzo (Google Solar) — primo passo verso il dimensionamento impianto"
      />
      <LaboratorioSolar configurato={configurato} />
    </div>
  )
}
