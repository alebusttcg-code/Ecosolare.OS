'use client'

import { useCallback, useState } from 'react'

/**
 * Stato di caricamento per le server action.
 *
 * Evita `useTransition`: quando l'action chiama `revalidatePath`, React tiene
 * il transition aperto fino al refresh RSC — che puo' durare minuti e lasciare
 * i pulsanti bloccati su «Salvataggio…» anche a operazione gia' riuscita.
 */
export function useAzioneServer() {
  const [inCorso, setInCorso] = useState(false)

  const esegui = useCallback((azione: () => void | Promise<void>) => {
    setInCorso(true)
    void Promise.resolve()
      .then(() => azione())
      .finally(() => {
        setInCorso(false)
      })
  }, [])

  return { inCorso, esegui }
}
