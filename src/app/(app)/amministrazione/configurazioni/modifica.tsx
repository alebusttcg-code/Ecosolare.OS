'use client'

import { useState, useTransition } from 'react'
import { updateSetting } from '@/lib/actions/admin'

export interface ConfigurazioneInElenco {
  readonly key: string
  readonly value: unknown
  readonly description: string | null
}

/**
 * Modifica di una configurazione.
 *
 * Il valore si scrive in JSON perche' la forma cambia per chiave: un numero,
 * una stringa, un oggetto con gli orari. Un editor per tipo sarebbe piu' gentile
 * ma richiederebbe di dichiarare lo schema di ogni chiave: si fara' quando le
 * chiavi saranno stabili, dopo l'audit.
 */
export function ModificaConfigurazione({ voce }: { voce: ConfigurazioneInElenco }) {
  const [errore, setErrore] = useState<string | null>(null)
  const [salvato, setSalvato] = useState(false)
  const [inCorso, avvia] = useTransition()

  return (
    <form
      action={(formData) => {
        setErrore(null)
        setSalvato(false)
        avvia(async () => {
          const esito = await updateSetting({
            key: voce.key,
            value: String(formData.get('value') ?? ''),
          })
          if (esito.ok) setSalvato(true)
          else setErrore(Object.values(esito.errors)[0] ?? 'Salvataggio non riuscito.')
        })
      }}
      className="rounded-lg border p-4"
      style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
    >
      <div className="font-mono text-xs" style={{ color: 'var(--testo-tenue)' }}>
        {voce.key}
      </div>
      {voce.description ? (
        <p className="mt-1 text-sm">{voce.description}</p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <input
          name="value"
          defaultValue={JSON.stringify(voce.value)}
          className="flex-1 rounded border px-3 py-1.5 font-mono text-sm"
          style={{
            background: 'var(--superficie)',
            borderColor: errore ? '#d92d20' : 'var(--bordo)',
          }}
        />
        <button
          type="submit"
          disabled={inCorso}
          className="rounded border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--bordo)' }}
        >
          {inCorso ? '…' : 'Salva'}
        </button>
      </div>

      {errore ? <p className="mt-2 text-xs text-red-600">{errore}</p> : null}
      {salvato ? (
        <p className="mt-2 text-xs" style={{ color: '#2b6a25' }}>
          Salvato.
        </p>
      ) : null}
    </form>
  )
}
