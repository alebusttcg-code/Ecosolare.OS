'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Numero che sale fino al valore reale all'apertura della schermata.
 *
 * Non e' decorazione: il movimento porta lo sguardo sulla cifra e rende
 * percepibile che il dato e' appena stato calcolato. Dura poco piu' di mezzo
 * secondo e non si ripete.
 *
 * Chi ha ridotto le animazioni di sistema vede subito il valore finale.
 */
export function Contatore({
  valore,
  formato = 'intero',
  durata = 900,
}: {
  valore: number
  formato?: 'intero' | 'euro'
  durata?: number
}) {
  const riduzione =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const [corrente, setCorrente] = useState(riduzione ? valore : 0)
  const frame = useRef<number | undefined>(undefined)

  useEffect(() => {
    // Anche il caso immediato passa da un frame: aggiornare lo stato in modo
    // sincrono dentro l'effetto provocherebbe un doppio render inutile.
    if (riduzione || valore === 0) {
      const id = requestAnimationFrame(() => setCorrente(valore))
      return () => cancelAnimationFrame(id)
    }

    const inizio = performance.now()

    function passo(ora: number) {
      const t = Math.min(1, (ora - inizio) / durata)
      // Decelerazione: parte veloce e si posa, invece di frenare di colpo.
      const eased = 1 - Math.pow(1 - t, 3)
      setCorrente(valore * eased)
      if (t < 1) frame.current = requestAnimationFrame(passo)
      else setCorrente(valore)
    }

    frame.current = requestAnimationFrame(passo)
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    }
  }, [valore, durata, riduzione])

  const testo =
    formato === 'euro'
      ? new Intl.NumberFormat('it-IT', {
          style: 'currency',
          currency: 'EUR',
          maximumFractionDigits: 0,
        }).format(corrente)
      : Math.round(corrente).toLocaleString('it-IT')

  return <span className="tabular-nums">{testo}</span>
}
