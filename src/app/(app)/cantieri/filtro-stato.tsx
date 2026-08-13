import Link from 'next/link'

/**
 * Aperti o chiusi: è un filtro, non due sezioni.
 *
 * Come in «Da fare», il filtro è un collegamento e non stato del componente:
 * la vista resta condivisibile, ricaricabile e raggiungibile da un segnalibro.
 */

export type StatoCantieri = 'attivi' | 'completati'

export function leggiStatoCantieri(valore: string | undefined): StatoCantieri {
  return valore === 'completati' ? 'completati' : 'attivi'
}

const VOCI: readonly { valore: StatoCantieri; etichetta: string; href: string }[] = [
  { valore: 'attivi', etichetta: 'Aperti', href: '/cantieri' },
  { valore: 'completati', etichetta: 'Completati', href: '/cantieri?stato=completati' },
]

export function FiltroStato({ attivo }: { attivo: StatoCantieri }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {VOCI.map((voce) => (
        <Link
          key={voce.valore}
          href={voce.href}
          className="rounded-lg border px-3 py-1.5 text-xs"
          style={{
            borderColor:
              attivo === voce.valore ? 'var(--color-eco-gold-400)' : 'var(--bordo)',
            color:
              attivo === voce.valore ? 'var(--color-eco-gold-400)' : 'var(--testo-fioco)',
          }}
        >
          {voce.etichetta}
        </Link>
      ))}
    </div>
  )
}
