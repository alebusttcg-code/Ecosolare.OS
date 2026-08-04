'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createSurvey } from '@/lib/actions/questionnaires'

export function NuovoSopralluogo({ opportunityId }: { opportunityId: string }) {
  const router = useRouter()
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={inCorso}
        onClick={() =>
          avvia(async () => {
            setErrore(null)
            const esito = await createSurvey({ opportunityId })
            if (esito.ok) router.push(`/sopralluoghi/${esito.data.id}`)
            else setErrore(Object.values(esito.errors)[0] ?? 'Creazione non riuscita.')
          })
        }
        className="text-xs text-eco-blue-500 hover:underline disabled:opacity-50"
      >
        + Nuovo sopralluogo
      </button>
      {errore ? <p className="mt-1 text-xs text-red-600">{errore}</p> : null}
    </div>
  )
}
