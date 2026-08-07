'use client'

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

type Tono = 'successo' | 'errore' | 'info'

interface Avviso {
  readonly id: number
  readonly testo: string
  readonly tono: Tono
  readonly uscita: boolean
}

const ASPETTO: Record<Tono, { glifo: string; colore: string; bordo: string }> = {
  successo: { glifo: '✓', colore: 'var(--color-eco-green-400)', bordo: 'rgba(163,197,99,0.4)' },
  errore: { glifo: '!', colore: 'var(--color-eco-red-400)', bordo: 'rgba(224,133,133,0.45)' },
  info: { glifo: '◆', colore: 'var(--color-eco-gold-300)', bordo: 'rgba(217,164,65,0.4)' },
}

const Contesto = createContext<(testo: string, tono?: Tono) => void>(() => {})

/** Conferma leggera dopo un'azione: `avvisa('Lead creato.')`. */
export function useAvvisi() {
  return useContext(Contesto)
}

/**
 * Avvisi transitori («toast»).
 *
 * Compaiono in basso, durano meno di quattro secondi e non chiedono nulla:
 * confermano che l'azione è avvenuta, che è il riscontro che oggi manca fra
 * il click e il refresh della pagina. Un tocco li congeda subito.
 */
export function AvvisiProvider({ children }: { children: ReactNode }) {
  const [avvisi, setAvvisi] = useState<readonly Avviso[]>([])
  const progressivo = useRef(1)

  const rimuovi = useCallback((id: number) => {
    setAvvisi((a) => a.map((x) => (x.id === id ? { ...x, uscita: true } : x)))
    setTimeout(() => setAvvisi((a) => a.filter((x) => x.id !== id)), 320)
  }, [])

  const avvisa = useCallback(
    (testo: string, tono: Tono = 'successo') => {
      const id = progressivo.current++
      // Al massimo tre in colonna: il quarto scalza il più vecchio.
      setAvvisi((a) => [...a.slice(-2), { id, testo, tono, uscita: false }])
      setTimeout(() => rimuovi(id), 3600)
    },
    [rimuovi],
  )

  return (
    <Contesto.Provider value={avvisa}>
      {children}
      {avvisi.length > 0
        ? createPortal(
            <div
              className="pointer-events-none fixed inset-x-0 bottom-5 z-[120] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:items-end"
              role="status"
              aria-live="polite"
            >
              {avvisi.map((a) => {
                const aspetto = ASPETTO[a.tono]
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => rimuovi(a.id)}
                    className={`avviso pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border px-4 py-2.5 text-left text-sm ${
                      a.uscita ? 'avviso-esce' : ''
                    }`}
                    style={{
                      background:
                        'linear-gradient(160deg, rgba(20,36,60,0.97) 0%, rgba(8,16,30,0.97) 100%)',
                      borderColor: aspetto.bordo,
                      boxShadow:
                        'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 14px 40px -14px rgba(0,0,0,0.8)',
                    }}
                  >
                    <span
                      aria-hidden
                      className="anello h-5 w-5 shrink-0 text-[10px]"
                      style={{ color: aspetto.colore }}
                    >
                      {aspetto.glifo}
                    </span>
                    {a.testo}
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </Contesto.Provider>
  )
}
