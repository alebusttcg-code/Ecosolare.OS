'use client'

import { useCallback, useRef, type ReactNode } from 'react'

/**
 * Inclinazione tridimensionale che segue il puntatore.
 *
 * Va usata SOLO su tessere piccole e di sola lettura — le metriche del
 * cruscotto. Su un pannello che contiene una tabella o un modulo sarebbe un
 * danno: il testo tremola mentre lo si legge e un campo si sposta mentre ci si
 * clicca dentro.
 *
 * Implementazione: si scrivono due variabili CSS e si lascia fare al
 * compositore. Nessuno stato React, nessun re-render a ogni movimento del
 * mouse — sarebbero decine di render al secondo per un effetto puramente visivo.
 */
export function Inclina({
  children,
  intensita = 7,
  className = '',
}: {
  children: ReactNode
  /** Gradi massimi di rotazione ai bordi. Oltre gli 8 diventa un giocattolo. */
  intensita?: number
  className?: string
}) {
  const riferimento = useRef<HTMLDivElement>(null)
  const frame = useRef<number | undefined>(undefined)

  const muovi = useCallback(
    (evento: React.PointerEvent<HTMLDivElement>) => {
      const nodo = riferimento.current
      if (!nodo) return
      // Solo mouse: col dito l'inclinazione scatterebbe durante lo scroll.
      if (evento.pointerType !== 'mouse') return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const { clientX, clientY } = evento
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)

      frame.current = requestAnimationFrame(() => {
        const r = nodo.getBoundingClientRect()
        // Da -0,5 a +0,5 rispetto al centro della tessera.
        const x = (clientX - r.left) / r.width - 0.5
        const y = (clientY - r.top) / r.height - 0.5

        nodo.style.setProperty('--inclina-x', `${(-y * intensita).toFixed(2)}deg`)
        nodo.style.setProperty('--inclina-y', `${(x * intensita).toFixed(2)}deg`)
        // Il riflesso insegue il puntatore: e' quello che rende credibile
        // l'inclinazione, piu' della rotazione stessa.
        nodo.style.setProperty('--luce-x', `${((x + 0.5) * 100).toFixed(1)}%`)
        nodo.style.setProperty('--luce-y', `${((y + 0.5) * 100).toFixed(1)}%`)
        nodo.style.setProperty('--luce-opacita', '1')
      })
    },
    [intensita],
  )

  const esci = useCallback(() => {
    const nodo = riferimento.current
    if (!nodo) return
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)

    nodo.style.setProperty('--inclina-x', '0deg')
    nodo.style.setProperty('--inclina-y', '0deg')
    nodo.style.setProperty('--luce-opacita', '0')
  }, [])

  return (
    <div
      ref={riferimento}
      onPointerMove={muovi}
      onPointerLeave={esci}
      className={`inclinabile ${className}`}
    >
      {children}
    </div>
  )
}
