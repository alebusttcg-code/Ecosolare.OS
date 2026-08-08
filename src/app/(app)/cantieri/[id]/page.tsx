import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge, Card, Vuoto, formattaData, formattaEuro } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import type { StatoPianificabilita } from '@/lib/domain/readiness'
import { getProjectDetail } from '@/lib/queries/projects'
import { CaricaDocumento } from './carica'
import { OkAmministrativo } from './ok-amministrativo'
import {
  ControlloConferma,
  ControlloDocumento,
  ControlloMateriale,
  ControlloPagamento,
  ControlloPratica,
  ControlloTask,
} from './controlli'

export const metadata = { title: 'Cantieri e commesse — EcoSolare OS' }

const PIANIFICABILITA: Record<
  StatoPianificabilita,
  { testo: string; tono: 'positivo' | 'attenzione' | 'critico'; colore: string }
> = {
  pianificabile: { testo: 'Pianificabile', tono: 'positivo', colore: 'rgba(163,197,99,0.45)' },
  quasi_pianificabile: {
    testo: 'Quasi pianificabile',
    tono: 'attenzione',
    colore: 'rgba(217,164,65,0.45)',
  },
  non_pianificabile: {
    testo: 'Non pianificabile',
    tono: 'critico',
    colore: 'rgba(224,133,133,0.45)',
  },
}

