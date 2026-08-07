'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cercaGlobale, type RisultatoRicerca } from '@/lib/actions/search'

const GRUPPI: Record<RisultatoRicerca['tipo'], string> = {
  anagrafica: 'Anagrafica',
  lead: 'Lead',
  cantiere: 'Cantieri e commesse',
}

const GLIFI: Record<RisultatoRicerca['tipo'], string> = {
  anagrafica: '◐',
  lead: '◭',
  cantiere: '◫',
}

/**
 * Ricerca globale: si apre con ⌘K / Ctrl+K o dai bottoni in navigazione
 * (evento `eco:ricerca`). Un campo, tre fonti: anagrafica, lead, cantieri.
 *
 * La query parte dopo una pausa di battitura e scarta le risposte arrivate
 * fuori ordine: su una connessione lenta l'ultimo carattere digitato deve
 * sempre vincere sull'ultima risposta arrivata.
 */
export function RicercaGlobale() {
  const router = useRouter()
  const [aperta, setAperta] = useState(false)
  const [testo, setTesto] = useState('')
  const [risultati, setRisultati] = useState<readonly RisultatoRicerca[]>([])
  const [inCorso, setInCorso] = useState(false)
  const [attivo, setAttivo] = useState(0)
  const campo = useRef<HTMLInputElement>(null)
  const sequenza = useRef(0)

  useEffect(() => {
    const apri = () => setAperta(true)
    const suTasto = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAperta((a) => !a)
      }
    }
    window.addEventListener('eco:ricerca', apri)
    window.addEventListener('keydown', suTasto)
    return () => {
      window.removeEventListener('eco:ricerca', apri)
      window.removeEventListener('keydown', suTasto)
    }
  }, [])

  useEffect(() => {
    if (!aperta) return
    campo.current?.focus()

    const suEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAperta(false)
    }
    document.addEventListener('keydown', suEscape)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', suEscape)
      document.body.style.overflow = overflow
    }
  }, [aperta])

  const pulito = testo.trim()
  // Sotto i due caratteri non si cerca: i risultati restano in memoria ma
  // non si mostrano, così l'effetto non deve azzerare lo stato a ogni tasto.
  const risultatiVisibili = pulito.length < 2 ? ([] as readonly RisultatoRicerca[]) : risultati
  const cercaInCorso = pulito.length >= 2 && inCorso

  useEffect(() => {
    if (pulito.length < 2) return
    const mia = ++sequenza.current
    const timer = setTimeout(async () => {
      setInCorso(true)
      const esito = await cercaGlobale(pulito)
      if (sequenza.current !== mia) return
      setRisultati(esito)
      setAttivo(0)
      setInCorso(false)
    }, 240)
    return () => clearTimeout(timer)
  }, [pulito])

  const chiudi = () => {
    setAperta(false)
    setTesto('')
    setRisultati([])
    setAttivo(0)
    setInCorso(false)
  }

  const vai = (r: RisultatoRicerca) => {
    chiudi()
    router.push(r.href)
  }

  const naviga = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAttivo((i) => Math.min(i + 1, risultatiVisibili.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAttivo((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && risultatiVisibili[attivo]) {
      e.preventDefault()
      vai(risultatiVisibili[attivo])
    }
  }

  if (!aperta) return null

  let ultimoTipo: RisultatoRicerca['tipo'] | null = null

  return createPortal(
    <div
      className="fixed inset-0 z-[110] overflow-y-auto p-4 pt-[10vh] sm:pt-[14vh]"
      role="presentation"
      onClick={chiudi}
    >
      <div className="absolute inset-0 bg-black/72 backdrop-blur-[3px]" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ricerca globale"
        onClick={(e) => e.stopPropagation()}
        className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border"
        style={{
          background:
            'linear-gradient(165deg, rgba(14,24,40,0.98) 0%, rgba(5,10,20,0.99) 100%)',
          borderColor: 'rgba(217,164,65,0.22)',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.04), 0 28px 80px -24px rgba(0,0,0,0.85), 0 0 60px -28px rgba(217,164,65,0.25)',
        }}
      >
        <div
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <span aria-hidden className="text-base" style={{ color: 'var(--color-eco-gold-300)' }}>
            ⌕
          </span>
          <input
            ref={campo}
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            onKeyDown={naviga}
            placeholder="Cerca clienti, lead, cantieri…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--testo-fioco)]"
            autoComplete="off"
            spellCheck={false}
          />
          {cercaInCorso ? (
            <span className="shrink-0 text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Ricerca…
            </span>
          ) : null}
        </div>

        <div className="max-h-[55vh] overflow-y-auto overscroll-contain p-2">
          {pulito.length < 2 ? (
            <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--testo-fioco)' }}>
              Digita almeno due caratteri: nome, telefono, codice…
            </p>
          ) : risultatiVisibili.length === 0 && !cercaInCorso ? (
            <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--testo-fioco)' }}>
              Nessun risultato per «{pulito}».
            </p>
          ) : (
            risultatiVisibili.map((r, indice) => {
              const nuovoGruppo = r.tipo !== ultimoTipo
              ultimoTipo = r.tipo
              return (
                <div key={`${r.tipo}-${r.id}`}>
                  {nuovoGruppo ? (
                    <p className="eyebrow px-3 pb-1 pt-3 first:pt-1">{GRUPPI[r.tipo]}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => vai(r)}
                    onMouseEnter={() => setAttivo(indice)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                    style={{
                      background: indice === attivo ? 'rgba(91,155,213,0.1)' : undefined,
                    }}
                  >
                    <span
                      aria-hidden
                      className="w-5 shrink-0 text-center"
                      style={{
                        color:
                          indice === attivo
                            ? 'var(--color-eco-gold-300)'
                            : 'var(--testo-fioco)',
                      }}
                    >
                      {GLIFI[r.tipo]}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{r.titolo}</span>
                      <span
                        className="block truncate text-xs"
                        style={{ color: 'var(--testo-tenue)' }}
                      >
                        {r.dettaglio}
                      </span>
                    </span>
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div
          className="hidden items-center gap-4 border-t px-4 py-2 text-[11px] sm:flex"
          style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'var(--testo-fioco)' }}
        >
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> per muoverti
          </span>
          <span>
            <Kbd>Invio</Kbd> per aprire
          </span>
          <span>
            <Kbd>Esc</Kbd> per chiudere
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd
      className="rounded border px-1 py-px font-mono text-[10px]"
      style={{ borderColor: 'var(--bordo)', background: 'rgba(255,255,255,0.03)' }}
    >
      {children}
    </kbd>
  )
}

/** I bottoni in navigazione aprono la ricerca senza conoscere il componente. */
export function apriRicerca() {
  window.dispatchEvent(new Event('eco:ricerca'))
}
