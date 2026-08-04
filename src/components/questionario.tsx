'use client'

import type {
  Campo,
  DefinizioneQuestionario,
  Risposta,
  Risposte,
} from '@/lib/domain/questionnaire'
import { campoVisibile } from '@/lib/domain/questionnaire'

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
}: {
  definizione: DefinizioneQuestionario
  risposte: Risposte
  errori?: Readonly<Record<string, string>>
  soloLettura?: boolean
  onChange: (code: string, valore: Risposta) => void
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
                    campo.type === 'testo_lungo' || campo.type === 'scelta_multipla'
                      ? 'md:col-span-2'
                      : ''
                  }
                >
                  <CampoQuestionario
                    campo={campo}
                    valore={risposte[campo.code]}
                    errore={errori?.[campo.code]}
                    soloLettura={soloLettura ?? false}
                    onChange={(v) => onChange(campo.code, v)}
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
  onChange,
}: {
  campo: Campo
  valore: Risposta
  errore?: string | undefined
  soloLettura: boolean
  onChange: (valore: Risposta) => void
}) {
  const bordo = errore ? '#d92d20' : 'var(--bordo)'
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
      {campo.required ? <span className="text-red-600"> *</span> : null}
    </span>
  )

  const aiuto = campo.help ? (
    <span className="mt-1 block text-xs" style={{ color: 'var(--testo-tenue)' }}>
      {campo.help}
    </span>
  ) : null

  const messaggioErrore = errore ? (
    <span className="mt-1 block text-xs text-red-600">{errore}</span>
  ) : null

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
                borderColor: valore === opzione.v ? 'var(--color-eco-blue-500)' : bordo,
                background:
                  valore === opzione.v ? 'var(--color-eco-blue-50)' : 'var(--superficie)',
                color: valore === opzione.v ? 'var(--color-eco-blue-700)' : 'inherit',
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
          className="w-full rounded-md border px-3 py-2 text-sm"
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
                  borderColor: attivo ? 'var(--color-eco-blue-500)' : bordo,
                  background: attivo ? 'var(--color-eco-blue-50)' : 'var(--superficie)',
                  color: attivo ? 'var(--color-eco-blue-700)' : 'inherit',
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
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={stileInput}
        />
        {aiuto}
        {messaggioErrore}
      </label>
    )
  }

  if (campo.type === 'foto') {
    return (
      <div
        className="rounded-md border border-dashed p-3"
        style={{ borderColor: 'var(--bordo)' }}
      >
        {etichetta}
        <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
          Il caricamento delle fotografie arriva con il modulo documentale.
        </p>
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
          onChange(grezzo)
        }}
        className="w-full rounded-md border px-3 py-2 text-sm"
        style={stileInput}
      />
      {aiuto}
      {messaggioErrore}
    </label>
  )
}
