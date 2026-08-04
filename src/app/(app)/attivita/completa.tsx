'use client'

import { useState, useTransition } from 'react'
import { completeActivity } from '@/lib/actions/activities'

const TIPI = [
  { value: 'chiamata', label: 'Chiamata' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'appuntamento', label: 'Appuntamento' },
  { value: 'sopralluogo', label: 'Sopralluogo' },
  { value: 'task', label: 'Attivita' },
] as const

function fraGiorni(giorni: number): string {
  const data = new Date(Date.now() + giorni * 86_400_000)
  return data.toISOString().slice(0, 10)
}

/**
 * Chiusura di un'attivita'.
 *
 * Se l'attivita' e' la prossima azione di un'opportunita' aperta, il modulo
 * chiede contestualmente quella successiva: e' il punto in cui la regola
 * "nessuna opportunita senza prossima azione" diventa un fatto invece che
 * un buon proposito.
 */
export function CompletaAttivita({
  activityId,
  richiedeProssima,
}: {
  activityId: string
  richiedeProssima: boolean
}) {
  const [aperto, setAperto] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="rounded border px-3 py-1 text-xs font-medium"
        style={{ borderColor: 'var(--bordo)' }}
      >
        Completa
      </button>
    )
  }

  return (
    <form
      action={(formData) => {
        setErrore(null)
        avvia(async () => {
          const scadenza = String(formData.get('dueAt') ?? '')
          const esito = await completeActivity({
            activityId,
            outcome: String(formData.get('outcome') ?? '') || undefined,
            prossima: richiedeProssima
              ? {
                  kind: String(formData.get('kind') ?? 'chiamata') as 'chiamata',
                  subject: String(formData.get('subject') ?? ''),
                  dueAt: new Date(`${scadenza}T09:00:00`),
                }
              : undefined,
          })
          if (esito.ok) setAperto(false)
          else setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
        })
      }}
      className="mt-3 space-y-3 rounded-md border p-3"
      style={{ borderColor: 'var(--bordo)', background: 'var(--sfondo)' }}
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium">Esito</span>
        <input
          name="outcome"
          placeholder="Com'e andata?"
          className="w-full rounded border px-2 py-1.5 text-sm"
          style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
        />
      </label>

      {richiedeProssima ? (
        <div className="space-y-3 border-t pt-3" style={{ borderColor: 'var(--bordo)' }}>
          <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
            L&apos;opportunita e ancora aperta: indica la prossima azione.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <select
              name="kind"
              className="rounded border px-2 py-1.5 text-sm"
              style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
            >
              {TIPI.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              name="subject"
              required
              placeholder="Cosa fare"
              className="col-span-2 rounded border px-2 py-1.5 text-sm"
              style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
            />
          </div>
          <input
            name="dueAt"
            type="date"
            required
            defaultValue={fraGiorni(2)}
            className="rounded border px-2 py-1.5 text-sm"
            style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
          />
        </div>
      ) : null}

      {errore ? <p className="text-xs text-red-600">{errore}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={inCorso}
          className="rounded bg-eco-blue-500 px-3 py-1.5 text-xs font-medium text-white"
        >
          {inCorso ? 'Salvataggio…' : 'Conferma'}
        </button>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="rounded border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Annulla
        </button>
      </div>
    </form>
  )
}
