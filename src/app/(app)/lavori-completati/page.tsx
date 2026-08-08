import Link from 'next/link'
import { LinkNome } from '@/components/link-nome'
import { Card, Intestazione, Vuoto, formattaData, formattaEuro } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import { listProjects } from '@/lib/queries/projects'

export const metadata = { title: 'Lavori completati — EcoSolare OS' }

/**
 * Archivio dei lavori chiusi.
 *
 * Non è un secondo elenco di cantieri: è il posto dove si torna mesi dopo per
 * ritrovare contratto, documenti, materiali e pagamenti di un lavoro finito,
 * senza mischiarli a quelli ancora aperti.
 */
export default async function LavoriCompletatiPage() {
  const utente = await guard('read', 'project')

  const righe = await listProjects(utente, 'completate')

  return (
    <div>
      <Intestazione
        eyebrow="Archivio"
        titolo="Lavori completati"
        sottotitolo={
          righe.length === 0
            ? 'Qui finiscono le commesse chiuse, con tutto ciò che serve a ritrovarle.'
            : `${righe.length} ${righe.length === 1 ? 'lavoro chiuso' : 'lavori chiusi'}`
        }
      />

      <Card indice={0}>
        {righe.length === 0 ? (
          <Vuoto messaggio="Nessun lavoro completato. Quando una commessa passa allo stato «Chiusa», compare qui." />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
            {righe.map((r) => (
              <li key={r.id} className="riga rounded-md py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <LinkNome href={`/clienti/${r.clienteId}`} className="text-sm font-medium">
                      {r.cliente}
                    </LinkNome>
                    <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                      <Link
                        href={`/cantieri/${r.id}`}
                        className="collega text-eco-blue-300 hover:underline"
                      >
                        {r.title}
                      </Link>
                      {' · '}
                      {r.code}
                      {r.responsabile ? ` · ${r.responsabile}` : ''}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                      Chiuso il {formattaData(r.chiusaDal)} · {r.stageLabel}
                    </div>
                  </div>

                  <div className="shrink-0 text-sm tabular-nums">{formattaEuro(r.revenueNet)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
