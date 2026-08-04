'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { newQuoteVersion, recordQuoteOutcome, sendQuote } from '@/lib/actions/quotes'
import type { StatoVersione } from '@/lib/domain/quote-lifecycle'

export function AzioniPreventivo({
  versionId,
  quoteId,
  stato,
}: {
  versionId: string
  quoteId: string
  stato: StatoVersione
}) {
  const router = useRouter()
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [mostraRifiuto, setMostraRifiuto] = useState(false)
  const [inCorso, avvia] = useTransition()

  function invia() {
    setErrore(null)
    setMessaggio(null)
    avvia(async () => {
      const esito = await sendQuote(versionId)
      if (!esito.ok) {
        setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
        return
      }
      setMessaggio(
        esito.data.inviato
          ? 'Preventivo contrassegnato come inviato. Da questo momento la versione non è più modificabile.'
          : 'Richiesta di approvazione inviata alla direzione: il margine è sotto la soglia minima.',
      )
      router.refresh()
    })
  }

  function nuovaVersione() {
    setErrore(null)
    avvia(async () => {
      const esito = await newQuoteVersion(quoteId)
      if (esito.ok) router.push(`/preventivi/${esito.data.versionId}`)
      else setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
    })
  }

  function registraEsito(esito: 'accettato' | 'rifiutato', motivo?: string) {
    setErrore(null)
    avvia(async () => {
      const risultato = await recordQuoteOutcome({
        versionId,
        esito,
        ...(motivo ? { motivoRifiuto: motivo } : {}),
      })
      if (risultato.ok) {
        setMostraRifiuto(false)
        router.refresh()
      } else setErrore(Object.values(risultato.errors)[0] ?? 'Operazione non riuscita.')
    })
  }

  return (
    <div className="space-y-3">
      {stato === 'bozza' || stato === 'approvato' ? (
        <button
          type="button"
          onClick={invia}
          disabled={inCorso}
          className="w-full rounded-md bg-eco-blue-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {stato === 'approvato' ? 'Invia (approvato)' : 'Invia al cliente'}
        </button>
      ) : null}

      {stato === 'in_approvazione' ? (
        <p className="rounded border p-3 text-xs" style={{ borderColor: '#e8b924', background: '#fdf9ec', color: '#7a5c00' }}>
          In attesa di approvazione dalla direzione.
        </p>
      ) : null}

      {stato === 'inviato' ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => registraEsito('accettato')}
            disabled={inCorso}
            className="w-full rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: '#2b6a25' }}
          >
            Il cliente ha accettato
          </button>
          {mostraRifiuto ? (
            <form
              action={(formData) => registraEsito('rifiutato', String(formData.get('motivo') ?? ''))}
              className="space-y-2"
            >
              <input
                name="motivo"
                required
                placeholder="Motivo del rifiuto"
                className="w-full rounded border px-3 py-1.5 text-sm"
                style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
              />
              <button
                type="submit"
                disabled={inCorso}
                className="w-full rounded-md border px-4 py-2 text-sm"
                style={{ borderColor: 'var(--bordo)' }}
              >
                Registra il rifiuto
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setMostraRifiuto(true)}
              className="w-full rounded-md border px-4 py-2 text-sm"
              style={{ borderColor: 'var(--bordo)' }}
            >
              Il cliente ha rifiutato
            </button>
          )}
        </div>
      ) : null}

      {stato !== 'bozza' ? (
        <button
          type="button"
          onClick={nuovaVersione}
          disabled={inCorso}
          className="w-full rounded-md border px-4 py-2 text-sm disabled:opacity-50"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Crea nuova versione
        </button>
      ) : null}

      {errore ? <p className="text-xs text-red-600">{errore}</p> : null}
      {messaggio ? (
        <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
          {messaggio}
        </p>
      ) : null}
    </div>
  )
}
