'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { recordQuoteOutcome } from '@/lib/actions/quotes'
import type { StatoVersione } from '@/lib/domain/quote-lifecycle'
import { useAzioneServer } from '@/lib/use-azione-server'
import { RegistraFirma } from '@/app/(app)/preventivi/[id]/firma'

/**
 * Azioni commerciali sul preventivo dalla scheda lead:
 * accettare (esito) ≠ firmare (apre la commessa).
 */
export function AzioniPreventivoLead({
  versionId,
  status,
}: {
  versionId: string
  status: StatoVersione | string | null
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  if (status !== 'inviato' && status !== 'accettato') return null

  return (
    <div className="mt-2 space-y-2">
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
        Accettare registra l’esito del cliente. La firma apre la commessa.
      </p>
      {status === 'inviato' ? (
        <button
          type="button"
          disabled={inCorso}
          onClick={() =>
            esegui(async () => {
              setErrore(null)
              const esito = await recordQuoteOutcome({
                versionId,
                esito: 'accettato',
              })
              if (esito.ok) {
                avvisa('Preventivo accettato.')
                router.refresh()
              } else {
                setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
              }
            })
          }
          className="bottone-fantasma w-full rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
          style={{ borderColor: 'var(--bordo)' }}
        >
          {inCorso ? '…' : 'Accettato dal cliente'}
        </button>
      ) : null}
      <RegistraFirma versionId={versionId} />
      {errore ? <p className="text-xs text-eco-red-400">{errore}</p> : null}
    </div>
  )
}