export default async function CommessaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const utente = await guard('read', 'project')
  const { id } = await params

  const dati = await getProjectDetail(utente, id)
  if (!dati) notFound()

  const c = dati.commessa
  const stato = PIANIFICABILITA[c.readinessState as StatoPianificabilita]
  const cliente = [dati.clienteNome, dati.clienteCognome].filter(Boolean).join(' ')

  const taskFatti = dati.task.filter((t) => t.completedAt !== null).length
  const docApprovati = dati.documenti.filter((d) => d.status === 'approvato').length

  return (
    <div className="space-y-6">
      <div>
        <Link href="/cantieri" className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
          ← Cantieri e commesse
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
          <Badge tone={stato.tono}>{stato.testo}</Badge>
          <Badge tone="blu">{dati.stageLabel}</Badge>
        </div>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--testo-tenue)' }}>
          {c.code} ·{' '}
          <Link
            href={`/clienti/${dati.clienteId}`}
            className="collega"
            style={{ color: 'var(--color-eco-blue-300)' }}
          >
            {cliente}
          </Link>{' '}
          · contratto {dati.contractCode} del {formattaData(dati.signedAt)}
          {dati.sitoLabel ? ` · ${dati.sitoIndirizzo}, ${dati.sitoComune}` : ''}
        </p>
        <div className="mt-4 filetto barra-cresce" />
      </div>

      {/* Il pannello di pianificabilità sta in cima e per intero: è la domanda
          a cui il sistema esiste per rispondere. */}
      <section
        className="pannello rivela p-5"
        style={{ borderColor: stato.colore }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Pianificabilità</p>
            <p className="mt-1 text-lg font-semibold">{stato.testo}</p>
          </div>
          {c.blockedSince && dati.giorniDiBlocco !== null ? (
            <div className="text-right text-sm">
              <div style={{ color: 'var(--color-eco-gold-300)' }}>
                Ferma da {dati.giorniDiBlocco}{' '}
                {dati.giorniDiBlocco === 1 ? 'giorno' : 'giorni'}
              </div>
              <div className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
                dal {formattaData(c.blockedSince)}
              </div>
            </div>
          ) : null}
        </div>

        {dati.bloccanti.length === 0 && dati.avvisi.length === 0 ? (
          <p className="mt-4 text-sm" style={{ color: 'var(--color-eco-green-400)' }}>
            Nessun impedimento: il cantiere può essere pianificato.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {dati.bloccanti.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium" style={{ color: 'var(--color-eco-red-400)' }}>
                  Impedimenti bloccanti
                </p>
                <ul className="space-y-1.5">
                  {dati.bloccanti.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span style={{ color: 'var(--color-eco-red-400)' }}>▸</span>
                      <span className="flex-1">{b.descrizione}</span>
                      {b.da ? (
                        <span className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
                          da {formattaData(new Date(b.da))}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {dati.avvisi.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium" style={{ color: 'var(--color-eco-gold-300)' }}>
                  Da tenere d&apos;occhio
                </p>
                <ul className="space-y-1.5">
                  {dati.avvisi.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span style={{ color: 'var(--color-eco-gold-300)' }}>▸</span>
                      <span>{b.descrizione}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <div
          className="mt-5 flex flex-wrap gap-6 border-t pt-4"
          style={{ borderColor: 'var(--bordo-tenue)' }}
        >
          <ControlloConferma
            projectId={c.id}
            campo="verifica_tecnica"
            attivo={c.technicalCheckDoneAt !== null}
            etichetta="Verifica tecnica completata"
          />
          <ControlloConferma
            projectId={c.id}
            campo="conferma_cliente"
            attivo={c.clientConfirmedAt !== null}
            etichetta="Cliente ha confermato la data"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Documenti (${docApprovati}/${dati.documenti.length})`} indice={1}>
            {dati.documenti.length === 0 ? (
              <Vuoto messaggio="Nessun requisito documentale." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                {dati.documenti.map((d) => (
                  <li key={d.id} className="riga rounded-md py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span>{d.label}</span>
                        {d.mandatory ? null : <Badge>facoltativo</Badge>}
                        {d.providedByClient ? <Badge tone="blu">cliente</Badge> : null}
                      </div>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                        {d.dueAt ? `entro ${formattaData(d.dueAt)}` : 'senza scadenza'}
                        {d.rejectionReason ? ` · respinto: ${d.rejectionReason}` : ''}
                      </div>
                    </div>
                    <ControlloDocumento requirementId={d.id} stato={d.status} />
                    </div>
                    <CaricaDocumento requirementId={d.id} files={d.files} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Materiali" indice={2}>
            {dati.materiali.length === 0 ? (
              <Vuoto messaggio="Nessun materiale in distinta." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                {dati.materiali.map((m) => (
                  <li
                    key={m.id}
                    className="riga flex items-center justify-between gap-4 rounded-md py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm">{m.description}</div>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                        {Number.parseFloat(m.quantityPlanned).toLocaleString('it-IT')} {m.unit}
                        {utente.canViewCosts && m.estimatedUnitCost
                          ? ` · costo previsto ${formattaEuro(m.estimatedUnitCost)}/${m.unit}`
                          : ''}
                      </div>
                    </div>
                    <ControlloMateriale
                      materialId={m.id}
                      stato={m.status}
                      critico={m.critical}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Pratiche" indice={3}>
            {dati.pratiche.length === 0 ? (
              <Vuoto messaggio="Nessuna pratica associata." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                {dati.pratiche.map((p) => (
                  <li
                    key={p.id}
                    className="riga flex items-center justify-between gap-4 rounded-md py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <span>{p.label}</span>
                        {p.blocking ? <Badge tone="attenzione">bloccante</Badge> : null}
                      </div>
                      {p.referenceNumber ? (
                        <div className="mt-0.5 font-mono text-xs" style={{ color: 'var(--testo-fioco)' }}>
                          {p.referenceNumber}
                        </div>
                      ) : null}
                    </div>
                    <ControlloPratica practiceId={p.id} stato={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={`Attività (${taskFatti}/${dati.task.length})`} indice={1}>
            {dati.task.length === 0 ? (
              <Vuoto messaggio="Nessuna attività." />
            ) : (
              <ul className="space-y-3">
                {dati.task.map((t) => (
                  <li key={t.id}>
                    <ControlloTask
                      taskId={t.id}
                      completato={t.completedAt !== null}
                      etichetta={t.label}
                    />
                    {t.dueAt && t.completedAt === null ? (
                      <span
                        className="ml-6 text-xs"
                        style={{
                          color: t.inRitardo
                            ? 'var(--color-eco-gold-300)'
                            : 'var(--testo-fioco)',
                        }}
                      >
                        entro {formattaData(t.dueAt)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Piano pagamenti" indice={2}>
            {dati.pagamenti.length === 0 ? (
              <Vuoto messaggio="Nessuna scadenza." />
            ) : (
              <ul className="space-y-3">
                {dati.pagamenti.map((p) => (
                  <li key={p.id}>
                    <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{p.label}</div>
                      <div className="text-xs tabular-nums" style={{ color: 'var(--testo-fioco)' }}>
                        {formattaEuro(p.amountNet)}
                        {p.blocksStart ? ' · blocca la partenza' : ''}
                      </div>
                    </div>
                    <ControlloPagamento milestoneId={p.id} stato={p.status} />
                    </div>
                    {p.blocksStart ? (
                      <OkAmministrativo
                        milestoneId={p.id}
                        concessoIl={p.adminOkAt}
                        concessoDa={p.concessoDa}
                        contabili={p.contabili}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {utente.canViewCosts ? (
            <Card title="Economia prevista" accento="oro" indice={3}>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt style={{ color: 'var(--testo-tenue)' }}>Ricavo</dt>
                  <dd className="tabular-nums">{formattaEuro(c.revenueNet)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt style={{ color: 'var(--testo-tenue)' }}>Costo previsto</dt>
                  <dd className="tabular-nums">{formattaEuro(c.estimatedCost)}</dd>
                </div>
                <div
                  className="flex justify-between border-t pt-2.5 font-semibold"
                  style={{ borderColor: 'var(--bordo-tenue)' }}
                >
                  <dt>Margine previsto</dt>
                  <dd className="tabular-nums">{formattaEuro(c.estimatedMargin)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                Il margine reale richiede ore e costi di cantiere: arriva con le Fasi 4 e 5.
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
