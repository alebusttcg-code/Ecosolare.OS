'use client'

import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

/** Ritardo ingresso: allineato a `ritardo` in ui.tsx. */
const ritardo = (indice: number, passo = 60): CSSProperties =>
  ({ '--ritardo': `${indice * passo}ms` }) as CSSProperties

/** True se l'hash punta al pannello o a una riga al suo interno. */
export function deveAprirePerHash(
  hash: string,
  id: string,
  prefissoAncora?: string,
): boolean {
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  if (!h) return false
  if (h === id) return true
  if (prefissoAncora && h.startsWith(`${prefissoAncora}-`)) return true
  return false
}

function idDaHash(hash: string): string {
  return hash.startsWith('#') ? hash.slice(1) : hash
}

/** Scroll dopo che il corpo ha avuto modo di espandersi nel layout. */
function scorriA(targetId: string) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
    })
  })
}

/**
 * Pannello come `Card`, ma con header cliccabile che apre/chiude il corpo.
 * Default chiuso; se l'URL ha ancora sul pannello o sulle righe (`prefissoAncora-…`)
 * si apre e ripristina lo scroll verso il target.
 */
export function PannelloCollassabile({
  id,
  title,
  prefissoAncora,
  action,
  accento = 'neutro',
  indice = 0,
  children,
}: {
  id: string
  title: string
  /** Prefisso delle ancore di riga (es. `documento` → `#documento-…`). */
  prefissoAncora?: string
  action?: ReactNode
  accento?: 'neutro' | 'blu' | 'oro' | 'verde' | 'rosso'
  indice?: number
  children: ReactNode
}) {
  const [aperto, setAperto] = useState(false)
  const corpoId = `${id}-corpo`

  const bordi: Record<string, string> = {
    neutro: 'var(--bordo)',
    blu: 'rgba(91,155,213,0.4)',
    oro: 'rgba(217,164,65,0.45)',
    verde: 'rgba(163,197,99,0.4)',
    rosso: 'rgba(224,133,133,0.4)',
  }

  useLayoutEffect(() => {
    function apriEScorri(hash: string) {
      if (!deveAprirePerHash(hash, id, prefissoAncora)) return
      setAperto(true)
      scorriA(idDaHash(hash))
    }

    apriEScorri(window.location.hash)

    function onHash() {
      apriEScorri(window.location.hash)
    }

    // hashchange non scatta se l'hash è già quello: il click riapre comunque.
    function onClick(e: MouseEvent) {
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]')
      if (!(a instanceof HTMLAnchorElement)) return
      const href = a.getAttribute('href')
      if (!href) return
      apriEScorri(href)
    }

    window.addEventListener('hashchange', onHash)
    document.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('hashchange', onHash)
      document.removeEventListener('click', onClick)
    }
  }, [id, prefissoAncora])

  return (
    <section
      id={id}
      className="pannello rivela scroll-mt-24"
      style={{ borderColor: bordi[accento], ...ritardo(indice) }}
    >
      <header
        className="flex items-center justify-between gap-4 border-b px-5 py-3.5"
        style={{ borderColor: 'var(--bordo-tenue)' }}
      >
        <button
          type="button"
          className="group flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-eco-blue-400/40 rounded-md -ml-1.5 px-1.5 py-0.5"
          aria-expanded={aperto}
          aria-controls={corpoId}
          onClick={() => setAperto((v) => !v)}
        >
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-200"
            style={{
              borderColor: 'var(--bordo)',
              color: 'var(--testo-tenue)',
              background: 'rgba(5,10,20,0.35)',
            }}
            aria-hidden
          >
            <svg
              viewBox="0 0 16 16"
              className="h-3 w-3 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: aperto ? 'rotate(90deg)' : 'rotate(0deg)' }}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </span>
          <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
          <span className="sr-only">{aperto ? 'Sezione aperta' : 'Sezione chiusa'}</span>
        </button>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div
        id={corpoId}
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ gridTemplateRows: aperto ? '1fr' : '0fr' }}
        aria-hidden={!aperto}
      >
        <div className="overflow-hidden">
          <div className="p-5">{children}</div>
        </div>
      </div>
    </section>
  )
}
