'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useBloccaScroll } from '@/lib/use-blocca-scroll'

export interface VoceMenu {
  readonly href: string
  readonly label: string
  readonly icona: string
  readonly gruppo: 'direzione' | 'economia' | 'ciclo' | 'lavoro' | 'amministrazione'
  /** Contatore a destra della voce (attività scadute, approvazioni…). */
  readonly badge?: number
}

/**
 * Navigazione laterale.
 *
 * A sinistra e non in alto perche' un gestionale ha piu' sezioni di quante ne
 * stiano comodamente in una riga, e perche' la barra orizzontale ruba altezza
 * proprio dove servono le tabelle.
 *
 * Su schermi piccoli diventa un cassetto: barra superiore fissa con il logo e
 * il bottone menu, pannello che scorre da sinistra sopra uno sfondo scurito.
 * Si chiude toccando una voce, lo sfondo o premendo Escape — la navigazione
 * deve portare alla pagina, non lasciare il menu davanti.
 *
 * Le icone sono glifi tipografici e non un pacchetto di icone: pesano zero e
 * non aggiungono una dipendenza per venti simboli.
 */
export function Sidebar({
  voci,
  utente,
  azioneEsci,
}: {
  voci: readonly VoceMenu[]
  utente: { nome: string; ruolo: string; capacita: string | null }
  azioneEsci: ReactNode
}) {
  const percorso = usePathname()
  const percorsoPrec = useRef(percorso)
  const [aperta, setAperta] = useState(false)

  useEffect(() => {
    if (percorsoPrec.current === percorso) return
    percorsoPrec.current = percorso
    setAperta(false)
  }, [percorso])

  useBloccaScroll(aperta)

  useEffect(() => {
    if (!aperta) return
    const suTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAperta(false)
    }
    document.addEventListener('keydown', suTasto)
    return () => document.removeEventListener('keydown', suTasto)
  }, [aperta])

  /** Le aree, nell'ordine in cui si attraversano lavorando. */
  const gruppi = [
    { codice: 'direzione' as const, titolo: null },
    { codice: 'economia' as const, titolo: 'Economia' },
    { codice: 'ciclo' as const, titolo: 'Ciclo di lavoro' },
    { codice: 'lavoro' as const, titolo: 'Controllo' },
    { codice: 'amministrazione' as const, titolo: 'Amministrazione' },
  ].map((g) => ({ ...g, voci: voci.filter((v) => v.gruppo === g.codice) }))
    .filter((g) => g.voci.length > 0)

  const chiudi = () => setAperta(false)

  return (
    <>
      {/* Barra superiore: esiste solo sotto il breakpoint lg. */}
      <header
        className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b px-4 lg:hidden"
        style={{
          borderColor: 'var(--bordo-tenue)',
          background:
            'linear-gradient(180deg, rgba(10,18,32,0.97) 0%, rgba(7,13,24,0.97) 100%)',
        }}
      >
        <Link href="/" onClick={chiudi} className="block">
          <Image
            src="/brand/ecosolare-logo.png"
            alt="EcoSolare"
            width={601}
            height={193}
            priority
            className="h-7 w-auto"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(217,164,65,0.18))' }}
          />
        </Link>
        <button
          type="button"
          onClick={() => setAperta(true)}
          aria-label="Apri il menu"
          aria-expanded={aperta}
          className="bottone-fantasma rounded-lg border p-2.5"
          style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
        >
          <span className="relative block h-3.5 w-5" aria-hidden>
            <span className="absolute left-0 top-0 h-[1.5px] w-full rounded-full bg-current" />
            <span className="absolute left-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 rounded-full bg-current" />
            <span className="absolute bottom-0 left-0 h-[1.5px] w-full rounded-full bg-current" />
          </span>
        </button>
      </header>

      {/* Sfondo scurito dietro il cassetto, solo mobile. */}
      {aperta ? (
        <button
          type="button"
          aria-label="Chiudi il menu"
          onClick={chiudi}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r transition-transform duration-300 ease-out lg:z-20 lg:w-64 lg:max-w-none lg:translate-x-0 ${
          aperta ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          borderColor: 'var(--bordo-tenue)',
          background:
            'linear-gradient(180deg, rgba(10,18,32,0.96) 0%, rgba(5,10,20,0.98) 100%)',
        }}
      >
        <div className="px-5 pb-5 pt-6">
          <Link href="/" onClick={chiudi} className="group block min-w-0">
            <Image
              src="/brand/ecosolare-logo.png"
              alt="EcoSolare"
              width={601}
              height={193}
              priority
              className="h-9 w-auto transition-all duration-300 group-hover:brightness-110"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(217,164,65,0.18))' }}
            />
          </Link>
        </div>
        <div className="px-5">
          <div className="filetto" />
          <p className="mt-3 eyebrow">Operating System</p>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
          {gruppi.map((g, indice) => (
            <div key={g.codice} className={indice > 0 ? 'mt-6' : undefined}>
              {g.titolo ? (
                <p className="mb-2 px-3 eyebrow" style={{ color: 'var(--testo-fioco)' }}>
                  {g.titolo}
                </p>
              ) : null}
              <Gruppo voci={g.voci} percorso={percorso} onNaviga={chiudi} />
            </div>
          ))}
        </nav>

        <div className="border-t px-4 py-4" style={{ borderColor: 'var(--bordo-tenue)' }}>
          <div className="flex items-center gap-3">
            <span
              className="anello h-9 w-9 shrink-0 text-sm font-semibold"
              style={{ color: 'var(--color-eco-gold-400)' }}
            >
              {utente.nome.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{utente.nome}</div>
              <div className="truncate text-xs" style={{ color: 'var(--testo-tenue)' }}>
                {utente.ruolo}
              </div>
            </div>
          </div>
          {utente.capacita ? (
            <p className="mt-2 text-xs" style={{ color: 'var(--testo-fioco)' }}>
              {utente.capacita}
            </p>
          ) : null}
          <div className="mt-3">{azioneEsci}</div>
        </div>
      </aside>
    </>
  )
}

