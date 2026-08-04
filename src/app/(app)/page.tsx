import Link from 'next/link'
import { Badge, Card, Stat, Vuoto, formattaEuro } from '@/components/ui'
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
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Cruscotto</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
          Fase 1 — anagrafiche, pipeline e attivita.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Opportunita aperte" value={dati.aperte} />
        <Stat label="Valore in pipeline" value={formattaEuro(dati.valoreAperto)} />
        <Stat
          label="Prossime azioni scadute"
          value={dati.inRitardo}
          tone={dati.inRitardo > 0 ? 'attenzione' : 'neutro'}
          hint={mieScadute > 0 ? `di cui tue: ${mieScadute}` : undefined}
        />
        <Stat
          label="Senza prossima azione"
          value={dati.senzaProssimaAzione}
          tone={dati.senzaProssimaAzione > 0 ? 'critico' : 'neutro'}
          hint="deve essere sempre zero"
        />
      </div>

      {dati.senzaProssimaAzione > 0 ? (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: '#f5c2c0', background: '#fdecea', color: '#7a271a' }}
        >
          <strong>Anomalia di sistema.</strong> Ci sono {dati.senzaProssimaAzione}{' '}
          opportunita aperte senza prossima azione. Secondo il criterio di accettazione 4
          questo valore deve essere sempre zero: non e un arretrato da smaltire, e il
          segnale che una regola non ha funzionato.
        </div>
      ) : null}

      <Card
        title="Pipeline per stato"
        action={
          <Link href="/opportunita" className="text-xs text-eco-blue-500 hover:underline">
            Apri la pipeline
          </Link>
        }
      >
        {dati.perStato.every((s) => s.totale === 0) ? (
          <Vuoto messaggio="Nessuna opportunita aperta. Inizia creando un cliente." />
        ) : (
          <ul className="space-y-2">
            {dati.perStato.map((stato) => (
              <li key={stato.code} className="flex items-center gap-3">
                <span className="w-52 shrink-0 text-sm">{stato.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded" style={{ background: 'var(--sfondo)' }}>
                  <div
                    className="h-full rounded bg-eco-blue-500"
                    style={{ width: `${(stato.totale / massimo) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm tabular-nums">{stato.totale}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Misure in costruzione">
        <div className="space-y-2 text-sm" style={{ color: 'var(--testo-tenue)' }}>
          <p>
            <Badge tone="attenzione">Baseline mancante</Badge>{' '}
            Lo speed-to-lead sara confrontabile solo quando la baseline dello Sprint 0
            sara compilata: {dati.senzaPrimaRisposta} opportunita aperte non hanno ancora
            una prima risposta tracciata.
          </p>
          <p>
            Conversione, tempo sopralluogo-preventivo e valore dei preventivi aperti
            arrivano con la Fase 2.
          </p>
        </div>
      </Card>
    </div>
  )
}
