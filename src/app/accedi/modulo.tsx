'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { accedi } from '@/lib/actions/auth'

const CAMPO =
  'w-full rounded-lg border px-3 py-2.5 text-sm transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]'

export function ModuloAccesso() {
  const router = useRouter()
  const [errore, setErrore] = useState<string | null>(null)
  /**
   * React azzera i campi non controllati quando una `action` di form termina.
   * Per la password è quello che si vuole; per l'email no: dopo un errore di
   * battitura si finirebbe a riscrivere ogni volta anche l'indirizzo giusto.
   */
  const [email, setEmail] = useState('')
  const [inCorso, avvia] = useTransition()

  return (
    <form
      action={(formData) => {
        setErrore(null)
        avvia(async () => {
          const esito = await accedi({
            email,
            password: String(formData.get('password') ?? ''),
          })

          if (!esito.ok) {
            setErrore(esito.errors._ ?? 'Accesso non riuscito.')
            return
          }

          // `refresh` prima di navigare: senza, la cache del router servirebbe
          // ancora la versione della pagina vista da non collegati.
          router.refresh()
          router.replace(esito.data.deveCambiarePassword ? '/cambia-password' : '/')
        })
      }}
      className="mt-6 space-y-4"
    >
      {/*
        Il contenitore c'è sempre, anche vuoto: `aria-live` annuncia solo i
        cambiamenti dentro un elemento già presente. Se comparisse insieme al
        messaggio, chi usa un lettore di schermo non sentirebbe nulla.
      */}
      <div aria-live="polite">
        {errore ? (
          <p
            className="rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: 'rgba(224,133,133,0.4)',
              background: 'rgba(224,133,133,0.08)',
              color: '#e8a0a0',
            }}
            role="alert"
          >
            {errore}
          </p>
        ) : null}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={CAMPO}
          style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={CAMPO}
          style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
        />
      </label>

      <button
        type="submit"
        disabled={inCorso}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
          color: '#050a14',
        }}
      >
        {inCorso ? 'Verifica…' : 'Accedi'}
      </button>
    </form>
  )
}
