import { and, desc, eq, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BottoneChiama, BottoneWhatsApp } from '@/components/bottoni-contatto'
import { LinkNome, nomePersona } from '@/components/link-nome'
import { Badge, Card, Vuoto, formattaData } from '@/components/ui'
import { getDb } from '@/db'
import {
  activities,
  contacts,
  opportunities,
  opportunityStatusHistory,
  sites,
  surveyTemplates,
  surveys,
  users,
} from '@/db/schema'
import { guard } from '@/lib/auth/session'
import {
  arricchisciDefinizionePrequalifica,
  risposteDaLead,
  unisciRispostePrequalifica,
} from '@/lib/domain/prequalifica-lead'
import { listFollowUpLead } from '@/lib/queries/follow-up'
import { getStages } from '@/lib/queries/pipeline'
import { getQuotesForOpportunity } from '@/lib/queries/quotes'
import { correggiDefinizioneQuestionario } from '@/lib/domain/etichette-ui'
import type { DefinizioneQuestionario, Risposte } from '@/lib/domain/questionnaire'
import { unoAllaVolta } from '@/lib/uno-alla-volta'
import { CambiaStato } from './cambia-stato'
import { NuovoPreventivo } from './nuovo-preventivo'
import { NuovoSopralluogo } from './nuovo-sopralluogo'
import { Prequalifica } from './prequalifica'

export const metadata = { title: 'Lead — EcoSolare OS' }

