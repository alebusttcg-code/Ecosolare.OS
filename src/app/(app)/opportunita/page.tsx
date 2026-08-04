import Link from 'next/link'
import { Badge, Card, Vuoto, formattaData, formattaEuro } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import { listOpportunities } from '@/lib/queries/opportunities'

export const metadata = { title: 'Opportunita — EcoSolare OS' }

export default async function OpportunitaPage() {
  await guard('read', 'opportunity')

  const righe = await listOpportunities(true)

  const perStato = new Map<string, typeof righe>()
  for (const riga of righe) {
    const elenco = perStato.get(riga.stageLabel) ?? []
    elenco.push(riga)
    perStato.set(riga.stageLabel, elenco)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Opportunita aperte</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
          {righe.length} in pipeline
        </p>
      </div>

      {righe.length === 0 ? (
        <Card>
          <Vuoto messaggio="Nessuna opportunita aperta. Aprine una dalla scheda di un cliente." />
        </Card>
      ) : (
        <div className="space-y-6">
          {[...perStato.entries()].map(([stato, elenco]) => (
            <Card key={stato} title={`${stato} (${elenco.length})`}>
              <ul className="divide-y" style={{ borderColor: 'var(--bordo)' }}>
                {elenco.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/opportunita/${o.id}`}
                          className="text-sm font-medium text-eco-blue-500 hover:underline"
                        >
                          {o.title}
                        </Link>
                        <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                          {o.code} · {o.cliente} · {o.businessLine}
                          {o.proprietario ? ` · ${o.proprietario}` : ''}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3 text-sm">
                        <span className="tabular-nums">{formattaEuro(o.estimatedValue)}</span>
                        {o.nextActionDueAt === null ? (
                          <Badge tone="critico">Senza prossima azione</Badge>
                        ) : o.inRitardo ? (
                          <Badge tone="attenzione">
                            Scaduta {formattaData(o.nextActionDueAt)}
                          </Badge>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                            {formattaData(o.nextActionDueAt)}
                          </span>
                        )}
                      </div>
                    </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
