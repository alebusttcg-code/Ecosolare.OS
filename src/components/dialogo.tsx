'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useBloccaScroll } from '@/lib/use-blocca-scroll'

/**
 * Popup centrato sul *viewport reale*, fuori dal layout della pagina.
 *
 * Va in portal su `document.body`: altrimenti un antenato con `transform`
 * (es. la transizione di sezione) fa sì che `position: fixed` si ancori
 * alla colonna dei contenuti e il pannello finisca tagliato in alto.
 *
 * Il portal si monta solo ad `aperto === true`, che accade sempre dopo
 * un'interazione client: durante l'SSR non si tocca mai `document`.
 * Se il contenuto supera l'altezza del viewport, scorre il corpo del
 * pannello (mai la pagina sotto, mai due barre).
 */
export function Dialogo({
  aperto,
  titolo,
  onChiudi,
  children,
}: {
  aperto: boolean
  titolo: string
  onChiudi: () => void
  children: ReactNode
}) {
  const titoloId = useId()
  const pannello = useRef<HTMLDivElement>(null)
  const percorso = usePathname()
  const percorsoPrec = useRef(percorso)

  useEffect(() => {
    if (percorsoPrec.current === percorso) return
    percorsoPrec.current = percorso
    if (aperto) onChiudi()
  }, [percorso, aperto, onChiudi])

  useBloccaScroll(aperto)

  useEffect(() => {
    if (!aperto) return
    const precedente = document.activeElement as HTMLElement | null
    pannello.current?.focus()

    const suTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi()
    }
    document.addEventListener('keydown', suTasto)

    return () => {
      document.removeEventListener('keydown', suTasto)
      precedente?.focus()
    }
  }, [aperto, onChiudi])

  if (!aperto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Chiudi"
        className="absolute inset-0 bg-black/72 backdrop-blur-[3px]"
        onClick={onChiudi}
      />

      <div
        ref={pannello}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titoloId}
        tabIndex={-1}
        className="relative z-[1] flex max-h-full w-full max-w-md flex-col rounded-2xl border outline-none"
        style={{
          background:
            'linear-gradient(165deg, rgba(14,24,40,0.98) 0%, rgba(5,10,20,0.99) 100%)',
          borderColor: 'rgba(217,164,65,0.22)',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.04), 0 28px 80px -24px rgba(0,0,0,0.85), 0 0 60px -28px rgba(217,164,65,0.25)',
        }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-4 border-b px-5 py-3"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <h2
            id={titoloId}
            className="truncate text-base font-semibold tracking-tight"
          >
            {titolo}
          </h2>
          <button
            type="button"
            onClick={onChiudi}
            className="bottone-fantasma shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-white/[0.04]"
            style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
          >
            Chiudi
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
