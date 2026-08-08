'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * Blocca lo scroll del documento mentre un overlay è aperto.
 *
 * Ripristina overflow alla chiusura e al cambio di route: se un portal
 * smonta in ritardo dopo la navigazione, la pagina non resta «congelata»
 * senza scroll né click.
 */
export function useBloccaScroll(attivo: boolean) {
  const percorso = usePathname()
  const percorsoPrec = useRef(percorso)

  useEffect(() => {
    if (!attivo) {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      return
    }

    const precedenteOverflow = document.body.style.overflow
    const precedentePadding = document.body.style.paddingRight
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) {
      document.body.style.paddingRight = `${scrollbar}px`
    }

    return () => {
      document.body.style.overflow = precedenteOverflow
      document.body.style.paddingRight = precedentePadding
    }
  }, [attivo])

  useEffect(() => {
    if (percorsoPrec.current === percorso) return
    percorsoPrec.current = percorso
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  }, [percorso])
}
