import Link from 'next/link'
import { Card, Stat, Vuoto, ritardo } from '@/components/ui'
import { contaAttivitaScadute, getDashboard } from '@/lib/queries/dashboard'

export async function SezioneOggi({ userId }: { userId: string }) {
  const dati = await getDashboard()
  const mieScadute = await contaAttivitaScadute(userId)
  const massimo = Math.max(1, ...dati.perStato.map((s) => s.totale))

  return (
    <section className="space-y-6">
      <div>
        <p className="eyebrow" style={{ color: 'var(--testo-fioco)' }}>
          Oggi
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">
          Operatività corrente
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
          Lead aperti, scadenze e pipeline in questo momento
        </p>
      </div>

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
          className="block rounded-xl border p-5 transition-colors hover:bg-white/[0.03]"
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
            Secondo il criterio di accettazione 4 questo valore deve essere sempre zero.
          </p>
          <p className="mt-3 text-xs" style={{ color: '#e8a0a0' }}>
            Apri i lead →
          </p>
        </Link>
      ) : null}

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
                        background: 'linear-gradient(90deg, #3f7fc4 0%, #d9a441 100%)',
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
    </section>
  )
}
