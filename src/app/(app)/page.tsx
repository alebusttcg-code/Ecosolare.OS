import Link from 'next/link'
import { Badge, Card, Intestazione, Stat, Vuoto, ritardo } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import { contaAttivitaScadute, getDashboard } from '@/lib/queries/dashboard'

export const metadata = { title: 'Dashboard — EcoSolare OS' }

/** Saluto secondo l'ora italiana: è la prima riga che si legge ogni mattina. */
function saluto(): string {
  const ora = Number(
    new Intl.DateTimeFormat('it-IT', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Europe/Rome',
    }).format(new Date()),
  )
  if (ora >= 5 && ora < 13) return 'Buongiorno'
  if (ora < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

function dataEstesa(): string {
  const testo = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Rome',
  }).format(new Date())
  return testo.charAt(0).toUpperCase() + testo.slice(1)
}

export default async function DashboardPage() {
  // Anche la dashboard passa dal guard (ADR-006): il layout autentica,
  // ma l'autorizzazione sulla risorsa si verifica qui.
  const utente = await guard('read', 'dashboard')

  const [dati, mieScadute] = await Promise.all([
    getDashboard(),
    contaAttivitaScadute(utente.id),
  ])

  const massimo = Math.max(1, ...dati.perStato.map((s) => s.totale))
  const nome = (utente.name ?? utente.email).split(/[\s@]/)[0]

  return (
    <div>
      <Intestazione
        eyebrow="Dashboard"
        titolo={`${saluto()}, ${nome}`}
        titoloOro
        sottotitolo={`${dataEstesa()} · lead, pipeline e attività in un colpo solo`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Lead aperti"
          value={dati.aperte}
          icona="◭"
          indice={0}
          href="/lead"
        />
        <Stat
          label="Valore in pipeline"
          value={Number.parseFloat(dati.valoreAperto ?? '0') || 0}
          formato="euro"
          icona="€"
          indice={1}
          href="/lead"
        />
        <Stat
          label="Prossime azioni scadute"
          value={dati.inRitardo}
          tone={dati.inRitardo > 0 ? 'attenzione' : 'positivo'}
          icona="!"
          hint={mieScadute > 0 ? `di cui tue: ${mieScadute}` : undefined}
          indice={2}
          href="/attivita"
        />
        <Stat
          label="Senza prossima azione"
          value={dati.senzaProssimaAzione}
          tone={dati.senzaProssimaAzione > 0 ? 'critico' : 'positivo'}
          icona="◇"
          hint="deve essere sempre zero"
          indice={3}
          href="/lead"
        />
      </div>

      {dati.senzaProssimaAzione > 0 ? (
        <Link
          href="/lead"
          className="mt-6 block rounded-xl border p-5 transition-colors hover:bg-white/[0.03]"
          style={{
            borderColor: 'rgba(224,133,133,0.4)',
            background: 'rgba(224,133,133,0.07)',
          }}
        >
          <p className="eyebrow" style={{ color: '#e8a0a0' }}>
            Anomalia di sistema
          </p>
          <p className="mt-2 text-sm" style={{ color: '#f0c9c9' }}>
            Ci sono {dati.senzaProssimaAzione} lead aperti senza prossima azione.
            Secondo il criterio di accettazione 4 questo valore deve essere sempre zero:
            non è un arretrato da smaltire, è il segnale che una regola non ha funzionato.
          </p>
          <p className="mt-3 text-xs" style={{ color: '#e8a0a0' }}>
            Apri i lead →
          </p>
        </Link>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            indice={1}
            interattivo
            title="Pipeline per stato"
            action={
              <Link
                href="/lead"
                className="collega text-xs transition-colors hover:text-eco-gold-300"
                style={{ color: 'var(--color-eco-blue-300)' }}
              >
                Apri i lead →
              </Link>
            }
          >
            {dati.perStato.every((s) => s.totale === 0) ? (
              <Vuoto messaggio="Nessun lead aperto. Inizia da Lead → Nuovo lead." />
            ) : (
              <ul className="space-y-2.5">
                {dati.perStato.map((stato, indice) => (
                  <li key={stato.code}>
                    <Link
                      href="/lead"
                      className="riga flex items-center gap-4 rounded-md py-0.5 transition-colors hover:bg-white/[0.03]"
                    >
                      <span
                        className="w-28 shrink-0 truncate text-sm sm:w-48"
                        style={{
                          color: stato.totale > 0 ? 'var(--testo)' : 'var(--testo-fioco)',
                        }}
                      >
                        {stato.label}
                      </span>
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full"
                        style={{ background: 'rgba(255,255,255,0.04)' }}
                      >
                        <div
                          className="barra-cresce h-full rounded-full"
                          style={{
                            width: `${(stato.totale / massimo) * 100}%`,
                            background:
                              'linear-gradient(90deg, #3f7fc4 0%, #d9a441 100%)',
                            boxShadow:
                              stato.totale > 0
                                ? '0 0 12px -2px rgba(217,164,65,0.55)'
                                : 'none',
                            ...ritardo(indice, 45),
                          }}
                        />
                      </div>
                      <span
                        className="w-6 text-right text-sm tabular-nums"
                        style={{
                          color: stato.totale > 0 ? 'var(--testo)' : 'var(--testo-fioco)',
                        }}
                      >
                        {stato.totale}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Link href="/metriche" className="block">
          <Card title="Misure in costruzione" accento="blu" indice={2} interattivo>
            <div className="space-y-4 text-sm">
              <div>
                <Badge tone="attenzione">Baseline mancante</Badge>
                <p className="mt-2 leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
                  Lo speed-to-lead sarà confrontabile solo quando la baseline dello Sprint 0
                  sarà compilata. {dati.senzaPrimaRisposta} lead aperti non hanno
                  ancora una prima risposta tracciata.
                </p>
              </div>
              <div className="filetto-blu" />
              <p className="leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
                Vai alle metriche commerciali →
              </p>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}
