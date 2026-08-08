'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import { createSurvey } from '@/lib/actions/questionnaires'

export function NuovoSopralluogo({ opportunityId }: { opportunityId: string }) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={inCorso}
        onClick={() =>
          esegui(async () => {
            setErrore(null)
            const esito = await createSurvey({ opportunityId })
            if (esito.ok) {
              avvisa('Sopralluogo creato.')
              router.push(`/agenda/${esito.data.id}`)
            } else setErrore(Object.values(esito.errors)[0] ?? 'Creazione non riuscita.')
          })
        }
        className="text-xs text-eco-blue-300 hover:underline disabled:opacity-50"
      >
        + Nuovo sopralluogo
      </button>
      {errore ? <p className="mt-1 text-xs text-eco-red-400">{errore}</p> : null}
    </div>
  )
}
