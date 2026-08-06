'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { segnaVerificato } from '@/lib/actions/banca'

/**
 * Chiusura manuale di un riscontro che non torna.
 *
 * La nota è obbligatoria di proposito: fra tre mesi, davanti a un incasso
 * marcato come verificato, l'unica domanda utile sarà «cosa era successo».
 * Un segno di spunta senza spiegazione non risponde.
 */
export function VerificaRiscontro({ checkId }: { checkId: string }) {
  const router = useRouter()
  const [aperto, setAperto] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="bottone-fantasma shrink-0 rounded-lg border px-3 py-1 text-xs"
        style={{ borderColor: 'var(--bordo)' }}
      >
        Verificato
      </button>
    )
  }

  return (
    <form
      action={(dati) => {
        setErrore(null)
        avvia(async () => {
          const esito = await segnaVerificato({
            checkId,
            nota: String(dati.get('nota') ?? ''),
          })
          if (esito.ok) {
            setAperto(false)
            router.refresh()
          } else {
            setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
          }
        })
      }}
      className="flex shrink-0 flex-wrap items-center gap-2"
    >
      <input
        name="nota"
        required
        autoFocus
        placeholder="Cosa hai verificato"
        className="w-52 rounded-md border px-2 py-1 text-xs outline-none focus:border-eco-blue-400"
        style={{ background: 'rgba(5,10,20,0.6)', borderColor: 'var(--bordo)' }}
      />
      <button
        type="submit"
        disabled={inCorso}
        className="bottone-fantasma rounded-md border px-2.5 py-1 text-xs"
        style={{ borderColor: 'var(--bordo)' }}
      >
        {inCorso ? '…' : 'Salva'}
      </button>
      <button
        type="button"
        onClick={() => setAperto(false)}
        className="px-1 text-sm leading-none"
        style={{ color: 'var(--testo-fioco)' }}
        aria-label="Annulla"
      >
        ×
      </button>
      {errore ? (
        <span className="w-full text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
          {errore}
        </span>
      ) : null}
    </form>
  )
}
