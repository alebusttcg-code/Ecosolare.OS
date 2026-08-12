'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import { newQuoteVersion, recordQuoteOutcome, sendQuote } from '@/lib/actions/quotes'
import { puoEliminarePreventivo, type StatoVersione } from '@/lib/domain/quote-lifecycle'
import { EliminaPreventivo } from '../elimina'
import { ScaricaPdfPreventivo } from './scarica-pdf'

export function AzioniPreventivo({
  versionId,
  quoteId,
  titolo,
  stato,
  haRighe,
}: {
  versionId: string
  quoteId: string
  titolo: string
  stato: StatoVersione
  /** Il PDF ha senso solo con almeno una riga economica. */
  haRighe: boolean
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [mostraRifiuto, setMostraRifiuto] = useState(false)
  const { inCorso, esegui } = useAzioneServer()

  function invia() {
    setErrore(null)
    setMessaggio(null)
    esegui(async () => {
      const esito = await sendQuote(versionId)
      if (!esito.ok) {
        setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
        return
      }
      const testo = esito.data.inviato
        ? 'Preventivo segnato come consegnato. Da questo momento la versione non è più modificabile.'
        : 'Richiesta di approvazione inviata alla direzione: il margine è sotto la soglia minima.'
      setMessaggio(testo)
      avvisa(esito.data.inviato ? 'Preventivo consegnato.' : 'Richiesta di approvazione inviata.')
      router.refresh()
    })
  }

  function nuovaVersione() {
    setErrore(null)
    esegui(async () => {
      const esito = await newQuoteVersion(quoteId)
      if (esito.ok) {
        avvisa('Nuova versione creata.')
        router.push(`/preventivi/${esito.data.versionId}`)
      } else setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
    })
  }

  function registraEsito(esito: 'accettato' | 'rifiutato', motivo?: string) {
    setErrore(null)
    esegui(async () => {
      const risultato = await recordQuoteOutcome({
        versionId,
        esito,
        ...(motivo ? { motivoRifiuto: motivo } : {}),
      })
      if (risultato.ok) {
        avvisa(esito === 'accettato' ? 'Preventivo accettato.' : 'Rifiuto registrato.', esito === 'accettato' ? 'successo' : 'info')
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
          className="bottone-oro w-full rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso disabled:opacity-50"
        >
          {stato === 'approvato' ? 'Preventivo consegnato (approvato)' : 'Preventivo consegnato'}
        </button>
      ) : null}

      {stato === 'in_approvazione' ? (
        <p className="rounded border p-3 text-xs" style={{ borderColor: 'rgba(217,164,65,0.42)', background: 'rgba(217,164,65,0.08)', color: '#e8c765' }}>
          In attesa di approvazione dalla direzione.
        </p>
      ) : null}

      {stato === 'inviato' ? (
        <div className="space-y-2">
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
            Accettare registra l’esito. Per diventare cliente e aprire il cantiere
            serve poi «Conferma e apri cantiere».
          </p>
          <button
            type="button"
            onClick={() => registraEsito('accettato')}
            disabled={inCorso}
            className="w-full rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #a3c563 0%, #7fa348 100%)', color: '#050a14' }}
          >
            Accettato dal cliente
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
                className="w-full rounded-lg border px-3 py-1.5 text-sm transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
                style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
              />
              <button
                type="submit"
                disabled={inCorso}
                className="bottone-fantasma w-full rounded-lg border px-4 py-2 text-sm"
                style={{ borderColor: 'var(--bordo)' }}
              >
                Registra il rifiuto
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setMostraRifiuto(true)}
              className="bottone-fantasma w-full rounded-lg border px-4 py-2 text-sm"
              style={{ borderColor: 'var(--bordo)' }}
            >
              Il contatto ha rifiutato
            </button>
          )}
        </div>
      ) : null}

      {stato !== 'bozza' ? (
        <button
          type="button"
          onClick={nuovaVersione}
          disabled={inCorso}
          className="bottone-fantasma w-full rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Crea nuova versione
        </button>
      ) : null}

      {haRighe ? (
        <div className="grid gap-2">
          <a
            href={`/pdf-render/preventivi/${versionId}`}
            target="_blank"
            rel="noreferrer"
            className="bottone-fantasma flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-white/[0.04]"
            style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
          >
            <span aria-hidden>◉</span>
            Anteprima preventivo
          </a>
          <ScaricaPdfPreventivo versionId={versionId} disabled={inCorso} />
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
          Aggiungi almeno una riga per scaricare il PDF.
        </p>
      )}

      {puoEliminarePreventivo(stato) ? (
        <EliminaPreventivo
          quoteId={quoteId}
          titolo={titolo}
          variante="pulsante"
          dopoEliminazione="/preventivi"
        />
      ) : null}

      {errore ? <p className="text-xs text-eco-red-400">{errore}</p> : null}
      {messaggio ? (
        <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
          {messaggio}
        </p>
      ) : null}
    </div>
  )
}
