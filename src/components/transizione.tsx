'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Transizione fra le sezioni.
 *
 * Il contenuto entra con una dissolvenza e un piccolo scorrimento a ogni
 * cambio di rotta. La chiave e' il percorso: React smonta e rimonta il ramo,
 * quindi l'animazione riparte davvero invece di restare ferma al primo caricamento.
 *
 * Perche' non l'API View Transitions del browser: richiede il canale
 * sperimentale di React per funzionare con il router di Next. Questa soluzione
 * ottiene lo stesso effetto percepito senza dipendere da API instabili.
 *
 * La sidebar resta fuori: e' l'elemento che deve dare continuita' fra una
 * schermata e l'altra, e animarla renderebbe la navigazione confusa.
 */
export function TransizionePagina({ children }: { children: ReactNode }) {
  const percorso = usePathname()
  const [chiave, setChiave] = useState(percorso)
  const precedente = useRef(percorso)

  useEffect(() => {
    if (precedente.current === percorso) return
    precedente.current = percorso
    setChiave(percorso)
  }, [percorso])

  return (
    <div key={chiave} className="transizione-vista">
      {children}
    </div>
  )
}
