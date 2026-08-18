import Link from 'next/link'

export const metadata = { title: 'Pagina non trovata — EcoSolare OS' }

/**
 * 404 globale, per gli indirizzi che non corrispondono a nessuna rotta (fuori
 * dall'area applicativa, dove c'è una not-found col menu). In italiano e
 * coerente col marchio, non la schermata di default in inglese.
 */
export default function NonTrovataGlobale() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 text-center"
      style={{ background: 'var(--sfondo, #050a14)', color: 'var(--testo, #e8edf4)' }}
    >
      <p className="text-5xl font-semibold tabular-nums sm:text-6xl" style={{ color: '#e8c765' }}>
        404
      </p>
      <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
        Pagina non trovata
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--testo-tenue, #9fb0c3)' }}>
        L’indirizzo non esiste. Torna all’accesso per rientrare nel gestionale.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg px-4 py-2 text-sm font-semibold"
        style={{ background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)', color: '#050a14' }}
      >
        Vai all’accesso
      </Link>
    </main>
  )
}
