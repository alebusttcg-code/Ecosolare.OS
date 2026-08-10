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
 * accettare/rifiutare (esito) ≠ confermare e aprire il cantiere (diventa cliente).
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
  const [mostraRifiuto, setMostraRifiuto] = useState(false)
  const { inCorso, esegui } = useAzioneServer()

  if (status !== 'inviato' && status !== 'accettato') return null

  function registraEsito(esito: 'accettato' | 'rifiutato', motivo?: string) {
    setErrore(null)
    esegui(async () => {
      const risultato = await recordQuoteOutcome({
        versionId,
        esito,
        ...(motivo ? { motivoRifiuto: motivo } : {}),
      })
      if (risultato.ok) {
        avvisa(
          esito === 'accettato' ? 'Preventivo accettato.' : 'Rifiuto registrato.',
          esito === 'accettato' ? 'successo' : 'info',
        )
        setMostraRifiuto(false)
        router.refresh()
      } else {
        setErrore(Object.values(risultato.errors)[0] ?? 'Operazione non riuscita.')
      }
    })
  }

  return (
    <div className="mt-2 space-y-2">
      {status === 'inviato' ? (
        <>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
            Accettare registra l’esito. Per diventare cliente e aprire il cantiere
            serve poi «Conferma e apri cantiere».
          </p>
          <button
            type="button"
            disabled={inCorso}
            onClick={() => registraEsito('accettato')}
            className="w-full rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #a3c563 0%, #7fa348 100%)',
              color: '#050a14',
            }}
          >
            {inCorso ? '…' : 'Accettato dal cliente'}
          </button>
          {mostraRifiuto ? (
            <form
              action={(formData) =>
                registraEsito('rifiutato', String(formData.get('motivo') ?? ''))
              }
              className="space-y-2"
            >
              <input
                name="motivo"
                required
                placeholder="Motivo del rifiuto"
                className="w-full rounded-lg border px-3 py-1.5 text-xs outline-none focus:border-eco-blue-400"
                style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
              />
              <button
                type="submit"
                disabled={inCorso}
                className="bottone-fantasma w-full rounded-lg border px-3 py-1.5 text-xs"
                style={{ borderColor: 'var(--bordo)' }}
              >
                Registra il rifiuto
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setMostraRifiuto(true)}
              className="bottone-fantasma w-full rounded-lg border px-3 py-1.5 text-xs"
              style={{ borderColor: 'var(--bordo)' }}
            >
              Rifiutato dal cliente
            </button>
          )}
        </>
      ) : null}

      {status === 'accettato' ? (
        <>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
            Preventivo accettato. Confermalo per creare il cliente e aprire il
            cantiere.
          </p>
          <RegistraFirma versionId={versionId} />
        </>
      ) : null}

      {errore ? <p className="text-xs text-eco-red-400">{errore}</p> : null}
    </div>
  )
}
