import Image from 'next/image'
import { notFound } from 'next/navigation'
import { FASI_CLIENTE } from '@/lib/domain/stato-cliente'
import { getStatoPubblico } from '@/lib/queries/stato-pubblico'

/**
 * Pagina pubblica: lo stato dell'impianto, per il cliente.
 *
 * Nessun accesso, nessuna password: il collegamento *è* la credenziale. Per
 * questo la query che la alimenta è una lista chiusa di campi, e per questo la
 * pagina è esclusa dai motori di ricerca.
 *
 * `force-dynamic` perché la cache di una pagina il cui contenuto dipende dal
 * token è il modo più diretto per mostrare a un cliente lo stato di un altro.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Il tuo impianto — EcoSolare',
  robots: { index: false, follow: false },
}

function dataItaliana(valore: Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  }).format(valore)
}

export default async function StatoPubblicoPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const dati = await getStatoPubblico(token)

  // Token inesistente, revocato o commessa cancellata: stessa risposta, così
  // la pagina non diventa un modo per scoprire quali collegamenti esistono.
  if (!dati) notFound()

  const { stato } = dati

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl p-6 sm:p-10">
      <div className="mb-10 flex justify-center">
        <Image
          src="/brand/ecosolare-logo.png"
          alt="EcoSolare"
          width={601}
          height={193}
          priority
          className="h-12 w-auto"
        />
      </div>

      <div className="pannello p-6 sm:p-8">
        <p className="eyebrow">{dati.codice}</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
          {dati.titolo}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
          {dati.cliente}
          {dati.indirizzo ? ` · ${dati.indirizzo}` : ''}
        </p>

        <div className="mt-5 filetto" />

        {/* Lo stato, per primo e in grande: è l'unica cosa che il cliente
            è venuto a leggere. */}
        <section className="mt-6">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-eco-gold-300)' }}>
            {stato.titolo}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
            {stato.messaggio}
          </p>
        </section>

        {!stato.ferma ? (
          <section className="mt-8">
            <ol className="space-y-3">
              {FASI_CLIENTE.map((f, i) => {
                const fatta = i < stato.indiceFase || stato.conclusa
                const corrente = i === stato.indiceFase && !stato.conclusa

                return (
                  <li key={f.fase} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]"
                      style={{
                        background: fatta
                          ? 'var(--color-eco-gold-300)'
                          : corrente
                            ? 'rgba(232,199,101,0.18)'
                            : 'transparent',
                        border: `1px solid ${fatta || corrente ? 'var(--color-eco-gold-300)' : 'var(--bordo)'}`,
                        color: fatta ? '#050a14' : 'var(--color-eco-gold-300)',
                      }}
                    >
                      {fatta ? '✓' : corrente ? '•' : ''}
                    </span>
                    <div className="min-w-0">
                      <div
                        className="text-sm"
                        style={{
                          color: corrente
                            ? 'var(--testo)'
                            : fatta
                              ? 'var(--testo-tenue)'
                              : 'var(--testo-fioco)',
                          fontWeight: corrente ? 600 : 400,
                        }}
                      >
                        {f.titolo}
                      </div>
                      {corrente ? (
                        <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                          {f.cosaSuccede}
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        ) : null}

        {dati.documentiAttesi.length > 0 ? (
          <section
            className="mt-8 rounded-lg border px-4 py-3"
            style={{
              borderColor: 'rgba(232,199,101,0.45)',
              background: 'rgba(232,199,101,0.07)',
            }}
          >
            <h2 className="text-sm font-semibold">Cosa aspettiamo da te</h2>
            <ul className="mt-2 space-y-1.5">
              {dati.documentiAttesi.map((d) => (
                <li key={d.etichetta} className="text-sm">
                  · {d.etichetta}
                  {d.respinto ? (
                    <span className="ml-1 text-xs" style={{ color: '#e8a0a0' }}>
                      (da rifare: quello ricevuto non era leggibile)
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs" style={{ color: 'var(--testo-tenue)' }}>
              Puoi mandarli al tuo referente per email o WhatsApp: bastano fotografie
              nitide, non servono scansioni.
            </p>
          </section>
        ) : null}

        {dati.dataInstallazione ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold">Data di installazione</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
              {dataItaliana(dati.dataInstallazione)}
            </p>
          </section>
        ) : null}

        {dati.referente ? (
          <section className="mt-8 border-t pt-5" style={{ borderColor: 'var(--bordo)' }}>
            <p className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
              Il tuo referente è <strong>{dati.referente}</strong>. Per qualsiasi cosa,
              scrivigli o chiamalo: questa pagina si aggiorna da sola.
            </p>
          </section>
        ) : null}
      </div>

      <p className="mt-6 text-center text-xs" style={{ color: 'var(--testo-fioco)' }}>
        Pagina riservata. Non condividere questo collegamento.
      </p>
    </main>
  )
}
