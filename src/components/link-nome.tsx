import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Nome di persona (lead / cliente) sempre cliccabile.
 *
 * Nelle schede dettaglio il nome è il titolo della pagina (`hero`): eredita il
 * colore del titolo e non compete in blu con la gerarchia. Negli elenchi resta
 * il collegamento blu EcoSolare. Usare `/lead/…` in pipeline e `/clienti/…` in
 * anagrafica e commesse.
 */
export function LinkNome({
  href,
  children,
  className = '',
  hero = false,
}: {
  href: string
  children: ReactNode
  className?: string
  /** Titolo di pagina: il nome è ciò che deve balzare all'occhio. */
  hero?: boolean
}) {
  return (
    <Link
      href={href}
      className={
        hero
          ? `collega text-inherit transition-colors hover:text-eco-gold-300 ${className}`.trim()
          : `collega text-eco-blue-300 transition-colors hover:underline hover:text-eco-gold-300 ${className}`.trim()
      }
    >
      {children}
    </Link>
  )
}

/** Compone nome e cognome omette i vuoti. */
export function nomePersona(
  nome: string | null | undefined,
  cognome: string | null | undefined,
): string {
  return [nome, cognome].filter(Boolean).join(' ')
}
