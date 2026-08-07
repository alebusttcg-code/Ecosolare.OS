'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { changeStage } from '@/lib/actions/opportunities'
import type { StageDefinition } from '@/lib/domain/pipeline'

function fraGiorni(giorni: number): string {
  return new Date(Date.now() + giorni * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Cambio di stato.
 *
 * Gli errori mostrati qui non sono validazioni di modulo: sono gli invarianti
 * di dominio calcolati dal backend (prossima azione obbligatoria, motivo di
 * perdita obbligatorio). Il modulo si limita a chiedere cio' che manca.
 */
export function CambiaStato({
  opportunityId,
  statoCorrente,
  stages,
}: {
  opportunityId: string
  statoCorrente: string
  stages: readonly StageDefinition[]
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [destinazione, setDestinazione] = useState(statoCorrente)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [inCorso, avvia] = useTransition()

  const stato = stages.find((s) => s.code === destinazione)
  const serveMotivo = stato?.isLost ?? false
  const serveProssimaAzione = (stato?.isOpen ?? false) && destinazione !== statoCorrente

  return (
    <form
      action={(formData) => {
        setErrors({})
        avvia(async () => {
          const scadenza = String(formData.get('nextActionDueAt') ?? '')
          const esito = await changeStage({
            opportunityId,
            toStage: destinazione,
            nextActionDueAt: scadenza ? new Date(`${scadenza}T09:00:00`) : undefined,
            lostReason: String(formData.get('lostReason') ?? '') || undefined,
            note: String(formData.get('note') ?? '') || undefined,
          })
          if (!esito.ok) {
            setErrors(esito.errors)
            return
          }
          avvisa('Stato aggiornato.')
          router.refresh()
        })
      }}
      className="space-y-3"
    >
      <select
        value={destinazione}
        onChange={(e) => setDestinazione(e.target.value)}
        className="w-full rounded border px-3 py-2 text-sm"
        style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
      >
        {stages
          .filter((s) => s.isActive || s.code === statoCorrente)
          .map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
      </select>

      {serveProssimaAzione ? (
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Prossima azione entro</span>
          <input
            name="nextActionDueAt"
            type="date"
            defaultValue={fraGiorni(2)}
            className="w-full rounded border px-3 py-2 text-sm"
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
          />
        </label>
      ) : null}

      {serveMotivo ? (
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Motivo della perdita</span>
          <input
            name="lostReason"
            required
            placeholder="Prezzo, tempi, concorrente…"
            className="w-full rounded border px-3 py-2 text-sm"
            style={{
              background: 'var(--superficie)',
              borderColor: errors.lostReason ? 'var(--color-eco-red-400)' : 'var(--bordo)',
            }}
          />
        </label>
      ) : null}

      <input
        name="note"
        placeholder="Nota (facoltativa)"
        className="w-full rounded border px-3 py-2 text-sm"
        style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
      />

      {Object.values(errors).map((messaggio) => (
        <p key={messaggio} className="text-xs text-eco-red-400">
          {messaggio}
        </p>
      ))}

      <button
        type="submit"
        disabled={inCorso || destinazione === statoCorrente}
        className="w-full rounded-md bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso disabled:opacity-40"
      >
        {inCorso ? 'Aggiornamento…' : 'Aggiorna stato'}
      </button>
    </form>
  )
}
