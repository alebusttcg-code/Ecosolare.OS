import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge, Card, Vuoto, formattaData, formattaEuro } from '@/components/ui'
import { BottoneChiama, BottoneWhatsApp } from '@/components/bottoni-contatto'
import { guard } from '@/lib/auth/session'
import { getContactDetail } from '@/lib/queries/contacts'
import { getStages } from '@/lib/queries/pipeline'
import { NuovoImmobile } from './nuovo-immobile'

export const metadata = { title: 'Clienti — EcoSolare OS' }

/** Evita che una soft-navigation resti appesa su una shell cache stale. */
export const dynamic = 'force-dynamic'

export default async function SchedaClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const utente = await guard('read', 'contact')

  const { id } = await params
  // In sequenza: con pool da 1 su Vercel le Promise.all contese sulla stessa
  // connessione a volte non rilasciano e la navigazione gira senza fine.
  const dettaglio = await getContactDetail(utente, id)
  if (!dettaglio) notFound()
  const stages = await getStages()

  const { contatto, siti, opportunita, attivita, clienteDal, commesse, eCliente } =
    dettaglio
  const statoDi = (code: string) => stages.find((s) => s.code === code)
  const etichettaStato = (code: string) => statoDi(code)?.label ?? code

  const nome = [contatto.firstName, contatto.lastName].filter(Boolean).join(' ')
  const leadAperto = opportunita.find((o) => !o.closedAt)

  const alertCommesse = commesse.filter(
    (c) => c.documentiMancanti.length > 0 || c.readinessState !== 'pianificabile',
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={eCliente ? '/clienti' : '/lead'}
            className="text-sm"
            style={{ color: 'var(--testo-tenue)' }}
          >
            {eCliente ? '← Clienti' : '← Lead'}
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{nome}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
            {contatto.phone ? contatto.phone : null}
            {contatto.phone && contatto.email ? ' · ' : null}
            {contatto.email ? (
              <a href={`mailto:${contatto.email}`} className="collega text-eco-blue-300">
                {contatto.email}
              </a>
            ) : null}
            {!contatto.phone && !contatto.email ? 'Nessun recapito' : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {contatto.phone ? (
            <BottoneChiama telefono={contatto.phone} telefonoE164={contatto.phoneE164} />
          ) : null}
          {contatto.phoneE164 ? <BottoneWhatsApp telefonoE164={contatto.phoneE164} /> : null}
          {eCliente ? (
            <Badge tone="positivo">Cliente</Badge>
          ) : (
            <Badge tone="attenzione">Ancora un lead</Badge>
          )}
          {contatto.marketingConsent ? (
            <Badge tone="positivo">Consenso commerciale</Badge>
          ) : (
            <Badge>Nessun consenso commerciale</Badge>
          )}
        </div>
      </div>

      {!eCliente ? (
        <div
          className="rounded-xl border p-4 text-sm"
          style={{
            borderColor: 'rgba(217,164,65,0.35)',
            background: 'rgba(217,164,65,0.08)',
            color: 'var(--testo-tenue)',
          }}
        >
          Diventa cliente solo dopo aver accettato e firmato un preventivo.
          {leadAperto ? (
            <>
              {' '}
              <Link
                href={`/lead/${leadAperto.id}`}
                className="text-eco-blue-300 hover:underline collega"
              >
                Apri il lead in corso →
              </Link>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {eCliente ? (
            <Card
              title="Cantieri e commesse"
              action={
                <Link
                  href="/cantieri"
                  className="text-xs text-eco-blue-300 hover:underline collega"
                >
                  Vai ai cantieri →
                </Link>
              }
            >
              {commesse.length === 0 ? (
                <Vuoto messaggio="Nessuna commessa aperta dopo la firma del contratto." />
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                  {commesse.map((c) => {
                    const nDoc = c.documentiMancanti.length
                    return (
                      <li
                        key={c.id}
                        className="riga flex items-start justify-between gap-4 rounded-md py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/cantieri/${c.id}`}
                            className="text-sm font-medium text-eco-blue-300 hover:underline collega"
                          >
                            {c.title}
                          </Link>
                          <div
                            className="mt-0.5 text-xs"
                            style={{ color: 'var(--testo-tenue)' }}
                          >
                            {c.code}
                            {nDoc > 0
                              ? ` · ${nDoc} document${nDoc === 1 ? 'o' : 'i'} da completare`
                              : c.readinessState === 'pianificabile'
                                ? ' · pronto per la pianificazione'
                                : ' · in preparazione cantiere'}
                          </div>
                        </div>
                        <Badge
                          tone={
                            c.readinessState === 'pianificabile'
                              ? 'positivo'
                              : nDoc > 0
                                ? 'attenzione'
                                : 'neutro'
                          }
                        >
                          {c.stageLabel}
                        </Badge>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          ) : null}

          <Card
            title="Pratiche commerciali"
            action={
              eCliente ? (
                <Link
                  href={`/lead/nuova?cliente=${contatto.id}`}
                  className="text-xs text-eco-blue-300 hover:underline collega"
                >
                  + Nuovo lead
                </Link>
              ) : undefined
            }
          >
            {opportunita.length === 0 ? (
              <Vuoto messaggio="Nessun lead collegato." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                {opportunita.map((o) => (
                  <li
                    key={o.id}
                    className="riga flex items-center justify-between gap-4 rounded-md py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <Link
                        href={`/lead/${o.id}`}
                        className="text-sm font-medium text-eco-blue-300 hover:underline collega"
                      >
                        {o.title}
                      </Link>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                        {o.code} · {o.businessLine}
                        {statoDi(o.stage)?.isWon
                          ? ' · il seguito è nel cantiere'
                          : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      {o.estimatedValue != null ? (
                        <span>{formattaEuro(o.estimatedValue)}</span>
                      ) : null}
                      <Badge
                        tone={
                          statoDi(o.stage)?.isWon
                            ? 'positivo'
                            : statoDi(o.stage)?.isLost
                              ? 'critico'
                              : o.closedAt
                                ? 'neutro'
                                : 'positivo'
                        }
                      >
                        {etichettaStato(o.stage)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Storico attività">
            {attivita.length === 0 ? (
              <Vuoto messaggio="Nessuna attività registrata." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                {attivita.map((a) => (
                  <li key={a.id} className="riga rounded-md py-3 first:pt-0 last:pb-0">
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
          {alertCommesse.length > 0 ? (
            <section
              className="pannello rivela overflow-hidden"
              style={{
                borderColor: 'rgba(217,164,65,0.5)',
                background:
                  'linear-gradient(165deg, rgba(217,164,65,0.14) 0%, rgba(15,28,46,0.55) 55%)',
              }}
            >
              <header
                className="flex items-center justify-between gap-3 border-b px-5 py-3.5"
                style={{ borderColor: 'rgba(217,164,65,0.28)' }}
              >
                <h2 className="text-sm font-semibold tracking-wide text-eco-gold-300">
                  Azione richiesta
                </h2>
                <Badge tone="attenzione">Documenti</Badge>
              </header>
              <div className="space-y-4 p-5">
                {alertCommesse.map((c) => {
                  const voci =
                    c.documentiMancanti.length > 0
                      ? c.documentiMancanti
                      : c.bloccanti.slice(0, 3)
                  const href =
                    c.documentiMancanti.length > 0
                      ? `/cantieri/${c.id}#documenti`
                      : `/cantieri/${c.id}`
                  return (
                    <div key={c.id} className="space-y-2">
                      <p className="text-sm font-medium">{c.title}</p>
                      <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                        Contratto firmato: per partire mancano ancora elementi sul cantiere.
                      </p>
                      {voci.length > 0 ? (
                        <ul className="space-y-1 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                          {voci.slice(0, 4).map((b, i) => (
                            <li key={i} className="flex gap-2">
                              <span style={{ color: 'var(--color-eco-gold-300)' }}>▸</span>
                              <a
                                href={
                                  'ancora' in b && typeof b.ancora === 'string'
                                    ? `/cantieri/${c.id}#${b.ancora}`
                                    : href
                                }
                                className="hover:underline"
                                style={{ color: 'inherit' }}
                              >
                                {b.descrizione}
                              </a>
                            </li>
                          ))}
                          {voci.length > 4 ? (
                            <li style={{ color: 'var(--testo-fioco)' }}>
                              + altre {voci.length - 4}
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                      <Link
                        href={href}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition hover:brightness-110"
                        style={{
                          borderColor: 'rgba(217,164,65,0.45)',
                          background: 'rgba(217,164,65,0.12)',
                          color: 'var(--color-eco-gold-300)',
                        }}
                      >
                        Completa i documenti sul cantiere →
                      </Link>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}

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
                <dd>
                  {clienteDal
                    ? formattaData(clienteDal)
                    : '— (dopo la firma del preventivo)'}
                </dd>
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
                        <div
                          className="font-mono text-xs"
                          style={{ color: 'var(--testo-tenue)' }}
                        >
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
