'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export interface VoceMenu {
  readonly href: string
  readonly label: string
  readonly icona: string
  readonly gruppo: 'operativo' | 'amministrazione'
}

/**
 * Navigazione laterale.
 *
 * A sinistra e non in alto perche' un gestionale ha piu' sezioni di quante ne
 * stiano comodamente in una riga, e perche' la barra orizzontale ruba altezza
 * proprio dove servono le tabelle.
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

  const operative = voci.filter((v) => v.gruppo === 'operativo')
  const amministrative = voci.filter((v) => v.gruppo === 'amministrazione')

  return (
    <aside
      className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r"
      style={{
        borderColor: 'var(--bordo-tenue)',
        background:
          'linear-gradient(180deg, rgba(10,18,32,0.96) 0%, rgba(5,10,20,0.98) 100%)',
      }}
    >
      <div className="px-5 pb-5 pt-6">
        <Link href="/" className="group block">
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
        <div className="mt-4 filetto" />
        <p className="mt-3 eyebrow">Operating System</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <Gruppo voci={operative} percorso={percorso} />

        {amministrative.length > 0 ? (
          <>
            <p className="mb-2 mt-6 px-3 eyebrow" style={{ color: 'var(--testo-fioco)' }}>
              Amministrazione
            </p>
            <Gruppo voci={amministrative} percorso={percorso} />
          </>
        ) : null}
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
  )
}

function Gruppo({
  voci,
  percorso,
}: {
  voci: readonly VoceMenu[]
  percorso: string
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
              className="group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm transition-all duration-200 hover:bg-white/[0.045] hover:pl-4"
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
              <span className="truncate">{voce.label}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
