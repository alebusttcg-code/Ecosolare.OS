import Link from 'next/link'
import { Badge, Card, Intestazione, Vuoto, formattaData, formattaEuro } from '@/components/ui'
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
      <Intestazione
        eyebrow="Commerciale"
        titolo="Opportunità aperte"
        sottotitolo={`${righe.length} in pipeline`}
        azione={
          <Link
            href="/opportunita/nuova"
            className="bottone-oro rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso"
          >
            Nuova opportunità
          </Link>
        }
      />

      {righe.length === 0 ? (
        <Card>
          <Vuoto messaggio="Nessuna opportunita aperta. Aprine una dalla scheda di un cliente." />
        </Card>
      ) : (
        <div className="space-y-6">
          {[...perStato.entries()].map(([stato, elenco]) => (
            <Card key={stato} title={`${stato} (${elenco.length})`}>
              <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                {elenco.map((o) => (
                    <li
                      key={o.id}
                      className="riga flex items-center justify-between gap-4 rounded-md py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/opportunita/${o.id}`}
                          className="text-sm font-medium text-eco-blue-300 hover:underline collega"
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
