import Link from 'next/link'
import { Intestazione } from '@/components/ui'
import { can } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import { listOpportunities, type VistaLead } from '@/lib/queries/opportunities'
import { ElencoLead } from './elenco-lead'

export const metadata = { title: 'Lead — EcoSolare OS' }

function comeVista(raw: string | undefined): VistaLead {
  if (raw === 'clienti' || raw === 'tutti') return raw
  return 'aperti'
}

export default async function LeadPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>
}) {
  const utente = await guard('read', 'opportunity')
  const params = await searchParams
  const vista = comeVista(params.vista)
  const righe = await listOpportunities(vista)

  const sottotitolo =
    vista === 'aperti'
      ? `${righe.length} ${righe.length === 1 ? 'aperto' : 'aperti'}`
      : vista === 'clienti'
        ? `${righe.length} con contratto firmato`
        : `${righe.length} in elenco`

  return (
    <div className="space-y-6">
      <Intestazione
        titolo="Lead"
        sottotitolo={sottotitolo}
        azione={
          <Link
            href="/lead/nuova"
            className="bottone-oro rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso"
          >
            Nuovo lead
          </Link>
        }
      />

      <div
        className="flex flex-wrap gap-1 rounded-lg border p-0.5 w-fit"
        style={{ borderColor: 'var(--bordo)', background: 'rgba(5,10,20,0.45)' }}
        role="tablist"
        aria-label="Vista elenco lead"
      >
        {(
          [
            { id: 'aperti' as const, label: 'Aperti' },
            { id: 'clienti' as const, label: 'Clienti' },
            { id: 'tutti' as const, label: 'Tutti' },
          ] as const
        ).map((v) => {
          const attivo = vista === v.id
          const href = v.id === 'aperti' ? '/lead' : `/lead?vista=${v.id}`
          return (
            <Link
              key={v.id}
              href={href}
              role="tab"
              aria-selected={attivo}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200"
              style={
                attivo
                  ? { background: 'rgba(232,199,101,0.16)', color: 'var(--color-eco-gold-300)' }
                  : { color: 'var(--testo-tenue)' }
              }
            >
              {v.label}
            </Link>
          )
        })}
      </div>

      <ElencoLead
        lead={righe}
        vista={vista}
        puoModificare={can(utente, 'update', 'opportunity')}
      />
    </div>
  )
}
