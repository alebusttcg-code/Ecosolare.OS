import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { signOut } from '@/auth'
import { can, type Resource, type Role } from '@/lib/auth/policy'
import { getCurrentUser } from '@/lib/auth/session'

const ETICHETTA_RUOLO: Record<Role, string> = {
  amministratore: 'Amministratore',
  contabilita: 'Contabilita',
  commerciale: 'Commerciale',
  cantiere: 'Cantiere',
}

/**
 * La navigazione mostra solo cio' che l'utente puo' effettivamente aprire.
 *
 * Nascondere una voce di menu non e' un controllo di accesso — quello avviene
 * comunque nel backend (ADR-006) — ma mostrare voci che poi negano l'accesso
 * insegna alle persone che il sistema e' inaffidabile.
 */
const VOCI: readonly { href: string; label: string; resource: Resource }[] = [
  { href: '/', label: 'Cruscotto', resource: 'dashboard' },
  { href: '/clienti', label: 'Clienti', resource: 'contact' },
  { href: '/opportunita', label: 'Opportunita', resource: 'opportunity' },
  { href: '/attivita', label: 'Attivita', resource: 'activity' },
  { href: '/amministrazione/utenti', label: 'Utenti', resource: 'user' },
  { href: '/amministrazione/configurazioni', label: 'Configurazioni', resource: 'settings' },
]

export default async function AppLayout({ children }: { children: ReactNode }) {
  const utente = await getCurrentUser()
  if (!utente) redirect('/accedi')

  async function esci() {
    'use server'
    await signOut({ redirectTo: '/accedi' })
  }

  const voci = VOCI.filter((v) => can(utente, 'read', v.resource))

  return (
    <div className="min-h-screen">
      <header className="border-b" style={{ borderColor: 'var(--bordo)' }}>
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-3">
          <Link href="/" className="text-base font-semibold">
            <span className="text-eco-blue-500">Eco</span>
            <span className="text-eco-gold-500">Solare</span>
          </Link>

          <nav className="flex flex-1 gap-1">
            {voci.map((voce) => (
              <Link
                key={voce.href}
                href={voce.href}
                className="rounded px-3 py-1.5 text-sm hover:bg-eco-blue-50"
              >
                {voce.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div>{utente.name ?? utente.email}</div>
              <div className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                {ETICHETTA_RUOLO[utente.role]}
              </div>
            </div>
            <form action={esci}>
              <button
                type="submit"
                className="rounded border px-3 py-1.5 text-sm"
                style={{ borderColor: 'var(--bordo)' }}
              >
                Esci
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
