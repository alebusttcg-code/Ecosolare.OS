'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { suggerisciIndirizzi } from '@/lib/actions/sviluppo'
import type { SuggerimentoIndirizzo } from '@/lib/solar'

/**
 * Campo indirizzo con suggerimenti Places (New), stile CRM.
 */
export function CampoIndirizzo({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [aperti, setAperti] = useState(false)
  const [caricamento, setCaricamento] = useState(false)
  const [suggerimenti, setSuggerimenti] = useState<
    readonly SuggerimentoIndirizzo[]
  >([])
  const [attivo, setAttivo] = useState(-1)
  const richiestaRef = useRef(0)

  const q = value.trim()
  const cercaAttiva = q.length >= 3
  const lista = cercaAttiva ? suggerimenti : []

  useEffect(() => {
    if (!cercaAttiva) return

    const id = ++richiestaRef.current
    const t = window.setTimeout(() => {
      void (async () => {
        setCaricamento(true)
        const esito = await suggerisciIndirizzi({ input: q })
        if (id !== richiestaRef.current) return
        setCaricamento(false)
        if (!esito.ok) {
          setSuggerimenti([])
          return
        }
        setSuggerimenti(esito.data.suggerimenti)
        setAttivo(-1)
        setAperti(true)
      })()
    }, 280)

    return () => {
      window.clearTimeout(t)
    }
  }, [q, cercaAttiva])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setAperti(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const scegli = (s: SuggerimentoIndirizzo) => {
    onChange(s.testo)
    setSuggerimenti([])
    setAperti(false)
    setAttivo(-1)
  }

  const mostraLista =
    aperti && cercaAttiva && (lista.length > 0 || caricamento)

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value)
          setAperti(true)
        }}
        onFocus={() => {
          if (lista.length > 0) setAperti(true)
        }}
        onKeyDown={(e) => {
          if (!mostraLista || lista.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setAttivo((i) => Math.min(i + 1, lista.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setAttivo((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && attivo >= 0) {
            e.preventDefault()
            const s = lista[attivo]
            if (s) scegli(s)
          } else if (e.key === 'Escape') {
            setAperti(false)
          }
        }}
        placeholder="Inizia a digitare: via, civico, comune…"
        required
        minLength={5}
        autoComplete="off"
        role="combobox"
        aria-expanded={mostraLista}
        aria-controls={listId}
        aria-autocomplete="list"
        className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-eco-blue-400"
        style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
      />

      {mostraLista ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border py-1 shadow-lg"
          style={{
            borderColor: 'rgba(30, 51, 80, 0.95)',
            background: 'rgba(5, 10, 20, 0.94)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
          }}
        >
          {caricamento && lista.length === 0 ? (
            <li
              className="px-3 py-2.5 text-xs"
              style={{ color: 'var(--testo-fioco)' }}
            >
              Ricerca indirizzi…
            </li>
          ) : null}
          {lista.map((s, i) => {
            const evidenziato = i === attivo
            return (
              <li key={s.placeId} role="option" aria-selected={evidenziato}>
                <button
                  type="button"
                  onMouseEnter={() => setAttivo(i)}
                  onClick={() => scegli(s)}
                  className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition"
                  style={{
                    background: evidenziato
                      ? 'rgba(217, 164, 65, 0.14)'
                      : 'transparent',
                    color: 'var(--testo)',
                  }}
                >
                  <span className="font-medium leading-snug">
                    {s.principale || s.testo}
                  </span>
                  {s.secondario ? (
                    <span
                      className="text-xs leading-snug"
                      style={{ color: 'var(--testo-tenue)' }}
                    >
                      {s.secondario}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
