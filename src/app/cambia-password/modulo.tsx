'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { cambiaPassword } from '@/lib/actions/auth'
import { LUNGHEZZA_MINIMA_PASSWORD } from '@/lib/auth/password'

const CAMPO =
  'w-full rounded-lg border px-3 py-2.5 text-sm transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]'

export function ModuloCambioPassword() {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [inCorso, avvia] = useTransition()

  return (
    <form
      action={(formData) => {
        setErrors({})
        avvia(async () => {
          const esito = await cambiaPassword({
            corrente: String(formData.get('corrente') ?? ''),
            nuova: String(formData.get('nuova') ?? ''),
            conferma: String(formData.get('conferma') ?? ''),
          })

          if (!esito.ok) {
            setErrors(esito.errors)
            return
          }

          // Il cambio chiude tutte le sessioni, compresa questa: l'unica
          // destinazione possibile è il modulo di accesso.
          router.refresh()
          router.replace('/accedi')
        })
      }}
      className="mt-6 space-y-4"
    >
      {/* Sempre presente perché `aria-live` funzioni: vedere `accedi/modulo.tsx`. */}
      <div aria-live="polite">
        {errors._ ? (
          <p
            className="rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: 'rgba(224,133,133,0.4)',
              background: 'rgba(224,133,133,0.08)',
              color: '#e8a0a0',
            }}
            role="alert"
          >
            {errors._}
          </p>
        ) : null}
      </div>

      <Campo
        nome="corrente"
        etichetta="Password attuale"
        autoComplete="current-password"
        errore={errors.corrente}
      />
      <Campo
        nome="nuova"
        etichetta="Nuova password"
        autoComplete="new-password"
        errore={errors.nuova}
        aiuto={`Almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri. Una frase che ricordi è più sicura di una parola con i simboli.`}
      />
      <Campo
        nome="conferma"
        etichetta="Ripeti la nuova password"
        autoComplete="new-password"
        errore={errors.conferma}
      />

      <button
        type="submit"
        disabled={inCorso}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
          color: '#050a14',
        }}
      >
        {inCorso ? 'Salvataggio…' : 'Cambia password'}
      </button>
    </form>
  )
}

function Campo({
  nome,
  etichetta,
  autoComplete,
  errore,
  aiuto,
}: {
  nome: string
  etichetta: string
  autoComplete: string
  errore?: string | undefined
  aiuto?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{etichetta}</span>
      <input
        name={nome}
        type="password"
        autoComplete={autoComplete}
        required
        className={CAMPO}
        style={{
          background: 'var(--superficie)',
          borderColor: errore ? 'var(--color-eco-red-400)' : 'var(--bordo)',
        }}
      />
      {errore ? (
        <span className="mt-1 block text-xs text-eco-red-400">{errore}</span>
      ) : aiuto ? (
        <span className="mt-1 block text-xs" style={{ color: 'var(--testo-tenue)' }}>
          {aiuto}
        </span>
      ) : null}
    </label>
  )
}
