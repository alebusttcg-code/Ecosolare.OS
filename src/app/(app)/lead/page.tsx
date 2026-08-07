import Link from 'next/link'
import { Intestazione } from '@/components/ui'
import { can } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import { listOpportunities } from '@/lib/queries/opportunities'
import { ElencoLead } from './elenco-lead'

export const metadata = { title: 'Lead — EcoSolare OS' }

export default async function LeadPage() {
  const utente = await guard('read', 'opportunity')
  const righe = await listOpportunities()

  return (
    <div className="space-y-6">
      <Intestazione
        titolo="Lead"
        sottotitolo={`${righe.length} ${righe.length === 1 ? 'aperto' : 'aperti'}`}
        azione={
          <Link
            href="/lead/nuova"
            className="bottone-oro rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso"
          >
            Nuovo lead
          </Link>
        }
      />

      <ElencoLead
        lead={righe}
        puoModificare={can(utente, 'update', 'opportunity')}
      />
    </div>
  )
}
