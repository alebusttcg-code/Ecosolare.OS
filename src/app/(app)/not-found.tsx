import Link from 'next/link'

export const metadata = { title: 'Pagina non trovata — EcoSolare OS' }

/**
 * 404 dentro l'area applicativa: prima era la schermata di default di Next, in
 * inglese e senza stile. Ora è in italiano e coerente col resto — chi ci
 * finisce ha un modo chiaro per tornare al lavoro.
 */
export default function NonTrovata() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p
        className="text-5xl font-semibold tabular-nums sm:text-6xl"
        style={{ color: 'var(--color-eco-gold-300)' }}
      >
        404
      </p>
      <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
        Pagina non trovata
      </h1>
      <p
        className="mt-2 max-w-sm text-sm leading-relaxed"
        style={{ color: 'var(--testo-tenue)' }}
      >
        L’indirizzo non esiste, oppure la cosa che cercavi è stata spostata o
        rimossa. Nessun dato è andato perso.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg px-4 py-2 text-sm font-semibold"
        style={{ background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)', color: '#050a14' }}
      >
        Torna alla Dashboard
      </Link>
    </div>
  )
}
