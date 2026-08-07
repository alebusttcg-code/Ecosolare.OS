'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { completeActivity } from '@/lib/actions/activities'

const TIPI = [
  { value: 'chiamata', label: 'Chiamata' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'appuntamento', label: 'Appuntamento' },
  { value: 'sopralluogo', label: 'Sopralluogo' },
  { value: 'task', label: 'Attività' },
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
  const router = useRouter()
  const avvisa = useAvvisi()
  const [aperto, setAperto] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs font-medium"
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
          if (esito.ok) {
            avvisa('Attività completata.')
            setAperto(false)
            router.refresh()
          } else setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
        })
      }}
      className="mt-3 space-y-3 rounded-md border p-3"
      style={{ borderColor: 'var(--bordo)', background: 'rgba(255,255,255,0.04)' }}
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium">Esito</span>
        <input
          name="outcome"
          placeholder="Com’è andata?"
          className="w-full rounded-md border px-2 py-1.5 text-sm transition-colors duration-200 outline-none focus:border-eco-blue-400"
          style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
        />
      </label>

      {richiedeProssima ? (
        <div className="space-y-3 border-t pt-3" style={{ borderColor: 'var(--bordo)' }}>
          <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
            Il lead è ancora aperto: indica la prossima azione.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              name="kind"
              className="rounded border px-2 py-1.5 text-sm"
              style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
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
              className="rounded border px-2 py-1.5 text-sm sm:col-span-2"
              style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
            />
          </div>
          <input
            name="dueAt"
            type="date"
            required
            defaultValue={fraGiorni(2)}
            className="w-full rounded border px-2 py-1.5 text-sm sm:w-auto"
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
          />
        </div>
      ) : null}

      {errore ? <p className="text-xs text-eco-red-400">{errore}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={inCorso}
          className="bottone-oro rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-3 py-1.5 text-xs font-semibold text-eco-abisso"
        >
          {inCorso ? 'Salvataggio…' : 'Conferma'}
        </button>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Annulla
        </button>
      </div>
    </form>
  )
}
