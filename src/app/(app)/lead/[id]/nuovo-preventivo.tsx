'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import { createQuote } from '@/lib/actions/quotes'

export type StudioPerPreventivo = {
  readonly id: string
  readonly title: string
  readonly moduliCount: number | null
  readonly powerKwp: string | null
}

export function NuovoPreventivo({
  opportunityId,
  titoloProposto,
  studiCompleti,
}: {
  opportunityId: string
  titoloProposto: string
  studiCompleti: readonly StudioPerPreventivo[]
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [aperto, setAperto] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  if (studiCompleti.length === 0) {
    return (
      <Link
        href={`/sviluppo?lead=${opportunityId}`}
        className="text-xs text-eco-blue-300 hover:underline collega"
      >
        + Studio tetto per preventivo
      </Link>
    )
  }

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
            siteStudyId: String(formData.get('siteStudyId') ?? ''),
            title: String(formData.get('title') ?? ''),
          })
          if (esito.ok) {
            avvisa('Preventivo creato.')
            router.push(`/preventivi/${esito.data.versionId}`)
          } else {
            setErrore(
              esito.errors.siteStudyId ??
                esito.errors.title ??
                Object.values(esito.errors)[0] ??
                'Creazione non riuscita.',
            )
          }
        })
      }}
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <select
        name="siteStudyId"
        required
        defaultValue={studiCompleti[0]!.id}
        className="rounded border px-2 py-1.5 text-xs"
        style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
      >
        {studiCompleti.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
            {s.powerKwp ? ` · ${Number.parseFloat(s.powerKwp).toFixed(2)} kWp` : ''}
            {s.moduliCount != null ? ` · ${s.moduliCount} moduli` : ''}
          </option>
        ))}
      </select>
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
      <Link
        href={`/sviluppo?lead=${opportunityId}`}
        className="text-[11px] text-eco-blue-300 hover:underline"
      >
        Nuovo studio
      </Link>
      {errore ? <span className="text-xs text-eco-red-400">{errore}</span> : null}
    </form>
  )
}
