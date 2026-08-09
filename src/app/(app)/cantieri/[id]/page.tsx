import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LinkNome } from '@/components/link-nome'
import { PannelloCollassabile } from '@/components/pannello-collassabile'
import { Badge, Card, Vuoto, formattaData, formattaEuro } from '@/components/ui'
import { can } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import {
  ancoraDiBlocco,
  type Blocco,
  type StatoPianificabilita,
} from '@/lib/domain/readiness'
import { getProjectDetail } from '@/lib/queries/projects'
import { getWorkOrderAttivo, listWorkers } from '@/lib/queries/schedule'
import { CaricaDocumento } from './carica'
import { OkAmministrativo } from './ok-amministrativo'
import { PannelloPianificazione } from './pianifica'
import {
  ControlloConferma,
  ControlloDocumento,
  ControlloMateriale,
  ControlloPagamento,
  ControlloPratica,
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

  const [workOrder, operai] = await Promise.all([
    getWorkOrderAttivo(id),
    can(utente, 'read', 'schedule') ? listWorkers() : Promise.resolve([]),
  ])

  const c = dati.commessa
  const stato = PIANIFICABILITA[c.readinessState as StatoPianificabilita]
  const cliente = [dati.clienteNome, dati.clienteCognome].filter(Boolean).join(' ')

  const docApprovati = dati.documenti.filter((d) => d.status === 'approvato').length
  const puoPianificare = can(utente, 'create', 'schedule')

  return (
    <div className="space-y-6">
      <div>
        <Link href="/cantieri" className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
          ← Cantieri e commesse
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            <LinkNome href={`/clienti/${dati.clienteId}`} hero>
              {cliente || 'Senza nome'}
            </LinkNome>
          </h1>
          <Badge tone={stato.tono}>{stato.testo}</Badge>
          <Badge tone="blu">{dati.stageLabel}</Badge>
        </div>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--testo-tenue)' }}>
          {c.title} · {c.code} · contratto {dati.contractCode} del{' '}
          {formattaData(dati.signedAt)}
          {dati.sitoLabel ? ` · ${dati.sitoIndirizzo}, ${dati.sitoComune}` : ''}
          {c.plannedStartAt ? ` · installazione ${formattaData(c.plannedStartAt)}` : ''}
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
                    <VocePianificabilita
                      key={i}
                      blocco={b}
                      tono="critico"
                      documenti={dati.documenti}
                      materiali={dati.materiali}
                      pratiche={dati.pratiche}
                    />
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
                    <VocePianificabilita
                      key={i}
                      blocco={b}
                      tono="attenzione"
                      documenti={dati.documenti}
                      materiali={dati.materiali}
                      pratiche={dati.pratiche}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <div
          id="conferme"
          className="ancora-destinazione mt-5 flex scroll-mt-24 flex-wrap gap-6 border-t pt-4"
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
            dataConcordata={c.plannedStartAt}
          />
        </div>
      </section>

      <Card
        id="pianificazione"
        title="Pianificazione cantiere"
        accento={workOrder ? 'verde' : c.readinessState === 'pianificabile' ? 'oro' : 'neutro'}
        indice={0}
      >
        <PannelloPianificazione
          projectId={c.id}
          readinessPianificabile={c.readinessState === 'pianificabile'}
          plannedStartAt={c.plannedStartAt}
          workOrder={workOrder}
          operai={operai}
          puoScrivere={puoPianificare}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PannelloCollassabile
            id="documenti"
            title={`Documenti (${docApprovati}/${dati.documenti.length})`}
            prefissoAncora="documento"
            indice={1}
          >
            {dati.documenti.length === 0 ? (
              <Vuoto messaggio="Nessun requisito documentale." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                {dati.documenti.map((d) => (
                  <li
                    key={d.id}
                    id={`documento-${d.code}`}
                    className="ancora-destinazione riga scroll-mt-24 rounded-md py-3 first:pt-0 last:pb-0"
                  >
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
          </PannelloCollassabile>

          <Card id="materiali" title="Materiali" indice={2}>
            {dati.materiali.length === 0 ? (
              <Vuoto messaggio="Nessun materiale in distinta." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                {dati.materiali.map((m) => (
                  <li
                    key={m.id}
                    id={`materiale-${m.id}`}
                    className="ancora-destinazione riga flex scroll-mt-24 items-center justify-between gap-4 rounded-md py-3 first:pt-0 last:pb-0"
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

          <Card id="pratiche" title="Pratiche" indice={3}>
            {dati.pratiche.length === 0 ? (
              <Vuoto messaggio="Nessuna pratica associata." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                {dati.pratiche.map((p) => (
                  <li
                    key={p.id}
                    id={`pratica-${p.id}`}
                    className="ancora-destinazione riga flex scroll-mt-24 items-center justify-between gap-4 rounded-md py-3 first:pt-0 last:pb-0"
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
          <Card id="piano-pagamenti" title="Piano pagamenti" indice={1}>
            {dati.pagamenti.length === 0 ? (
              <Vuoto messaggio="Nessuna scadenza." />
            ) : (
              <ul className="space-y-3">
                {dati.pagamenti.map((p) => (
                  <li
                    key={p.id}
                    className={
                      p.blocksStart
                        ? 'ancora-destinazione scroll-mt-24 rounded-md'
                        : undefined
                    }
                  >
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
            <Card title="Economia prevista" accento="oro" indice={2}>
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
                Qui vedi il previsto da preventivo. Il margine reale arriverà quando
                registreremo ore di cantiere, costi effettivi e consuntivo.
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function VocePianificabilita({
  blocco,
  tono,
  documenti,
  materiali,
  pratiche,
}: {
  blocco: Blocco
  tono: 'critico' | 'attenzione'
  documenti: readonly { readonly code: string; readonly label: string }[]
  materiali: readonly { readonly id: string; readonly description: string }[]
  pratiche: readonly { readonly id: string; readonly label: string }[]
}) {
  const ancora = risolviAncora(blocco, documenti, materiali, pratiche)
  const colore =
    tono === 'critico' ? 'var(--color-eco-red-400)' : 'var(--color-eco-gold-300)'

  return (
    <li className="flex items-start gap-2 text-sm">
      <span aria-hidden style={{ color: colore }}>
        ▸
      </span>
      <a
        href={`#${ancora}`}
        className="flex-1 rounded-sm transition-colors hover:underline focus-visible:underline"
        style={{ color: 'inherit' }}
        title="Vai alla sezione"
      >
        {blocco.descrizione}
      </a>
      {blocco.da ? (
        <span className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
          da {formattaData(new Date(blocco.da))}
        </span>
      ) : null}
    </li>
  )
}

/** Preferisce l’ancora salvata; altrimenti ricostruisce dalla riga corrente. */
function risolviAncora(
  blocco: Blocco,
  documenti: readonly { readonly code: string; readonly label: string }[],
  materiali: readonly { readonly id: string; readonly description: string }[],
  pratiche: readonly { readonly id: string; readonly label: string }[],
): string {
  const salvata = blocco.ancora
  if (
    salvata === 'conferme' ||
    salvata === 'piano-pagamenti' ||
    (salvata && /^(documento|materiale|pratica)-/.test(salvata))
  ) {
    return salvata
  }

  if (blocco.tipo === 'documento') {
    const doc = documenti.find((d) => blocco.descrizione.includes(d.label))
    if (doc) return `documento-${doc.code}`
  }
  if (blocco.tipo === 'materiale') {
    const mat = materiali.find((m) => blocco.descrizione.includes(m.description))
    if (mat) return `materiale-${mat.id}`
  }
  if (blocco.tipo === 'pratica') {
    const pratica = pratiche.find((p) => blocco.descrizione.includes(p.label))
    if (pratica) return `pratica-${pratica.id}`
  }

  return ancoraDiBlocco(blocco)
}
