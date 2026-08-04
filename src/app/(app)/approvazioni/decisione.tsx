'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { decideApproval } from '@/lib/actions/quotes'

export function Decisione({ approvalId }: { approvalId: string }) {
  const router = useRouter()
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  function decidi(approva: boolean, nota: string) {
    setErrore(null)
    avvia(async () => {
      const esito = await decideApproval({ approvalId, approva, nota: nota || undefined })
      if (esito.ok) router.refresh()
      else setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
    })
  }

  return (
    <form
      action={(formData) => {
        const nota = String(formData.get('nota') ?? '')
        decidi(formData.get('azione') === 'approva', nota)
      }}
      className="mt-4 space-y-3 border-t pt-4"
      style={{ borderColor: 'var(--bordo)' }}
    >
      <input
        name="nota"
        placeholder="Nota sulla decisione (facoltativa)"
        className="w-full rounded border px-3 py-1.5 text-sm"
        style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          name="azione"
          value="approva"
          disabled={inCorso}
          className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: '#2b6a25' }}
        >
          Approva
        </button>
        <button
          type="submit"
          name="azione"
          value="respingi"
          disabled={inCorso}
          className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Respingi
        </button>
      </div>
      {errore ? <p className="text-xs text-red-600">{errore}</p> : null}
    </form>
  )
}
