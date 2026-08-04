import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge, Card, Vuoto, formattaData, formattaEuro } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import { getContactDetail } from '@/lib/queries/contacts'
import { getStages } from '@/lib/queries/pipeline'
import { NuovoImmobile } from './nuovo-immobile'

export const metadata = { title: 'Scheda cliente — EcoSolare OS' }

export default async function SchedaClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await guard('read', 'contact')

  const { id } = await params
  const [dettaglio, stages] = await Promise.all([getContactDetail(id), getStages()])
  if (!dettaglio) notFound()

  const { contatto, siti, opportunita, attivita } = dettaglio
  const etichettaStato = (code: string) =>
    stages.find((s) => s.code === code)?.label ?? code

  const nome = [contatto.firstName, contatto.lastName].filter(Boolean).join(' ')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/clienti" className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
            ← Clienti
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{nome}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
            {[contatto.phone, contatto.email].filter(Boolean).join(' · ') || 'Nessun recapito'}
          </p>
        </div>
        {contatto.marketingConsent ? (
          <Badge tone="positivo">Consenso commerciale</Badge>
        ) : (
          <Badge>Nessun consenso commerciale</Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Opportunita"
            action={
              <Link
                href={`/opportunita/nuova?cliente=${contatto.id}`}
                className="text-xs text-eco-blue-500 hover:underline"
              >
                + Nuova opportunita
              </Link>
            }
          >
            {opportunita.length === 0 ? (
              <Vuoto messaggio="Nessuna opportunita per questo cliente." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--bordo)' }}>
                {opportunita.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div>
                      <Link
                        href={`/opportunita/${o.id}`}
                        className="text-sm font-medium text-eco-blue-500 hover:underline"
                      >
                        {o.title}
                      </Link>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                        {o.code} · {o.businessLine}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span>{formattaEuro(o.estimatedValue)}</span>
                      <Badge tone={o.closedAt ? 'neutro' : 'positivo'}>
                        {etichettaStato(o.stage)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Storico attivita">
            {attivita.length === 0 ? (
              <Vuoto messaggio="Nessuna attivita registrata." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--bordo)' }}>
                {attivita.map((a) => (
                  <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm">{a.subject}</span>
                      <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                        {a.completedAt
                          ? `completata ${formattaData(a.completedAt)}`
                          : `scade ${formattaData(a.dueAt)}`}
                      </span>
                    </div>
                    {a.outcome ? (
                      <p className="mt-1 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                        {a.outcome}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Anagrafica">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                  Codice fiscale
                </dt>
                <dd>{contatto.taxCode ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                  Telefono normalizzato
                </dt>
                <dd className="font-mono text-xs">{contatto.phoneE164 ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                  Cliente dal
                </dt>
                <dd>{formattaData(contatto.createdAt)}</dd>
              </div>
              {contatto.notes ? (
                <div>
                  <dt className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                    Note
                  </dt>
                  <dd className="whitespace-pre-wrap">{contatto.notes}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card title="Immobili">
            <div className="space-y-3">
              {siti.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
                  Nessun immobile registrato.
                </p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {siti.map((s) => (
                    <li key={s.id}>
                      <div className="font-medium">{s.label}</div>
                      <div className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                        {s.addressLine}, {s.city}
                        {s.province ? ` (${s.province})` : ''}
                      </div>
                      {s.pod ? (
                        <div className="font-mono text-xs" style={{ color: 'var(--testo-tenue)' }}>
                          POD {s.pod}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <NuovoImmobile contactId={contatto.id} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
