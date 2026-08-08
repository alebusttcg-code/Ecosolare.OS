'use client'

import type {
  Campo,
  DefinizioneQuestionario,
  Risposta,
  Risposte,
} from '@/lib/domain/questionnaire'
import { campoVisibile } from '@/lib/domain/questionnaire'
import {
  CaricaFotoSopralluogo,
  type FotoSopralluogo,
} from '@/components/carica-foto-sopralluogo'
import { normalizzaPod, POD_LUNGHEZZA_MAX } from '@/lib/domain/pod'

/**
 * Renderer dei questionari condizionali.
 *
 * Usa lo stesso modulo puro del server per decidere quali campi mostrare: la
 * visibilita' non puo' divergere fra cio' che si compila e cio' che si valida.
 */
export function Questionario({
  definizione,
  risposte,
  errori,
  soloLettura,
  onChange,
  surveyId,
  fotoPerCampo,
}: {
  definizione: DefinizioneQuestionario
  risposte: Risposte
  errori?: Readonly<Record<string, string>>
  soloLettura?: boolean
  onChange: (code: string, valore: Risposta) => void
  /** Obbligatorio per i campi `foto` del sopralluogo. */
  surveyId?: string
  fotoPerCampo?: Readonly<Record<string, readonly FotoSopralluogo[]>>
}) {
  return (
    <div className="space-y-8">
      {definizione.sections.map((sezione) => {
        const campi = sezione.fields.filter((c) => campoVisibile(c, risposte))
        if (campi.length === 0) return null

        return (
          <section key={sezione.code}>
            <h3 className="text-sm font-semibold">{sezione.label}</h3>
            {sezione.description ? (
              <p className="mt-1 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                {sezione.description}
              </p>
            ) : null}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {campi.map((campo) => (
                <div
                  key={campo.code}
                  className={
                    campo.type === 'testo_lungo' ||
                    campo.type === 'scelta_multipla' ||
                    campo.type === 'foto'
                      ? 'md:col-span-2'
                      : ''
                  }
                >
                  <CampoQuestionario
                    campo={campo}
                    valore={risposte[campo.code]}
                    errore={errori?.[campo.code]}
                    soloLettura={soloLettura ?? false}
                    surveyId={surveyId}
                    foto={fotoPerCampo?.[campo.code]}
                    onChange={(v) => onChange(campo.code, v)}
                    onFotoCaricata={(id) => {
                      const ids = Array.isArray(risposte[campo.code])
                        ? (risposte[campo.code] as string[])
                        : []
                      if (ids.includes(id)) return
                      onChange(campo.code, [...ids, id])
                    }}
                    onFotoEliminata={(id) => {
                      const ids = Array.isArray(risposte[campo.code])
                        ? (risposte[campo.code] as string[]).filter((v) => v !== id)
                        : []
                      onChange(campo.code, ids.length > 0 ? ids : null)
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function CampoQuestionario({
  campo,
  valore,
  errore,
  soloLettura,
  surveyId,
  foto,
  onChange,
  onFotoCaricata,
  onFotoEliminata,
}: {
  campo: Campo
  valore: Risposta
  errore?: string | undefined
  soloLettura: boolean
  surveyId?: string
  foto?: readonly FotoSopralluogo[]
  onChange: (valore: Risposta) => void
  onFotoCaricata?: (fileId: string) => void
  onFotoEliminata?: (fileId: string) => void
}) {
  const bordo = errore ? 'var(--color-eco-red-400)' : 'var(--bordo)'
  const stileInput = {
    background: 'var(--superficie)',
    borderColor: bordo,
  }

  const etichetta = (
    <span className="mb-1 block text-sm font-medium">
      {campo.label}
      {campo.unit ? (
        <span className="font-normal" style={{ color: 'var(--testo-tenue)' }}>
          {' '}
          ({campo.unit})
        </span>
      ) : null}
      {campo.required ? <span className="text-eco-red-400"> *</span> : null}
    </span>
  )

  const aiuto = campo.help ? (
    <span className="mt-1 block text-xs" style={{ color: 'var(--testo-tenue)' }}>
      {campo.help}
    </span>
  ) : null

  const messaggioErrore = errore ? (
    <span className="mt-1 block text-xs text-eco-red-400">{errore}</span>
  ) : null

  const ePod = campo.format === 'pod' || campo.code === 'pod'

  if (campo.type === 'booleano') {
    return (
      <div>
        {etichetta}
        <div className="flex gap-2">
          {[
            { v: true, l: 'Sì' },
            { v: false, l: 'No' },
          ].map((opzione) => (
            <button
              key={String(opzione.v)}
              type="button"
              disabled={soloLettura}
              onClick={() => onChange(valore === opzione.v ? null : opzione.v)}
              className="rounded-md border px-4 py-1.5 text-sm"
              style={{
                borderColor: valore === opzione.v ? 'var(--color-eco-blue-400)' : bordo,
                background:
                  valore === opzione.v ? 'rgba(63,127,196,0.16)' : 'var(--superficie)',
                color: valore === opzione.v ? 'var(--color-eco-blue-300)' : 'inherit',
              }}
            >
              {opzione.l}
            </button>
          ))}
        </div>
        {aiuto}
        {messaggioErrore}
      </div>
    )
  }

  if (campo.type === 'scelta') {
    return (
      <label className="block">
        {etichetta}
        <select
          value={typeof valore === 'string' ? valore : ''}
          disabled={soloLettura}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
          style={stileInput}
        >
          <option value="">—</option>
          {campo.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {aiuto}
        {messaggioErrore}
      </label>
    )
  }

  if (campo.type === 'scelta_multipla') {
    const selezionati = Array.isArray(valore) ? valore : []
    return (
      <div>
        {etichetta}
        <div className="flex flex-wrap gap-2">
          {campo.options?.map((o) => {
            const attivo = selezionati.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                disabled={soloLettura}
                onClick={() =>
                  onChange(
                    attivo
                      ? selezionati.filter((v) => v !== o.value)
                      : [...selezionati, o.value],
                  )
                }
                className="rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: attivo ? 'var(--color-eco-blue-400)' : bordo,
                  background: attivo ? 'rgba(63,127,196,0.16)' : 'var(--superficie)',
                  color: attivo ? 'var(--color-eco-blue-300)' : 'inherit',
                }}
              >
                {o.label}
              </button>
            )
          })}
        </div>
        {aiuto}
        {messaggioErrore}
      </div>
    )
  }

  if (campo.type === 'testo_lungo') {
    return (
      <label className="block">
        {etichetta}
        <textarea
          rows={3}
          value={typeof valore === 'string' ? valore : ''}
          disabled={soloLettura}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
          style={stileInput}
        />
        {aiuto}
        {messaggioErrore}
      </label>
    )
  }

  if (campo.type === 'foto') {
    if (!surveyId) {
      return (
        <div
          className="rounded-md border border-dashed p-3"
          style={{ borderColor: 'var(--bordo)' }}
        >
          {etichetta}
          <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
            Caricamento fotografie non disponibile in questo contesto.
          </p>
        </div>
      )
    }

    return (
      <div
        className="rounded-md border border-dashed p-3"
        style={{ borderColor: bordo, background: 'rgba(5,10,20,0.35)' }}
      >
        {etichetta}
        {aiuto}
        <CaricaFotoSopralluogo
          surveyId={surveyId}
          fieldCode={campo.code}
          files={foto ?? []}
          disabled={soloLettura}
          onCaricata={onFotoCaricata}
          onEliminata={onFotoEliminata}
        />
        {messaggioErrore}
      </div>
    )
  }

  return (
    <label className="block">
      {etichetta}
      <input
        type={campo.type === 'numero' ? 'number' : campo.type === 'data' ? 'date' : 'text'}
        step={campo.type === 'numero' ? 'any' : undefined}
        min={campo.min}
        max={campo.max}
        maxLength={ePod ? POD_LUNGHEZZA_MAX : undefined}
        placeholder={ePod ? 'IT001E12345678' : undefined}
        autoCapitalize={ePod ? 'characters' : undefined}
        spellCheck={ePod ? false : undefined}
        value={
          valore === null || valore === undefined || Array.isArray(valore)
            ? ''
            : String(valore)
        }
        disabled={soloLettura}
        onChange={(e) => {
          const grezzo = e.target.value
          if (grezzo === '') return onChange(null)
          if (campo.type === 'numero') {
            const n = Number.parseFloat(grezzo)
            return onChange(Number.isFinite(n) ? n : grezzo)
          }
          if (ePod) return onChange(normalizzaPod(grezzo) || null)
          onChange(grezzo)
        }}
        className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
        style={stileInput}
      />
      {aiuto}
      {messaggioErrore}
    </label>
  )
}
