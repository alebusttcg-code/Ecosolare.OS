'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import type { FotoSopralluogo } from '@/components/carica-foto-sopralluogo'
import { Badge } from '@/components/ui'
import { useAzioneServer } from '@/lib/use-azione-server'
import { Questionario } from '@/components/questionario'
import {
  riallineaGeometriaSopralluogo,
  saveSurvey,
} from '@/lib/actions/questionnaires'
import {
  calcolaCompletezza,
  criticitaRilevate,
  validaRisposte,
  type DefinizioneQuestionario,
  type Risposta,
  type Risposte,
} from '@/lib/domain/questionnaire'

export type SintesiStudioSopralluogo = {
  readonly id: string
  readonly powerKwp: string | null
  readonly formattedAddress: string | null
}

/**
 * Compilazione del sopralluogo.
 *
 * Due pulsanti distinti di proposito: **Salva** non valida nulla (si compila sul
 * tetto, con una mano sola, e perdere il lavoro sarebbe il modo piu' rapido per
 * far tornare tutti alla carta), **Completa** invece e' bloccante.
 *
 * Lo studio tetto Solar e' un passo obbligatorio prima della chiusura: si apre
 * da qui, si salva completo in Sviluppo e si torna con la geometria precompilata.
 */
export function CompilaSopralluogo({
  surveyId,
  opportunityId,
  definizione,
  risposteIniziali,
  studioCompleto = null,
  daPrequalifica,
  daStudioTetto = false,
  noteIniziali,
  completato,
  fotoPerCampo,
}: {
  surveyId: string
  opportunityId: string
  definizione: DefinizioneQuestionario
  risposteIniziali: Risposte
  studioCompleto?: SintesiStudioSopralluogo | null
  daPrequalifica: boolean
  /** Prefill geometria da studio tetto Solar completo sullo stesso lead. */
  daStudioTetto?: boolean
  noteIniziali: string
  completato: boolean
  fotoPerCampo: Readonly<Record<string, readonly FotoSopralluogo[]>>
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [risposte, setRisposte] = useState<Risposte>(risposteIniziali)
  const [note, setNote] = useState(noteIniziali)
  const [errori, setErrori] = useState<Record<string, string>>({})
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  const haStudio = studioCompleto != null
  const hrefSviluppo = useMemo(() => {
    const da = encodeURIComponent(`/agenda/${surveyId}`)
    const base = `/sviluppo?lead=${opportunityId}&da=${da}`
    return studioCompleto ? `${base}&studio=${studioCompleto.id}` : base
  }, [opportunityId, surveyId, studioCompleto])

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

  function riallineaGeometria() {
    esegui(async () => {
      // Prima persiste le risposte correnti (non geometriche), poi sovrascrive
      // la geometria dallo studio fresco — altrimenti si perdono bozze non salvate.
      const bozza = await saveSurvey({
        surveyId,
        risposte,
        notes: note,
        completa: false,
      })
      if (!bozza.ok) {
        setMessaggio(Object.values(bozza.errors)[0] ?? 'Salvataggio non riuscito.')
        return
      }

      const esito = await riallineaGeometriaSopralluogo({ surveyId })
      if (!esito.ok) {
        setMessaggio(Object.values(esito.errors)[0] ?? 'Riallineamento non riuscito.')
        return
      }

      setRisposte(esito.data.risposte)
      const mq = esito.data.superficieUtile
      avvisa(
        mq != null
          ? `Geometria aggiornata dallo studio (${mq.toLocaleString('it-IT')} mq utili).`
          : 'Geometria aggiornata dallo studio tetto.',
      )
      setMessaggio(null)
      router.refresh()
    })
  }

  function salva(completa: boolean) {
    setMessaggio(null)
    setErrori({})
    esegui(async () => {
      const esito = await saveSurvey({ surveyId, risposte, notes: note, completa })

      if (!esito.ok) {
        setMessaggio(Object.values(esito.errors)[0] ?? 'Salvataggio non riuscito.')
        return
      }

      if (esito.data.completato) {
        setMessaggio('Sopralluogo completato. È stata creata l’attività per il preventivo.')
        avvisa('Sopralluogo completato.')
        router.refresh()
        return
      }

      if (completa && esito.data.mancaStudioTetto) {
        setMessaggio(
          'Salvato in bozza. Per chiudere serve uno studio tetto completo: aprilo da Sviluppo e torna qui.',
        )
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
      avvisa('Bozza salvata.', 'info')
    })
  }

  const kwp =
    studioCompleto?.powerKwp != null && studioCompleto.powerKwp !== ''
      ? Number.parseFloat(studioCompleto.powerKwp)
      : NaN

  return (
    <div className="space-y-6">
      <section
        className="rounded-lg border p-4 sm:p-5"
        style={{
          background: 'rgba(5,10,20,0.55)',
          borderColor: haStudio
            ? 'rgba(74, 166, 122, 0.35)'
            : 'rgba(217,164,65,0.42)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Studio tetto</h2>
              <Badge tone={haStudio ? 'positivo' : 'attenzione'}>
                {haStudio ? 'Completo' : 'Da fare'}
              </Badge>
            </div>
            {haStudio ? (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
                {Number.isFinite(kwp) ? `${kwp.toLocaleString('it-IT', { maximumFractionDigits: 2 })} kWp` : 'Studio salvato'}
                {studioCompleto.formattedAddress
                  ? ` · ${studioCompleto.formattedAddress}`
                  : ''}
                . Tipologia, orientamento, inclinazione, superficie e potenza sono
                precompilati e restano modificabili.
              </p>
            ) : (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
                Apri Sviluppo, analizza il tetto e salva lo studio come completo.
                Senza questo passaggio non puoi chiudere il sopralluogo; la bozza e
                il rilievo (manto, amianto, foto…) restano possibili.
              </p>
            )}
          </div>
          {!completato ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={hrefSviluppo}
                className="bottone-oro inline-flex rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso"
              >
                Apri Sviluppo
              </Link>
              {haStudio ? (
                <button
                  type="button"
                  onClick={riallineaGeometria}
                  disabled={inCorso}
                  className="bottone-fantasma rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                  style={{ borderColor: 'var(--bordo)' }}
                >
                  {inCorso ? 'Riallineamento…' : 'Riallinea geometria'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <div
        className="flex flex-wrap items-center gap-4 rounded-lg border p-4 text-sm"
        style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
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
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <div
              className="h-full rounded"
              style={{
                width: `${completezza.percentuale}%`,
                background:
                  mancanti.length === 0 && haStudio
                    ? 'var(--color-eco-green-400)'
                    : 'var(--color-eco-blue-400)',
              }}
            />
          </div>
        </div>
        {!haStudio ? (
          <span className="text-xs" style={{ color: 'var(--color-eco-gold-300)' }}>
            Studio tetto mancante
          </span>
        ) : mancanti.length > 0 ? (
          <span className="text-xs" style={{ color: 'var(--color-eco-gold-300)' }}>
            {mancanti.length} obbligatori mancanti
          </span>
        ) : (
          <span className="text-xs" style={{ color: 'var(--color-eco-green-400)' }}>
            Pronto per la chiusura
          </span>
        )}
      </div>

      {criticita.length > 0 ? (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: 'rgba(217,164,65,0.42)', background: 'rgba(217,164,65,0.08)', color: '#e8c765' }}
        >
          <strong>Criticità rilevate:</strong> {criticita.map((c) => c.label).join(', ')}.
          Verranno riportate nell’attività di preventivazione.
        </div>
      ) : null}

      {daStudioTetto && !completato ? (
        <p
          className="rounded-lg border p-3 text-xs leading-relaxed"
          style={{
            borderColor: 'rgba(217,164,65,0.35)',
            background: 'rgba(217,164,65,0.08)',
            color: 'var(--testo-tenue)',
          }}
        >
          Tipologia, orientamento, inclinazione, superficie utile e potenza stimata arrivano
          dallo studio tetto Solar. Verifica sul posto: manto, stato, amianto, ombre e
          foto restano da rilevare qui. Se hai rivisto lo studio, usa «Riallinea geometria».
        </p>
      ) : null}
      {daPrequalifica && !completato ? (
        <p
          className="rounded-lg border p-3 text-xs leading-relaxed"
          style={{
            borderColor: 'rgba(91,155,213,0.28)',
            background: 'rgba(63,127,196,0.08)',
            color: 'var(--testo-tenue)',
          }}
        >
          {daStudioTetto
            ? 'Altri campi (ombre, accumulo, …) possono arrivare dalla prequalifica: verifica e correggi se serve.'
            : 'Tetto, superficie, ombre e accumulo arrivano dalla prequalifica del lead: verifica sul posto e correggi se serve prima di chiudere.'}
        </p>
      ) : null}

      <div
        className="rounded-lg border p-6"
        style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
      >
        <Questionario
          definizione={definizione}
          risposte={risposte}
          errori={errori}
          soloLettura={completato}
          surveyId={surveyId}
          fotoPerCampo={fotoPerCampo}
          onChange={aggiorna}
        />

        <label className="mt-8 block">
          <span className="mb-1 block text-sm font-medium">Note generali</span>
          <textarea
            rows={3}
            value={note}
            disabled={completato}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
          />
        </label>
      </div>

      {messaggio ? (
        <p
          className="rounded-lg border p-3 text-sm"
          style={{ borderColor: 'var(--bordo)', background: 'rgba(255,255,255,0.04)' }}
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
            className="bottone-fantasma rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: 'var(--bordo)' }}
          >
            {inCorso ? 'Salvataggio…' : 'Salva bozza'}
          </button>
          <button
            type="button"
            onClick={() => salva(true)}
            disabled={inCorso || !haStudio}
            className="bottone-oro rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso disabled:opacity-50"
          >
            Completa sopralluogo
          </button>
          {!haStudio ? (
            <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
              La chiusura richiede uno studio tetto completo in Sviluppo.
            </span>
          ) : mancanti.length > 0 ? (
            <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
              La chiusura richiede: {mancanti.map((m) => m.label).join(', ')}.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
