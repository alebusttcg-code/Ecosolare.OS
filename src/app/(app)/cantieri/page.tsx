import Link from 'next/link'
import { Badge, Card, Intestazione, Stat, Vuoto, formattaData, formattaEuro } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import type { StatoPianificabilita } from '@/lib/domain/readiness'
import { etichettaStatoWorkOrder } from '@/lib/domain/schedule'
import { listProjects } from '@/lib/queries/projects'
import { mappaPianificazioniAttive } from '@/lib/queries/schedule'
import { FiltroStato, leggiStatoCantieri } from './filtro-stato'

export const metadata = { title: 'Cantieri — EcoSolare OS' }

const PIANIFICABILITA: Record<
  StatoPianificabilita,
  { testo: string; tono: 'positivo' | 'attenzione' | 'critico' }
> = {
  pianificabile: { testo: 'Pianificabile', tono: 'positivo' },
  quasi_pianificabile: { testo: 'Quasi pianificabile', tono: 'attenzione' },
  non_pianificabile: { testo: 'Non pianificabile', tono: 'critico' },
}

/**
 * I cantieri, aperti e chiusi.
 *
 * Erano due voci di menu per lo stesso oggetto: «Cantieri» leggeva le commesse
 * attive e «Lavori completati» le stesse commesse con `closedAt` valorizzato —
 * `listProjects(utente, 'attive' | 'completate')`, la stessa query con un
 * argomento diverso. Il sottotitolo lo confessava da solo: «i lavori chiusi
 * sono in Lavori completati».
 *
 * Un cantiere chiuso non è un altro oggetto: è lo stesso cantiere, dopo. Qui è
 * un filtro, come deve essere.
 */
export default async function CommessePage({
  searchParams,
}: {
  searchParams: Promise<{ stato?: string }>
}) {
  const utente = await guard('read', 'project')
  const stato = leggiStatoCantieri((await searchParams).stato)
  const chiusi = stato === 'completati'

  const righe = await listProjects(utente, chiusi ? 'completate' : 'attive')
  const pianificazioni = chiusi
    ? new Map()
    : await mappaPianificazioniAttive(righe.map((r) => r.id))

  const pianificabili = righe.filter((r) => r.readinessState === 'pianificabile').length
  const bloccate = righe.filter((r) => r.readinessState === 'non_pianificabile').length
  const giorniPeggiori = Math.max(0, ...righe.map((r) => r.giorniDiBlocco ?? 0))

  return (
    <div>
      <Intestazione
        titolo="Cantieri"
        sottotitolo={
          chiusi
            ? `${righe.length} ${righe.length === 1 ? 'lavoro chiuso' : 'lavori chiusi'} · contratto, documenti e pagamenti restano qui`
            : `${righe.length} ${righe.length === 1 ? 'cantiere aperto' : 'cantieri aperti'}`
        }
        azione={
          <Link
            href="/cantieri/agenda"
            className="bottone-fantasma rounded-lg border px-4 py-2 text-sm font-medium"
            style={{ borderColor: 'var(--bordo)' }}
          >
            Calendario cantieri
          </Link>
        }
      />

      <FiltroStato attivo={stato} />

      {chiusi ? null : (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Cantieri attivi" value={righe.length} icona="◫" indice={0} />
        <Stat
          label="Pianificabili"
          value={pianificabili}
          tone={pianificabili > 0 ? 'positivo' : 'neutro'}
          icona="✓"
          indice={1}
        />
        <Stat
          label="Bloccate"
          value={bloccate}
          tone={bloccate > 0 ? 'critico' : 'positivo'}
          icona="!"
          indice={2}
        />
        <Stat
          label="Blocco più lungo"
          value={giorniPeggiori}
          tone={giorniPeggiori > 7 ? 'attenzione' : 'neutro'}
          hint="giorni"
          icona="◷"
          indice={3}
        />
      </div>
      )}

      <div className="mt-8">
        <Card indice={1}>
          {righe.length === 0 ? (
            <Vuoto
              messaggio={
                chiusi
                  ? 'Nessun lavoro chiuso. Quando una commessa passa allo stato «Chiusa», compare qui.'
                  : 'Nessuna commessa. Si aprono registrando la firma di un preventivo inviato.'
              }
            />
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
              {righe.map((r) => {
                const stato = PIANIFICABILITA[r.readinessState]
                const piano = pianificazioni.get(r.id)

                return (
                  <li key={r.id} className="first:pt-0 last:pb-0">
                    <Link
                      href={`/cantieri/${r.id}`}
                      className="riga group block rounded-md py-4 outline-none focus-visible:ring-2 focus-visible:ring-[rgba(91,155,213,0.45)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-eco-blue-300 transition-colors group-hover:text-eco-gold-300">
                            {r.cliente}
                          </div>
                          <div
                            className="mt-0.5 text-xs"
                            style={{ color: 'var(--testo-fioco)' }}
                          >
                            {r.title}
                            {' · '}
                            {r.code} · {r.stageLabel}
                            {r.responsabile ? ` · ${r.responsabile}` : ''}
                          </div>
                          {piano ? (
                            <div
                              className="mt-1 text-xs"
                              style={{
                                color:
                                  piano.status === 'in_corso'
                                    ? 'var(--color-eco-gold-300)'
                                    : 'var(--color-eco-green-400)',
                              }}
                            >
                              {formattaData(piano.scheduledOn)} · {piano.operaiLabel}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-sm tabular-nums">
                            {formattaEuro(r.revenueNet)}
                          </span>
                          {piano ? (
                            <Badge
                              tone={piano.status === 'in_corso' ? 'attenzione' : 'positivo'}
                            >
                              {etichettaStatoWorkOrder(piano.status)}
                            </Badge>
                          ) : (
                            <Badge tone={stato.tono}>{stato.testo}</Badge>
                          )}
                        </div>
                      </div>

                      {/* Il motivo del blocco accanto alla commessa, non dentro una
                          scheda da aprire: è la differenza fra sapere e dover cercare. */}
                      {r.bloccanti.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {r.bloccanti.slice(0, 3).map((b, i) => (
                            <li
                              key={`${b.tipo}-${i}`}
                              className="flex items-center gap-2 text-xs"
                              style={{ color: 'var(--testo-tenue)' }}
                            >
                              <span style={{ color: 'var(--color-eco-red-400)' }}>▸</span>
                              {b.descrizione}
                            </li>
                          ))}
                          {r.bloccanti.length > 3 ? (
                            <li className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
                              e altri {r.bloccanti.length - 3}
                            </li>
                          ) : null}
                        </ul>
                      ) : null}

                      {r.giorniDiBlocco !== null && r.giorniDiBlocco > 0 ? (
                        <p
                          className="mt-2 text-xs"
                          style={{ color: 'var(--color-eco-gold-300)' }}
                        >
                          Ferma da {r.giorniDiBlocco}{' '}
                          {r.giorniDiBlocco === 1 ? 'giorno' : 'giorni'}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
