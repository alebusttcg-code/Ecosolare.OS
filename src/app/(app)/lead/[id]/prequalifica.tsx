'use client'

import { useMemo, useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import { Questionario } from '@/components/questionario'
import { savePrequalification } from '@/lib/actions/questionnaires'
import {
  calcolaCompletezza,
  calcolaPunteggio,
  type DefinizioneQuestionario,
  type Risposta,
  type Risposte,
} from '@/lib/domain/questionnaire'

/**
 * Prequalifica commerciale.
 *
 * Non blocca nulla: e' uno strumento per decidere se vale la pena muoversi.
 * Il punteggio si aggiorna mentre si compila, usando lo stesso modulo puro del
 * server, cosi' il commerciale vede subito se il contatto merita priorita'.
 */
export function Prequalifica({
  opportunityId,
  templateId,
  definizione,
  risposteIniziali,
  punteggioSalvato,
}: {
  opportunityId: string
  templateId: string
  definizione: DefinizioneQuestionario
  risposteIniziali: Risposte
  punteggioSalvato: { punteggio: number; massimo: number } | null
}) {
  const avvisa = useAvvisi()
  const [aperto, setAperto] = useState(false)
  const [risposte, setRisposte] = useState<Risposte>(risposteIniziali)
  const [punteggio, setPunteggio] = useState(punteggioSalvato)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  const haDatiLead = useMemo(
    () =>
      Boolean(
        risposteIniziali.indirizzo ||
          risposteIniziali.comune ||
          risposteIniziali.cap ||
          risposteIniziali.provincia,
      ),
    [risposteIniziali],
  )

  const esito = useMemo(() => calcolaPunteggio(definizione, risposte), [definizione, risposte])
  const completezza = useMemo(
    () => calcolaCompletezza(definizione, risposte),
    [definizione, risposte],
  )

  function aggiorna(code: string, valore: Risposta) {
    setRisposte((precedenti) => ({ ...precedenti, [code]: valore }))
  }

  function salva() {
    setMessaggio(null)
    esegui(async () => {
      try {
        const risultato = await savePrequalification({ opportunityId, templateId, risposte })
        if (!risultato.ok) {
          setMessaggio(Object.values(risultato.errors)[0] ?? 'Salvataggio non riuscito.')
          return
        }
        setPunteggio({ punteggio: risultato.data.punteggio, massimo: risultato.data.massimo })
        const parti = [`Salvato. Punteggio ${risultato.data.punteggio}/${risultato.data.massimo}.`]
        if (risultato.data.campiMancanti.length > 0) {
          parti.push(`Non compilati: ${risultato.data.campiMancanti.join(', ')}.`)
        }
        setMessaggio(parti.join(' '))
        avvisa('Prequalifica salvata.')
      } catch (errore) {
        // Prima l'errore veniva ingoiato (useAzioneServer non ha catch) e sembrava
        // «non salva senza motivo». Ora si vede sempre cosa è andato storto.
        console.error('Salvataggio prequalifica fallito:', errore)
        setMessaggio(
          errore instanceof Error
            ? `Salvataggio non riuscito: ${errore.message}`
            : 'Salvataggio non riuscito per un errore imprevisto.',
        )
      }
    })
  }

  if (!aperto) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm">
          {punteggio ? (
            <>
              <span className="font-medium tabular-nums">
                {punteggio.punteggio}/{punteggio.massimo}
              </span>
              <span className="ml-2 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                punteggio di prequalifica
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--testo-tenue)' }}>Non ancora compilata.</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAperto(true)}
          className="bottone-fantasma shrink-0 rounded-lg border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          {punteggio ? 'Rivedi' : 'Compila'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 text-sm">
        <div>
          <span className="font-medium tabular-nums">
            {esito.punteggio}/{esito.massimo}
          </span>
          <span className="ml-2 text-xs" style={{ color: 'var(--testo-tenue)' }}>
            punteggio · {completezza.percentuale}% compilato
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="bottone-fantasma shrink-0 rounded-lg border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Chiudi
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
        Il punteggio ordina le priorità, non decide: la valutazione commerciale resta tua.
        {haDatiLead ? ' Indirizzo e comune dalla scheda lead sono precompilati e modificabili.' : ''}
      </p>

      <Questionario definizione={definizione} risposte={risposte} onChange={aggiorna} />

      {messaggio ? (
        <p
          className="rounded border p-3 text-sm"
          style={{ borderColor: 'var(--bordo)', background: 'rgba(255,255,255,0.04)' }}
        >
          {messaggio}
        </p>
      ) : null}

      <button
        type="button"
        onClick={salva}
        disabled={inCorso}
        className="bottone-oro rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso disabled:opacity-50"
      >
        {inCorso ? 'Salvataggio…' : 'Salva prequalifica'}
      </button>
    </div>
  )
}
