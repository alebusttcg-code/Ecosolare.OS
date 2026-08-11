'use client'

import { useState } from 'react'
import { creaLinkCliente, revocaLinkCliente } from '@/lib/actions/link-cliente'
import { useAzioneServer } from '@/lib/use-azione-server'

export interface LinkAttivo {
  readonly id: string
  readonly creatoIl: string
  readonly ultimaVisita: string | null
  readonly visite: number
}

/**
 * Collegamento pubblico da mandare al cliente.
 *
 * L'indirizzo compare una volta sola, subito dopo averlo generato: nel database
 * ne resta solo l'impronta. Rigenerarlo costa un clic, quindi non vale la pena
 * conservarlo da nessun'altra parte — e conservarlo significherebbe che chi
 * legge il database può aprire la pagina del cliente.
 */
export function PannelloLinkCliente({
  projectId,
  attivi,
  puoScrivere,
}: {
  projectId: string
  attivi: readonly LinkAttivo[]
  puoScrivere: boolean
}) {
  const [urlGenerato, setUrlGenerato] = useState<string | null>(null)
  const [copiato, setCopiato] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
        Una pagina che il cliente apre senza password, dove vede a che punto è il suo
        impianto e quali documenti aspettiamo da lui. Si aggiorna da sola.
      </p>

      {urlGenerato ? (
        <div
          className="space-y-2 rounded-lg border px-4 py-3"
          style={{
            borderColor: 'rgba(232,199,101,0.45)',
            background: 'rgba(232,199,101,0.07)',
          }}
        >
          <p className="text-xs font-semibold">Collegamento da mandare al cliente</p>
          <p className="font-mono text-xs break-all select-all">{urlGenerato}</p>
          <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
            Non sarà più visibile: copialo adesso. Se lo perdi, generane un altro e
            revoca questo.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(urlGenerato).then(() => setCopiato(true))
              }}
              className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
              style={{ borderColor: 'var(--bordo)' }}
            >
              {copiato ? 'Copiato' : 'Copia'}
            </button>
            <button
              type="button"
              onClick={() => {
                setUrlGenerato(null)
                setCopiato(false)
              }}
              className="rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-3 py-1.5 text-xs font-semibold text-eco-abisso"
            >
              Fatto
            </button>
          </div>
        </div>
      ) : null}

      {attivi.length > 0 ? (
        <ul className="divide-y rounded-lg border" style={{ borderColor: 'var(--bordo)' }}>
          {attivi.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
              style={{ borderColor: 'var(--bordo-tenue)' }}
            >
              <div className="min-w-0 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                Generato il {l.creatoIl}
                {' · '}
                {l.visite === 0
                  ? 'mai aperto'
                  : `aperto ${l.visite} volt${l.visite === 1 ? 'a' : 'e'}${
                      l.ultimaVisita ? `, l’ultima il ${l.ultimaVisita}` : ''
                    }`}
              </div>
              {puoScrivere ? (
                <button
                  type="button"
                  disabled={inCorso}
                  onClick={() => {
                    setErrore(null)
                    esegui(async () => {
                      const esito = await revocaLinkCliente({ linkId: l.id })
                      if (!esito.ok) setErrore(esito.errors._ ?? 'Non riuscito.')
                    })
                  }}
                  className="bottone-fantasma shrink-0 rounded-lg border px-2.5 py-1 text-xs"
                  style={{ borderColor: 'var(--bordo)' }}
                >
                  Revoca
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {puoScrivere ? (
        <button
          type="button"
          disabled={inCorso}
          onClick={() => {
            setErrore(null)
            setCopiato(false)
            esegui(async () => {
              const esito = await creaLinkCliente({ projectId })
              if (esito.ok) setUrlGenerato(esito.data.url)
              else setErrore(esito.errors._ ?? 'Non riuscito.')
            })
          }}
          className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          {inCorso
            ? 'Generazione…'
            : attivi.length > 0
              ? 'Genera un nuovo collegamento'
              : 'Genera il collegamento'}
        </button>
      ) : null}

      {errore ? <p className="text-xs text-eco-red-400">{errore}</p> : null}
    </div>
  )
}
