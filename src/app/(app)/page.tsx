import Link from 'next/link'
import { Badge, Card, Intestazione, Stat, Vuoto, ritardo } from '@/components/ui'
import { getCurrentUser } from '@/lib/auth/session'
import { contaAttivitaScadute, getCruscotto } from '@/lib/queries/dashboard'

export const metadata = { title: 'Cruscotto — EcoSolare OS' }

export default async function CruscottoPage() {
  const utente = await getCurrentUser()
  if (!utente) return null

  const [dati, mieScadute] = await Promise.all([
    getCruscotto(),
    contaAttivitaScadute(utente.id),
  ])

  const massimo = Math.max(1, ...dati.perStato.map((s) => s.totale))

  return (
    <div>
      <Intestazione
        eyebrow="Direzione"
        titolo="Cruscotto"
        sottotitolo="Lead, pipeline e attività in un colpo solo."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Opportunità aperte" value={dati.aperte} icona="◭" indice={0} />
        <Stat
          label="Valore in pipeline"
          value={Number.parseFloat(dati.valoreAperto ?? '0') || 0}
          formato="euro"
          icona="€"
          indice={1}
        />
        <Stat
          label="Prossime azioni scadute"
          value={dati.inRitardo}
          tone={dati.inRitardo > 0 ? 'attenzione' : 'positivo'}
          icona="!"
          hint={mieScadute > 0 ? `di cui tue: ${mieScadute}` : undefined}
          indice={2}
        />
        <Stat
          label="Senza prossima azione"
          value={dati.senzaProssimaAzione}
          tone={dati.senzaProssimaAzione > 0 ? 'critico' : 'positivo'}
          icona="◇"
          hint="deve essere sempre zero"
          indice={3}
        />
      </div>

      {dati.senzaProssimaAzione > 0 ? (
        <div
          className="mt-6 rounded-xl border p-5"
          style={{
            borderColor: 'rgba(224,133,133,0.4)',
            background: 'rgba(224,133,133,0.07)',
          }}
        >
          <p className="eyebrow" style={{ color: '#e8a0a0' }}>
            Anomalia di sistema
          </p>
          <p className="mt-2 text-sm" style={{ color: '#f0c9c9' }}>
            Ci sono {dati.senzaProssimaAzione} opportunità aperte senza prossima azione.
            Secondo il criterio di accettazione 4 questo valore deve essere sempre zero:
            non è un arretrato da smaltire, è il segnale che una regola non ha funzionato.
          </p>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            indice={1}
            title="Pipeline per stato"
            action={
              <Link
                href="/opportunita"
                className="collega text-xs transition-colors hover:text-eco-gold-300"
                style={{ color: 'var(--color-eco-blue-300)' }}
              >
                Apri la pipeline →
              </Link>
            }
          >
            {dati.perStato.every((s) => s.totale === 0) ? (
              <Vuoto messaggio="Nessuna opportunità aperta. Inizia creando un cliente." />
            ) : (
              <ul className="space-y-2.5">
                {dati.perStato.map((stato, indice) => (
                  <li
                    key={stato.code}
                    className="riga flex items-center gap-4 rounded-md py-0.5"
                  >
                    <span
                      className="w-48 shrink-0 truncate text-sm"
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
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Misure in costruzione" accento="blu" indice={2}>
          <div className="space-y-4 text-sm">
            <div>
              <Badge tone="attenzione">Baseline mancante</Badge>
              <p className="mt-2 leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
                Lo speed-to-lead sarà confrontabile solo quando la baseline dello Sprint 0
                sarà compilata. {dati.senzaPrimaRisposta} opportunità aperte non hanno
                ancora una prima risposta tracciata.
              </p>
            </div>
            <div className="filetto-blu" />
            <p className="leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
              Conversione, tempo sopralluogo-preventivo e valore dei preventivi aperti
              arrivano completando la Fase 2.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
