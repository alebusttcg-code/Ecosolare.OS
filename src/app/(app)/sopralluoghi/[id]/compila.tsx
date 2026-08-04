'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Questionario } from '@/components/questionario'
import { saveSurvey } from '@/lib/actions/questionnaires'
import {
  calcolaCompletezza,
  criticitaRilevate,
  validaRisposte,
  type DefinizioneQuestionario,
  type Risposta,
  type Risposte,
} from '@/lib/domain/questionnaire'

/**
 * Compilazione del sopralluogo.
 *
 * Due pulsanti distinti di proposito: **Salva** non valida nulla (si compila sul
 * tetto, con una mano sola, e perdere il lavoro sarebbe il modo piu' rapido per
 * far tornare tutti alla carta), **Completa** invece e' bloccante.
 */
export function CompilaSopralluogo({
  surveyId,
  definizione,
  risposteIniziali,
  noteIniziali,
  completato,
}: {
  surveyId: string
  definizione: DefinizioneQuestionario
  risposteIniziali: Risposte
  noteIniziali: string
  completato: boolean
}) {
  const router = useRouter()
  const [risposte, setRisposte] = useState<Risposte>(risposteIniziali)
  const [note, setNote] = useState(noteIniziali)
  const [errori, setErrori] = useState<Record<string, string>>({})
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  const completezza = useMemo(
    () => calcolaCompletezza(definizione, risposte),
    [definizione, risposte],
  )
  const criticita = useMemo(
    () => criticitaRilevate(definizione, risposte),
    [definizione, risposte],
  )
  const mancanti = useMemo(
    () => validaRisposte(definizione, risposte).filter((v) => v.codice === 'obbligatorio'),
    [definizione, risposte],
  )

  function aggiorna(code: string, valore: Risposta) {
    setRisposte((precedenti) => ({ ...precedenti, [code]: valore }))
    // L'errore su un campo sparisce appena lo si corregge: lasciarlo acceso
    // mentre l'utente sta rimediando e' solo rumore.
    setErrori((precedenti) => {
      if (!precedenti[code]) return precedenti
      return Object.fromEntries(Object.entries(precedenti).filter(([k]) => k !== code))
    })
  }

  function salva(completa: boolean) {
    setMessaggio(null)
    setErrori({})
    avvia(async () => {
      const esito = await saveSurvey({ surveyId, risposte, notes: note, completa })

      if (!esito.ok) {
        setMessaggio(Object.values(esito.errors)[0] ?? 'Salvataggio non riuscito.')
        return
      }

      if (esito.data.completato) {
        setMessaggio('Sopralluogo completato. È stata creata l attività per il preventivo.')
        router.refresh()
        return
      }

      if (completa && esito.data.violazioni.length > 0) {
        const perCampo: Record<string, string> = {}
        for (const v of esito.data.violazioni) perCampo[v.campo] = v.messaggio
        setErrori(perCampo)
        setMessaggio(
          `Salvato in bozza. Mancano ${esito.data.violazioni.length} dati obbligatori per chiudere il sopralluogo.`,
        )
        return
      }

      setMessaggio(`Salvato in bozza. Completamento al ${esito.data.percentuale}%.`)
    })
  }

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center gap-4 rounded-lg border p-4 text-sm"
        style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
      >
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: 'var(--testo-tenue)' }}>
              Completamento {completezza.compilati}/{completezza.totali}
            </span>
            <span className="tabular-nums">{completezza.percentuale}%</span>
          </div>
          <div
            className="mt-1 h-2 overflow-hidden rounded"
            style={{ background: 'var(--sfondo)' }}
          >
            <div
              className="h-full rounded"
              style={{
                width: `${completezza.percentuale}%`,
                background:
                  mancanti.length === 0
                    ? 'var(--color-eco-green-500)'
                    : 'var(--color-eco-blue-500)',
              }}
            />
          </div>
        </div>
        {mancanti.length > 0 ? (
          <span className="text-xs" style={{ color: '#b54708' }}>
            {mancanti.length} obbligatori mancanti
          </span>
        ) : (
          <span className="text-xs" style={{ color: '#2b6a25' }}>
            Pronto per la chiusura
          </span>
        )}
      </div>

      {criticita.length > 0 ? (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: '#e8b924', background: '#fdf9ec', color: '#7a5c00' }}
        >
          <strong>Criticità rilevate:</strong> {criticita.map((c) => c.label).join(', ')}.
          Verranno riportate nell attività di preventivazione.
        </div>
      ) : null}

      <div
        className="rounded-lg border p-6"
        style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
      >
        <Questionario
          definizione={definizione}
          risposte={risposte}
          errori={errori}
          soloLettura={completato}
          onChange={aggiorna}
        />

        <label className="mt-8 block">
          <span className="mb-1 block text-sm font-medium">Note generali</span>
          <textarea
            rows={3}
            value={note}
            disabled={completato}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
          />
        </label>
      </div>

      {messaggio ? (
        <p
          className="rounded-lg border p-3 text-sm"
          style={{ borderColor: 'var(--bordo)', background: 'var(--sfondo)' }}
        >
          {messaggio}
        </p>
      ) : null}

      {!completato ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => salva(false)}
            disabled={inCorso}
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: 'var(--bordo)' }}
          >
            {inCorso ? 'Salvataggio…' : 'Salva bozza'}
          </button>
          <button
            type="button"
            onClick={() => salva(true)}
            disabled={inCorso}
            className="rounded-md bg-eco-blue-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Completa sopralluogo
          </button>
          {mancanti.length > 0 ? (
            <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
              La chiusura richiede: {mancanti.map((m) => m.label).join(', ')}.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
