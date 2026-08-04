import { and, desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge, Card, Vuoto, formattaData, formattaEuro } from '@/components/ui'
import { getDb } from '@/db'
import { activities, contacts, opportunities, opportunityStatusHistory, users } from '@/db/schema'
import { guard } from '@/lib/auth/session'
import { getStages } from '@/lib/queries/pipeline'
import { CambiaStato } from './cambia-stato'

export const metadata = { title: 'Opportunita — EcoSolare OS' }

export default async function OpportunitaDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await guard('read', 'opportunity')
  const { id } = await params
  const db = getDb()

  const [riga] = await db
    .select({
      opp: opportunities,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
      clienteId: contacts.id,
      proprietario: users.name,
      proprietarioEmail: users.email,
    })
    .from(opportunities)
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .leftJoin(users, eq(users.id, opportunities.ownerId))
    .where(eq(opportunities.id, id))
    .limit(1)

  if (!riga) notFound()

  const [stages, storico, attivitaAperte] = await Promise.all([
    getStages(),
    db
      .select()
      .from(opportunityStatusHistory)
      .where(eq(opportunityStatusHistory.opportunityId, id))
      .orderBy(desc(opportunityStatusHistory.changedAt)),
    db
      .select()
      .from(activities)
      .where(and(eq(activities.opportunityId, id), eq(activities.isNextAction, true)))
      .limit(1),
  ])

  const opp = riga.opp
  const stato = stages.find((s) => s.code === opp.stage)
  const etichetta = (code: string | null) =>
    code ? (stages.find((s) => s.code === code)?.label ?? code) : '—'
  const prossima = attivitaAperte[0]

  return (
    <div className="space-y-6">
      <div>
        <Link href="/opportunita" className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
          ← Opportunita
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{opp.title}</h1>
          <Badge tone={stato?.isLost ? 'critico' : stato?.isWon ? 'positivo' : 'neutro'}>
            {stato?.label ?? opp.stage}
          </Badge>
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
          {opp.code} ·{' '}
          <Link href={`/clienti/${riga.clienteId}`} className="text-eco-blue-500 hover:underline">
            {[riga.clienteNome, riga.clienteCognome].filter(Boolean).join(' ')}
          </Link>{' '}
          · {opp.businessLine}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Prossima azione">
            {prossima ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">{prossima.subject}</div>
                  <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                    {prossima.kind} · scade {formattaData(prossima.dueAt)}
                  </div>
                </div>
                <Link href="/attivita" className="text-xs text-eco-blue-500 hover:underline">
                  Vai alle attivita
                </Link>
              </div>
            ) : stato?.isOpen ? (
              <p className="text-sm text-red-700">
                Nessuna prossima azione su un opportunita aperta: e un anomalia da
                correggere subito.
              </p>
            ) : (
              <Vuoto messaggio="Opportunita chiusa: nessuna azione in sospeso." />
            )}
          </Card>

          <Card title="Storico degli stati">
            {storico.length === 0 ? (
              <Vuoto messaggio="Nessun cambio di stato registrato." />
            ) : (
              <ul className="divide-y text-sm" style={{ borderColor: 'var(--bordo)' }}>
                {storico.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                    <div>
                      <span style={{ color: 'var(--testo-tenue)' }}>
                        {etichetta(s.fromStage)} →{' '}
                      </span>
                      <span className="font-medium">{etichetta(s.toStage)}</span>
                      {s.note ? (
                        <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                          {s.note}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right text-xs" style={{ color: 'var(--testo-tenue)' }}>
                      {formattaData(s.changedAt)}
                      {s.daysInPreviousStage !== null ? (
                        <div>{s.daysInPreviousStage} gg nel precedente</div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Cambia stato">
            <CambiaStato
              opportunityId={opp.id}
              statoCorrente={opp.stage}
              stages={stages}
            />
          </Card>

          <Card title="Dati">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                  Valore stimato
                </dt>
                <dd>{formattaEuro(opp.estimatedValue)}</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                  Probabilita
                </dt>
                <dd>{opp.probability}%</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                  Responsabile
                </dt>
                <dd>{riga.proprietario ?? riga.proprietarioEmail ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                  Prima risposta al cliente
                </dt>
                <dd>
                  {opp.firstResponseAt ? (
                    formattaData(opp.firstResponseAt)
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                      non ancora tracciata
                    </span>
                  )}
                </dd>
              </div>
              {opp.lostReason ? (
                <div>
                  <dt className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                    Motivo della perdita
                  </dt>
                  <dd>{opp.lostReason}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}
