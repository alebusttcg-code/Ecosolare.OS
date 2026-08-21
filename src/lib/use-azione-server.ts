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
      // Senza catch un throw dell'azione diventa un rejection non gestito: niente
      // in console utile, e per l'utente «non succede nulla». Almeno lo logghiamo
      // (i chiamanti che vogliono mostrarlo lo avvolgono in try/catch loro).
      .catch((errore) => {
        console.error('Azione server fallita:', errore)
      })
      .finally(() => {
        setInCorso(false)
      })
  }, [])

  return { inCorso, esegui }
}