function Gruppo({
  voci,
  percorso,
  onNaviga,
}: {
  voci: readonly VoceMenu[]
  percorso: string
  onNaviga: () => void
}) {
  return (
    <ul className="space-y-0.5">
      {voci.map((voce) => {
        // La radice combacia solo esattamente, le altre anche sulle sottopagine.
        const attiva =
          voce.href === '/' ? percorso === '/' : percorso.startsWith(voce.href)

        return (
          <li key={voce.href}>
            <Link
              href={voce.href}
              onClick={onNaviga}
              className="group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-sm transition-all duration-200 hover:bg-white/[0.045] hover:pl-4 lg:py-2"
              style={{
                background: attiva
                  ? 'linear-gradient(90deg, rgba(63,127,196,0.18) 0%, rgba(63,127,196,0.04) 100%)'
                  : undefined,
                color: attiva ? 'var(--testo)' : 'var(--testo-tenue)',
                boxShadow: attiva
                  ? 'inset 0 1px 0 0 rgba(255,255,255,0.06)'
                  : undefined,
              }}
            >
              {/* Filetto oro sulla voce attiva; sulle altre compare al hover. */}
              <span
                className="absolute inset-y-1.5 left-0 w-[2px] rounded-full transition-transform duration-300 ease-out"
                style={{
                  background: attiva
                    ? 'linear-gradient(180deg, #e8c765, #d9a441)'
                    : 'rgba(91,155,213,0.55)',
                  transform: attiva ? 'scaleY(1)' : 'scaleY(0)',
                  transformOrigin: 'center',
                }}
                aria-hidden
              />
              {!attiva ? (
                <span
                  className="absolute inset-y-1.5 left-0 w-[2px] origin-center scale-y-0 rounded-full bg-eco-blue-400/60 transition-transform duration-300 ease-out group-hover:scale-y-100"
                  aria-hidden
                />
              ) : null}

              <span
                className="w-5 text-center text-base leading-none transition-all duration-200 group-hover:scale-110"
                style={{
                  color: attiva ? 'var(--color-eco-gold-400)' : 'var(--testo-fioco)',
                  filter: attiva ? 'drop-shadow(0 0 6px rgba(217,164,65,0.5))' : undefined,
                }}
                aria-hidden
              >
                {voce.icona}
              </span>
              <span className="min-w-0 flex-1 truncate">{voce.label}</span>
              {voce.badge ? (
                <span
                  className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none"
                  style={{
                    borderColor: 'rgba(217,164,65,0.4)',
                    background: 'rgba(217,164,65,0.12)',
                    color: 'var(--color-eco-gold-300)',
                  }}
                >
                  {voce.badge > 99 ? '99+' : voce.badge}
                </span>
              ) : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
