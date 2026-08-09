import Link from 'next/link'
import { Badge, Card, Intestazione, Vuoto, formattaData } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import { etichettaStatoWorkOrder, isoDaDataGiorno } from '@/lib/domain/schedule'
import { listAgendaCantieri, type VoceAgendaCantiere } from '@/lib/queries/schedule'

export const metadata = { title: 'Agenda cantieri — EcoSolare OS' }

function tonoBadge(status: string): 'positivo' | 'attenzione' | 'blu' | 'neutro' {
  if (status === 'in_corso') return 'attenzione'
  if (status === 'completato') return 'blu'
  if (status === 'pianificato') return 'positivo'
  return 'neutro'
}

function etichettaGiorno(iso: string, oggiIso: string): string | null {
  if (iso === oggiIso) return 'Oggi'
  const oggi = new Date()
  const domaniIso = isoDaDataGiorno(
    new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate() + 1, 12)),
  )
  if (iso === domaniIso) return 'Domani'
  return null
}

export default async function AgendaCantieriPage() {
  await guard('read', 'schedule')
  const voci = await listAgendaCantieri()

  const oggi = new Date()
  const oggiIso = isoDaDataGiorno(
    new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate(), 12)),
  )

  const inCorso = voci.filter((v) => v.status === 'in_corso')
  const programma = voci.filter((v) => v.status === 'pianificato')
  const completati = voci.filter((v) => v.status === 'completato')

  const perGiorno = new Map<string, VoceAgendaCantiere[]>()
  for (const v of programma) {
    const lista = perGiorno.get(v.scheduledOnIso) ?? []
    lista.push(v)
    perGiorno.set(v.scheduledOnIso, lista)
  }
  const giorni = [...perGiorno.keys()].sort()

  return (
    <div className="space-y-8">
      <div>
        <Link href="/cantieri" className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
          ← Cantieri e commesse
        </Link>
        <Intestazione
          titolo="Agenda cantieri"
          sottotitolo="Chi va dove e quando — pianificazione e lavori in corso."
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide">In corso</h2>
        {inCorso.length === 0 ? (
          <Card>
            <Vuoto messaggio="Nessuna installazione in corso." />
          </Card>
        ) : (
          <ul className="space-y-3">
            {inCorso.map((v) => (
              <li key={v.workOrderId}>
                <VoceAgenda voce={v} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-wide">In programma</h2>
        {giorni.length === 0 ? (
          <Card>
            <Vuoto messaggio="Nessun cantiere pianificato. Si apre dalla scheda commessa quando è Pianificabile." />
          </Card>
        ) : (
          giorni.map((iso) => (
            <div key={iso} className="space-y-2">
              <h3
                className="text-xs font-medium tracking-wide"
                style={{
                  color: iso === oggiIso ? 'var(--color-eco-gold-300)' : 'var(--testo-tenue)',
                }}
              >
                {(() => {
                  const etichetta = etichettaGiorno(iso, oggiIso)
                  const data = formattaData(new Date(`${iso}T12:00:00.000Z`))
                  if (!etichetta) return data
                  return (
                    <>
                      <span className="uppercase tracking-wider">{etichetta}</span>
                      <span className="ml-2" style={{ color: 'var(--testo-fioco)' }}>
                        {data}
                      </span>
                    </>
                  )
                })()}
              </h3>
              <ul className="space-y-2">
                {(perGiorno.get(iso) ?? []).map((v) => (
                  <li key={v.workOrderId}>
                    <VoceAgenda voce={v} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {completati.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide">Completati di recente</h2>
          <ul className="space-y-2">
            {completati.map((v) => (
              <li key={v.workOrderId}>
                <VoceAgenda voce={v} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function VoceAgenda({ voce }: { voce: VoceAgendaCantiere }) {
  return (
    <Link
      href={`/cantieri/${voce.projectId}`}
      className="pannello pannello-interattivo block rounded-[0.875rem] px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-eco-blue-400/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-eco-blue-300">{voce.cliente}</div>
          <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
            {voce.title} · {voce.code} · {voce.stageLabel}
          </div>
          {voce.indirizzo ? (
            <div className="mt-1 text-xs" style={{ color: 'var(--testo-tenue)' }}>
              {voce.indirizzo}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {voce.operai.length === 0 ? (
              <span className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
                Nessun operaio
              </span>
            ) : (
              voce.operai.map((o) => (
                <Badge key={o.id} tone="blu">
                  {o.name}
                </Badge>
              ))
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge tone={tonoBadge(voce.status)}>
            {etichettaStatoWorkOrder(voce.status)}
          </Badge>
          <span className="text-xs tabular-nums" style={{ color: 'var(--testo-tenue)' }}>
            {formattaData(voce.scheduledOn)}
          </span>
        </div>
      </div>
    </Link>
  )
}
