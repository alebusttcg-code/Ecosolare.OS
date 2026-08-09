import Link from 'next/link'
import { LinkNome } from '@/components/link-nome'
import { Badge, Card, Intestazione, Vuoto, formattaData } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import { statoTelegramCorrente } from '@/lib/actions/telegram'
import { listFollowUpAperti, haFollowUpSuccessivo } from '@/lib/queries/follow-up'
import { CompletaAttivita } from '@/app/(app)/attivita/completa'
import { CollegamentoTelegram } from './telegram'

export const metadata = { title: 'Follow-up — EcoSolare OS' }

export default async function FollowUpPage() {
  const utente = await guard('read', 'activity')
  const [righe, telegram] = await Promise.all([
    listFollowUpAperti(utente),
    statoTelegramCorrente(),
  ])

  const conSuccessivo = await Promise.all(
    righe.map(async (r) => ({
      id: r.id,
      haSuccessivo: await haFollowUpSuccessivo(r.opportunityId, r.id),
    })),
  )
  const mappaSuccessivo = new Map(conSuccessivo.map((x) => [x.id, x.haSuccessivo]))

  const scaduti = righe.filter((r) => r.scaduta).length

  return (
    <div className="space-y-6">
      <Intestazione
        titolo="Follow-up"
        sottotitolo={
          scaduti > 0
            ? `${righe.length} aperti · ${scaduti} in ritardo — non lasciare raffreddare i lead`
            : `${righe.length} aperti — sequenze pre e post sopralluogo`
        }
      />

      <Card title="Reminder Telegram">
        <CollegamentoTelegram statoIniziale={telegram} />
      </Card>

      <Card>
        {righe.length === 0 ? (
          <Vuoto messaggio="Nessun follow-up in coda. Si creano all’acquisizione del lead e alla chiusura del sopralluogo." />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
            {righe.map((r) => {
              const richiedeProssima = r.isNextAction && !mappaSuccessivo.get(r.id)
              return (
                <li key={r.id} className="riga rounded-md py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <LinkNome href={`/lead/${r.opportunityId}`} className="text-sm font-medium">
                          {r.clienteNome}
                        </LinkNome>
                        <Badge tone={r.phase === 'pre_sopralluogo' ? 'attenzione' : 'blu'}>
                          {r.phaseLabel} · {r.step}/2
                        </Badge>
                        {r.isNextAction ? <Badge tone="positivo">Prossima azione</Badge> : null}
                      </div>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                        {r.subject}
                        {' · '}
                        <Link
                          href={`/lead/${r.opportunityId}`}
                          className="text-eco-blue-300 hover:underline collega"
                        >
                          {r.opportunityCode}
                        </Link>
                        {utente.role !== 'commerciale' ? ` · ${r.commerciale}` : ''}
                      </div>
                      <div className="mt-2">
                        <CompletaAttivita
                          activityId={r.id}
                          richiedeProssima={richiedeProssima}
                        />
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {r.scaduta ? (
                        <Badge tone="critico">Scaduto {formattaData(r.dueAt)}</Badge>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                          {formattaData(r.dueAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
