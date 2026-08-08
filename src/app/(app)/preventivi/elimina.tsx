'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Dialogo } from '@/components/dialogo'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import { deleteQuote } from '@/lib/actions/quotes'

/**
 * Eliminazione di un preventivo non ancora inviato.
 *
 * Chiede conferma esplicita: una cancellazione accidentale dalla lista fa
 * perdere il lavoro di composizione senza undo.
 */
export function EliminaPreventivo({
  quoteId,
  titolo,
  variante = 'icona',
  dopoEliminazione = '/preventivi',
}: {
  quoteId: string
  titolo: string
  variante?: 'icona' | 'pulsante'
  /** Dove andare dopo l'eliminazione (es. elenco o scheda lead). */
  dopoEliminazione?: string
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [aperto, setAperto] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  function conferma() {
    setErrore(null)
    esegui(async () => {
      const esito = await deleteQuote(quoteId)
      if (!esito.ok) {
        setErrore(Object.values(esito.errors)[0] ?? 'Eliminazione non riuscita.')
        return
      }
      setAperto(false)
      avvisa('Preventivo eliminato.', 'info')
      router.push(dopoEliminazione)
      router.refresh()
    })
  }

  return (
    <>
      {variante === 'icona' ? (
        <button
          type="button"
          onClick={() => setAperto(true)}
          className="rounded-md px-2 py-1 text-xs transition-colors hover:bg-white/[0.06]"
          style={{ color: 'var(--color-eco-red-400)' }}
          title="Elimina preventivo"
          aria-label={`Elimina ${titolo}`}
        >
          Elimina
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAperto(true)}
          className="bottone-fantasma w-full rounded-lg border px-4 py-2 text-sm"
          style={{ borderColor: 'rgba(224,133,133,0.42)', color: 'var(--color-eco-red-400)' }}
        >
          Elimina preventivo
        </button>
      )}

      <Dialogo aperto={aperto} titolo="Eliminare il preventivo?" onChiudi={() => setAperto(false)}>
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
            Stai per eliminare «{titolo}». L’operazione non si può annullare: restano
            solo i preventivi già inviati al cliente, che sono un fatto contrattuale.
          </p>
          {errore ? <p className="text-sm text-eco-red-400">{errore}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setAperto(false)}
              disabled={inCorso}
              className="bottone-fantasma rounded-lg border px-4 py-2 text-sm"
              style={{ borderColor: 'var(--bordo)' }}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={conferma}
              disabled={inCorso}
              className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{
                borderColor: 'rgba(224,133,133,0.5)',
                background: 'rgba(224,133,133,0.12)',
                color: 'var(--color-eco-red-400)',
              }}
            >
              {inCorso ? 'Eliminazione…' : 'Elimina'}
            </button>
          </div>
        </div>
      </Dialogo>
    </>
  )
}
