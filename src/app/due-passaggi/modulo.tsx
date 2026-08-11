'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import {
  attivaMfa,
  disattivaMfa,
  preparaMfa,
  rigeneraCodiciRecupero,
} from '@/lib/actions/mfa'

const CAMPO =
  'w-full rounded-lg border px-3 py-2.5 text-sm transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]'

const BOTTONE_ORO =
  'rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso disabled:opacity-60'

export function ModuloDuePassaggi({
  attiva,
  obbligatoria,
  email,
}: {
  attiva: boolean
  obbligatoria: boolean
  email: string
}) {
  const [codici, setCodici] = useState<string[] | null>(null)

  if (codici) {
    return <CodiciRecupero codici={codici} onChiudi={() => setCodici(null)} />
  }

  if (attiva) {
    return (
      <GiaAttiva
        obbligatoria={obbligatoria}
        onNuoviCodici={(c) => setCodici(c)}
      />
    )
  }

  return <Attivazione email={email} onAttivata={(c) => setCodici(c)} />
}

/* -------------------------------------------------------------------------- */

function Attivazione({
  email,
  onAttivata,
}: {
  email: string
  onAttivata: (codici: string[]) => void
}) {
  const [segreto, setSegreto] = useState<{ leggibile: string; uri: string } | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [erroreCodice, setErroreCodice] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  // Il segreto si prepara all'apertura della pagina: chiederlo con un pulsante
  // aggiungerebbe un passaggio a un'operazione che è già percepita come noiosa.
  useEffect(() => {
    let annullato = false
    void preparaMfa().then((esito) => {
      if (annullato) return
      if (esito.ok) setSegreto({ leggibile: esito.data.segretoLeggibile, uri: esito.data.uri })
      else setErrore(esito.errors._ ?? 'Preparazione non riuscita.')
    })
    return () => {
      annullato = true
    }
  }, [])

  if (errore) {
    return (
      <p
        className="mt-6 rounded-lg border px-4 py-3 text-sm"
        style={{
          borderColor: 'rgba(224,133,133,0.4)',
          background: 'rgba(224,133,133,0.08)',
          color: '#e8a0a0',
        }}
      >
        {errore}
      </p>
    )
  }

  if (!segreto) {
    return (
      <p className="mt-6 text-sm" style={{ color: 'var(--testo-tenue)' }}>
        Preparazione…
      </p>
    )
  }

  return (
    <div className="mt-6 space-y-5">
      <ol className="space-y-4 text-sm" style={{ color: 'var(--testo-tenue)' }}>
        <li>
          <span className="font-medium" style={{ color: 'var(--testo)' }}>
            1. Installa un&apos;app di autenticazione
          </span>
          <br />
          Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden: vanno
          tutte bene, e sono gratuite.
        </li>

        <li>
          <span className="font-medium" style={{ color: 'var(--testo)' }}>
            2. Aggiungi questo account
          </span>
          <br />
          Dal telefono tocca il collegamento qui sotto e l&apos;app si configura da
          sola. Dal computer scegli «inserisci una chiave» e ricopia il codice.
          <div className="mt-2 space-y-2">
            <a
              href={segreto.uri}
              className="inline-block rounded-lg border px-3 py-1.5 text-xs"
              style={{ borderColor: 'var(--bordo)', color: 'var(--color-eco-blue-300)' }}
            >
              Apri nell&apos;app di autenticazione
            </a>
            <div
              className="rounded-lg border px-3 py-2 font-mono text-sm tracking-wider select-all"
              style={{ borderColor: 'var(--bordo)', background: 'var(--superficie)' }}
            >
              {segreto.leggibile}
            </div>
            <p className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Account: {email}
            </p>
          </div>
        </li>

        <li>
          <span className="font-medium" style={{ color: 'var(--testo)' }}>
            3. Scrivi il codice che l&apos;app mostra
          </span>
          <br />
          Serve a verificare che sia configurata davvero, prima di renderla
          obbligatoria.
        </li>
      </ol>

      <form
        action={(formData) => {
          setErroreCodice(null)
          avvia(async () => {
            const esito = await attivaMfa({ codice: String(formData.get('codice') ?? '') })
            if (esito.ok) onAttivata(esito.data.codiciRecupero)
            else setErroreCodice(esito.errors.codice ?? esito.errors._ ?? 'Non riuscito.')
          })
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Codice a sei cifre</span>
          <input
            name="codice"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            required
            className={`${CAMPO} font-mono tracking-[0.3em]`}
            style={{
              background: 'var(--superficie)',
              borderColor: erroreCodice ? 'var(--color-eco-red-400)' : 'var(--bordo)',
            }}
          />
          {erroreCodice ? (
            <span className="mt-1 block text-xs text-eco-red-400">{erroreCodice}</span>
          ) : null}
        </label>

        <button type="submit" disabled={inCorso} className={BOTTONE_ORO}>
          {inCorso ? 'Verifica…' : 'Attiva'}
        </button>
      </form>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function CodiciRecupero({
  codici,
  onChiudi,
}: {
  codici: readonly string[]
  onChiudi: () => void
}) {
  const router = useRouter()
  const [copiato, setCopiato] = useState(false)

  return (
    <div className="mt-6 space-y-4">
      <div
        className="rounded-lg border px-4 py-3"
        style={{
          borderColor: 'rgba(232,199,101,0.45)',
          background: 'rgba(232,199,101,0.07)',
        }}
      >
        <p className="text-sm font-semibold">Codici di recupero</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--testo-tenue)' }}>
          Servono se perdi il telefono. Ognuno vale una volta sola e non saranno più
          mostrati: stampali o mettili dove tieni i documenti importanti — non nello
          stesso telefono che stai proteggendo.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm">
          {codici.map((c) => (
            <span key={c} className="select-all">
              {c}
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(codici.join('\n')).then(() => setCopiato(true))
            }}
            className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
            style={{ borderColor: 'var(--bordo)' }}
          >
            {copiato ? 'Copiati' : 'Copia tutti'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
            style={{ borderColor: 'var(--bordo)' }}
          >
            Stampa
          </button>
          <button
            type="button"
            onClick={() => {
              onChiudi()
              router.refresh()
              router.replace('/')
            }}
            className={BOTTONE_ORO}
          >
            Fatto, li ho messi al sicuro
          </button>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function GiaAttiva({
  obbligatoria,
  onNuoviCodici,
}: {
  obbligatoria: boolean
  onNuoviCodici: (codici: string[]) => void
}) {
  const router = useRouter()
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
        La verifica in due passaggi è <strong>attiva</strong> su questo account.
        {obbligatoria
          ? ' Per il tuo ruolo è obbligatoria e non può essere disattivata.'
          : ''}
      </p>

      <form
        action={(formData) => {
          setErrore(null)
          avvia(async () => {
            const esito = await rigeneraCodiciRecupero({
              password: String(formData.get('password') ?? ''),
            })
            if (esito.ok) onNuoviCodici(esito.data.codiciRecupero)
            else setErrore(esito.errors.password ?? esito.errors._ ?? 'Non riuscito.')
          })
        }}
        className="space-y-2"
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Rigenera i codici di recupero
          </span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="La tua password"
            required
            disabled={inCorso}
            className={CAMPO}
            style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
          />
        </label>
        <button
          type="submit"
          disabled={inCorso}
          className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Rigenera
        </button>
        <p className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
          I precedenti smettono di funzionare. Serve la password perché i nuovi
          codici valgono come un secondo fattore.
        </p>
      </form>

      {!obbligatoria ? (
        <form
          action={(formData) => {
            setErrore(null)
            avvia(async () => {
              const esito = await disattivaMfa({
                password: String(formData.get('password') ?? ''),
              })
              if (esito.ok) router.refresh()
              else setErrore(esito.errors.password ?? esito.errors._ ?? 'Non riuscito.')
            })
          }}
          className="space-y-2 border-t pt-5"
          style={{ borderColor: 'var(--bordo)' }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              Disattiva la verifica in due passaggi
            </span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="La tua password"
              required
              className={CAMPO}
              style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
            />
          </label>
          <button
            type="submit"
            disabled={inCorso}
            className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
            style={{ borderColor: 'var(--bordo)' }}
          >
            Disattiva
          </button>
        </form>
      ) : null}

      {errore ? <p className="text-xs text-eco-red-400">{errore}</p> : null}
    </div>
  )
}
