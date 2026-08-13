import Link from 'next/link'
import { LinkNome } from '@/components/link-nome'
import { Badge, Card, Intestazione, Vuoto, formattaData } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import {
  contaScadute,
  listDaFare,
  puoVedereAltrui,
  type FiltroPersone,
  type FiltroTipo,
} from '@/lib/queries/da-fare'
import { statoTelegramCorrente } from '@/lib/actions/telegram'
import { CompletaAttivita } from './completa'
import { CollegamentoTelegram } from '../follow-up/telegram'

export const metadata = { title: 'Da fare — EcoSolare OS' }

const ETICHETTA_TIPO: Record<string, string> = {
  chiamata: 'Chiamata',
  email: 'Email',
  whatsapp: 'WhatsApp',
  appuntamento: 'Appuntamento',
  sopralluogo: 'Sopralluogo',
  task: 'Attività',
  nota: 'Nota',
}

const FILTRI_TIPO: readonly { valore: FiltroTipo; etichetta: string }[] = [
  { valore: 'tutte', etichetta: 'Tutte' },
  { valore: 'follow_up', etichetta: 'Follow-up' },
  { valore: 'personale', etichetta: 'Personali' },
]

function leggiTipo(valore: string | undefined): FiltroTipo {
  return valore === 'follow_up' || valore === 'personale' ? valore : 'tutte'
}

function leggiPersone(valore: string | undefined): FiltroPersone {
  return valore === 'tutte' ? 'tutte' : 'mie'
}

/** Un filtro è un collegamento, non uno stato: resta condivisibile e ricaricabile. */
function Filtro({
  attivo,
  href,
  children,
}: {
  attivo: boolean
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border px-3 py-1.5 text-xs"
      style={{
        borderColor: attivo ? 'var(--color-eco-gold-400)' : 'var(--bordo)',
        color: attivo ? 'var(--color-eco-gold-400)' : 'var(--testo-fioco)',
      }}
    >
      {children}
    </Link>
  )
}

export default async function DaFarePage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; persone?: string }>
}) {
  const utente = await guard('read', 'activity')
  const params = await searchParams
  const tipo = leggiTipo(params.tipo)
  const persone = leggiPersone(params.persone)

  const [righe, telegram] = await Promise.all([
    listDaFare(utente, { tipo, persone }),
    statoTelegramCorrente(),
  ])
  const scadute = contaScadute(righe)
  const vedeAltrui = puoVedereAltrui(utente.role)

  const collegamento = (nuovi: { tipo?: FiltroTipo; persone?: FiltroPersone }) => {
    const query = new URLSearchParams()
    const t = nuovi.tipo ?? tipo
    const p = nuovi.persone ?? persone
    if (t !== 'tutte') query.set('tipo', t)
    if (p !== 'mie') query.set('persone', p)
    const stringa = query.toString()
    return stringa ? `/attivita?${stringa}` : '/attivita'
  }

  return (
    <div className="space-y-6">
      <Intestazione
        titolo="Da fare"
        sottotitolo={
          scadute > 0
            ? `${righe.length} aperte · ${scadute} in ritardo — non lasciare raffreddare i lead`
            : `${righe.length} aperte · follow-up commerciali e scadenze personali`
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {FILTRI_TIPO.map((filtro) => (
          <Filtro
            key={filtro.valore}
            attivo={tipo === filtro.valore}
            href={collegamento({ tipo: filtro.valore })}
          >
            {filtro.etichetta}
          </Filtro>
        ))}

        {vedeAltrui ? (
          <>
            <span className="mx-1" style={{ color: 'var(--bordo)' }}>
              |
            </span>
            <Filtro attivo={persone === 'mie'} href={collegamento({ persone: 'mie' })}>
              Le mie
            </Filtro>
            <Filtro
              attivo={persone === 'tutte'}
              href={collegamento({ persone: 'tutte' })}
            >
              Di tutti
            </Filtro>
          </>
        ) : null}
      </div>

      {tipo !== 'personale' ? (
        <Card title="Reminder Telegram">
          <CollegamentoTelegram statoIniziale={telegram} />
        </Card>
      ) : null}

      <Card>
        {righe.length === 0 ? (
          <Vuoto
            messaggio={
              tipo === 'follow_up'
                ? 'Nessun follow-up in coda. Si creano all’acquisizione del lead e alla chiusura del sopralluogo.'
                : 'Niente da fare. Buon segno.'
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
            {righe.map((voce) => (
              <li key={voce.id} className="riga rounded-md py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {voce.opportunityId && voce.clienteNome ? (
                        <LinkNome
                          href={`/lead/${voce.opportunityId}`}
                          className="text-sm font-medium"
                        >
                          {voce.clienteNome}
                        </LinkNome>
                      ) : (
                        <span className="text-sm font-medium">{voce.subject}</span>
                      )}
                      {voce.faseLabel ? (
                        <Badge tone={voce.fase === 'pre_sopralluogo' ? 'attenzione' : 'blu'}>
                          {voce.faseLabel} · {voce.step}/2
                        </Badge>
                      ) : null}
                      {voce.isNextAction ? <Badge tone="positivo">Prossima azione</Badge> : null}
                    </div>

                    <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                      {voce.opportunityId && voce.clienteNome ? `${voce.subject} · ` : ''}
                      {voce.tipo === 'personale'
                        ? (ETICHETTA_TIPO[voce.kind] ?? voce.kind)
                        : 'Follow-up'}
                      {voce.opportunityId ? (
                        <>
                          {' · '}
                          <Link
                            href={`/lead/${voce.opportunityId}`}
                            className="text-eco-blue-300 hover:underline collega"
                          >
                            {voce.opportunityCode}
                          </Link>
                        </>
                      ) : null}
                      {persone === 'tutte' && vedeAltrui ? ` · ${voce.assegnatario}` : ''}
                    </div>

                    <div className="mt-2">
                      <CompletaAttivita
                        activityId={voce.id}
                        richiedeProssima={voce.isNextAction && voce.opportunityId !== null}
                      />
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {voce.scaduta ? (
                      <Badge tone={voce.tipo === 'follow_up' ? 'critico' : 'attenzione'}>
                        Scaduta {formattaData(voce.dueAt)}
                      </Badge>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                        {formattaData(voce.dueAt)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