export default async function DettaglioLeadPage({
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
      clienteTelefono: contacts.phone,
      clienteTelefonoE164: contacts.phoneE164,
      clienteAziendaId: contacts.companyId,
      sitoIndirizzo: sites.addressLine,
      sitoComune: sites.city,
      sitoProvincia: sites.province,
      sitoCap: sites.postalCode,
      sitoTipoEdificio: sites.buildingType,
      proprietario: users.name,
      proprietarioEmail: users.email,
    })
    .from(opportunities)
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .leftJoin(sites, eq(sites.id, opportunities.siteId))
    .leftJoin(users, eq(users.id, opportunities.ownerId))
    .where(and(eq(opportunities.id, id), isNull(opportunities.deletedAt)))
    .limit(1)

  if (!riga) notFound()

  const [stages, storico, attivitaAperte, preventivi, sopralluoghi, followUp, templatePrequalifica] =
    await unoAllaVolta([
      () => getStages(),
      () =>
        db
          .select()
          .from(opportunityStatusHistory)
          .where(eq(opportunityStatusHistory.opportunityId, id))
          .orderBy(desc(opportunityStatusHistory.changedAt)),
      () =>
        db
          .select()
          .from(activities)
          .where(and(eq(activities.opportunityId, id), eq(activities.isNextAction, true)))
          .limit(1),
      () => getQuotesForOpportunity(id),
      () =>
        db
          .select({
            id: surveys.id,
            status: surveys.status,
            completedAt: surveys.completedAt,
            hasCriticalIssues: surveys.hasCriticalIssues,
            estimatedPowerKw: surveys.estimatedPowerKw,
            templateName: surveyTemplates.name,
          })
          .from(surveys)
          .innerJoin(surveyTemplates, eq(surveyTemplates.id, surveys.templateId))
          .where(eq(surveys.opportunityId, id))
          .orderBy(desc(surveys.createdAt)),
      () => listFollowUpLead(id),
      () =>
        db.query.surveyTemplates.findFirst({
          where: and(
            eq(surveyTemplates.kind, 'prequalifica'),
            eq(surveyTemplates.isActive, true),
          ),
          orderBy: desc(surveyTemplates.version),
        }),
    ])

  const opp = riga.opp
  const definizionePrequalifica = templatePrequalifica
    ? correggiDefinizioneQuestionario(
        arricchisciDefinizionePrequalifica(
          templatePrequalifica.definition as DefinizioneQuestionario,
        ),
      )
    : null
  const rispostePrequalifica = unisciRispostePrequalifica(
    risposteDaLead({
      addressLine: riga.sitoIndirizzo,
      city: riga.sitoComune,
      province: riga.sitoProvincia,
      postalCode: riga.sitoCap,
      buildingType: riga.sitoTipoEdificio,
      haAzienda: Boolean(riga.clienteAziendaId),
    }),
    (opp.prequalification ?? {}) as Risposte,
  )
  const stato = stages.find((s) => s.code === opp.stage)
  const etichetta = (code: string | null) =>
    code ? (stages.find((s) => s.code === code)?.label ?? code) : '—'
  const prossima = attivitaAperte[0]

  return (
    <div className="space-y-6">
      <div>
        <Link href="/lead" className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
          ← Lead
        </Link>
        <div className="mt-1 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                <LinkNome href={`/clienti/${riga.clienteId}`} hero>
                  {nomePersona(riga.clienteNome, riga.clienteCognome) || 'Senza nome'}
                </LinkNome>
              </h1>
              <Badge tone={stato?.isLost ? 'critico' : stato?.isWon ? 'positivo' : 'neutro'}>
                {stato?.label ?? opp.stage}
              </Badge>
            </div>
            <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
              {opp.title} · {opp.code} · {opp.businessLine}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {riga.clienteTelefono ? (
              <BottoneChiama
                telefono={riga.clienteTelefono}
                telefonoE164={riga.clienteTelefonoE164}
              />
            ) : null}
            {riga.clienteTelefonoE164 ? (
              <BottoneWhatsApp telefonoE164={riga.clienteTelefonoE164} />
            ) : null}
            <Link
              href={`/lead/${opp.id}/modifica`}
              className="bottone-fantasma rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--bordo)' }}
            >
              Modifica
            </Link>
          </div>
        </div>
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
                <Link href="/attivita" className="text-xs text-eco-blue-300 hover:underline collega">
                  Vai alle mie attività
                </Link>
              </div>
            ) : stato?.isOpen ? (
              <p className="text-sm text-eco-red-400">
                Nessuna prossima azione su un lead aperto: è un’anomalia da
                correggere subito.
              </p>
            ) : (
              <Vuoto messaggio="Lead chiuso: nessuna azione in sospeso." />
            )}
          </Card>

          {followUp.length > 0 ? (
            <Card
              title="Follow-up"
              action={
                <Link href="/follow-up" className="text-xs text-eco-blue-300 hover:underline collega">
                  Tutti i follow-up
                </Link>
              }
            >
              <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                {followUp.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className={f.completedAt ? 'line-through opacity-60' : ''}>
                          {f.subject}
                        </span>
                        <Badge tone={f.phase === 'pre_sopralluogo' ? 'attenzione' : 'blu'}>
                          {f.phaseLabel} · {f.step}/2
                        </Badge>
                        {f.isNextAction && !f.completedAt ? (
                          <Badge tone="positivo">Prossima</Badge>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                        {f.completedAt
                          ? `Chiuso ${formattaData(f.completedAt)}${f.outcome ? ` · ${f.outcome}` : ''}`
                          : `Scade ${formattaData(f.dueAt)}`}
                      </div>
                      {f.notes ? (
                        <p className="mt-1 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                          {f.notes}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {templatePrequalifica && definizionePrequalifica ? (
            <Card title="Prequalifica">
              <Prequalifica
                opportunityId={opp.id}
                templateId={templatePrequalifica.id}
                definizione={definizionePrequalifica}
                risposteIniziali={rispostePrequalifica}
                punteggioSalvato={
                  opp.score !== null && opp.scoreMax !== null
                    ? { punteggio: opp.score, massimo: opp.scoreMax }
                    : null
                }
              />
            </Card>
          ) : null}

          <Card
            title="Sopralluoghi"
            action={<NuovoSopralluogo opportunityId={opp.id} />}
          >
            {sopralluoghi.length === 0 ? (
              <Vuoto messaggio="Nessun sopralluogo per questo lead." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                {sopralluoghi.map((s) => (
                  <li
                    key={s.id}
                    className="riga flex items-center justify-between gap-4 rounded-md py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <Link
                        href={`/agenda/${s.id}`}
                        className="text-sm font-medium text-eco-blue-300 hover:underline collega"
                      >
                        {s.templateName}
                      </Link>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                        {s.status === 'completato'
                          ? `completato il ${formattaData(s.completedAt)}`
                          : 'in compilazione'}
                        {s.estimatedPowerKw ? ` · ${s.estimatedPowerKw} kWp` : ''}
                      </div>
                    </div>
                    {s.hasCriticalIssues ? <Badge tone="attenzione">Criticità</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Preventivi"
            action={
              <NuovoPreventivo opportunityId={opp.id} titoloProposto={opp.title} />
            }
          >
            {preventivi.length === 0 ? (
              <Vuoto messaggio="Nessun preventivo per questo lead." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                {preventivi.map((p) => (
                  <li
                    key={p.id}
                    className="riga flex items-center justify-between gap-4 rounded-md py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      {p.versionId ? (
                        <Link
                          href={`/preventivi/${p.versionId}`}
                          className="text-sm font-medium text-eco-blue-300 hover:underline collega"
                        >
                          {p.title}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium">{p.title}</span>
                      )}
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                        {p.code}
                        {p.versionNo ? ` · v${p.versionNo}` : ''}
                        {p.status ? ` · ${p.status}` : ''}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="tabular-nums">{p.grossTotal ?? '—'} €</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Storico degli stati">
            {storico.length === 0 ? (
              <Vuoto messaggio="Nessun cambio di stato registrato." />
            ) : (
              <ul className="divide-y text-sm" style={{ borderColor: 'var(--bordo)' }}>
                {storico.map((s) => (
                  <li key={s.id} className="riga flex items-center justify-between gap-4 rounded-md py-2.5 first:pt-0 last:pb-0">
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
                  Probabilità
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
                  Prima risposta al contatto
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
