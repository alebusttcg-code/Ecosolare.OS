'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { accedi } from '@/lib/actions/auth'
import { useAzioneServer } from '@/lib/use-azione-server'

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
  /**
   * Al secondo passaggio la password serve di nuovo: si rimanda tutto insieme.
   * È il prezzo per non avere in giro uno stato «mezzo autenticato», che
   * sarebbe una cosa in più da proteggere e da far scadere.
   */
  const [password, setPassword] = useState('')
  const [chiedeCodice, setChiedeCodice] = useState(false)
  const { inCorso, esegui } = useAzioneServer()

  return (
    <form
      action={(formData) => {
        setErrore(null)
        esegui(async () => {
          const codice = String(formData.get('codice') ?? '').trim()
          const esito = await accedi({
            email,
            password,
            ...(codice ? { codice } : {}),
          })

          if (!esito.ok) {
            setErrore(esito.errors.codice ?? esito.errors._ ?? 'Accesso non riuscito.')
            return
          }

          if (esito.data.richiedeCodice) {
            setChiedeCodice(true)
            return
          }

          // `refresh` prima di navigare: senza, la cache del router servirebbe
          // ancora la versione della pagina vista da non collegati.
          router.refresh()
          router.replace(
            esito.data.deveCambiarePassword
              ? '/cambia-password'
              : esito.data.destinazione,
          )
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

      {chiedeCodice ? (
        <>
          <p className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
            Scrivi il codice a sei cifre dell&apos;app di autenticazione. Se hai perso
            il telefono, va bene anche uno dei codici di recupero.
          </p>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Codice</span>
            <input
              name="codice"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              className={`${CAMPO} font-mono tracking-[0.3em]`}
              style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
            />
          </label>
        </>
      ) : (
        <>
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={CAMPO}
              style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
            />
          </label>
        </>
      )}

      <button
        type="submit"
        disabled={inCorso}
        className="bottone-oro w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        style={{
          background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
          color: '#050a14',
        }}
      >
        {inCorso ? 'Verifica…' : chiedeCodice ? 'Conferma' : 'Accedi'}
      </button>

      {chiedeCodice ? (
        <button
          type="button"
          onClick={() => {
            setChiedeCodice(false)
            setErrore(null)
            setPassword('')
          }}
          className="w-full text-center text-xs underline"
          style={{ color: 'var(--testo-fioco)' }}
        >
          Torna indietro
        </button>
      ) : null}
    </form>
  )
}
