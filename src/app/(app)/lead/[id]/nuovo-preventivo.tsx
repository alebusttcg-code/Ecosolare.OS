'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import { createQuote } from '@/lib/actions/quotes'

export function NuovoPreventivo({
  opportunityId,
  titoloProposto,
}: {
  opportunityId: string
  titoloProposto: string
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [aperto, setAperto] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="text-xs text-eco-blue-300 hover:underline collega"
      >
        + Nuovo preventivo
      </button>
    )
  }

  return (
    <form
      action={(formData) => {
        setErrore(null)
        esegui(async () => {
          const esito = await createQuote({
            opportunityId,
            title: String(formData.get('title') ?? ''),
          })
          if (esito.ok) {
            avvisa('Preventivo creato.')
            router.push(`/preventivi/${esito.data.versionId}`)
          } else setErrore(Object.values(esito.errors)[0] ?? 'Creazione non riuscita.')
        })
      }}
      className="flex items-center gap-2"
    >
      <input
        name="title"
        required
        defaultValue={titoloProposto}
        className="rounded border px-2 py-1.5 text-xs"
        style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
      />
      <button
        type="submit"
        disabled={inCorso}
        className="bottone-oro rounded-md bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-2 py-1.5 text-xs font-semibold text-eco-abisso"
      >
        Crea
      </button>
      {errore ? <span className="text-xs text-eco-red-400">{errore}</span> : null}
    </form>
  )
}
