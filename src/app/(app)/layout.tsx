import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { signOut } from '@/auth'
import { Sidebar, type VoceMenu } from '@/components/sidebar'
import { TransizionePagina } from '@/components/transizione'
import { can, type Resource, type Role } from '@/lib/auth/policy'
import { getCurrentUser } from '@/lib/auth/session'

const ETICHETTA_RUOLO: Record<Role, string> = {
  amministratore: 'Amministratore',
  contabilita: 'Contabilità',
  commerciale: 'Commerciale',
  cantiere: 'Cantiere',
}

/**
 * La navigazione mostra solo cio' che l'utente puo' effettivamente aprire.
 *
 * Nascondere una voce non e' un controllo di accesso — quello avviene comunque
 * nel backend (ADR-006) — ma mostrare voci che poi negano l'accesso insegna
 * alle persone che il sistema non e' affidabile.
 */
const VOCI: readonly (VoceMenu & { resource: Resource })[] = [
  { href: '/', label: 'Cruscotto', icona: '◈', gruppo: 'operativo', resource: 'dashboard' },
  { href: '/clienti', label: 'Clienti', icona: '◐', gruppo: 'operativo', resource: 'contact' },
  { href: '/opportunita', label: 'Opportunità', icona: '◭', gruppo: 'operativo', resource: 'opportunity' },
  { href: '/sopralluoghi', label: 'Sopralluoghi', icona: '⌂', gruppo: 'operativo', resource: 'survey' },
  { href: '/preventivi', label: 'Preventivi', icona: '€', gruppo: 'operativo', resource: 'quote' },
  { href: '/attivita', label: 'Attività', icona: '✓', gruppo: 'operativo', resource: 'activity' },
  { href: '/approvazioni', label: 'Approvazioni', icona: '⚑', gruppo: 'amministrazione', resource: 'quote_approval' },
  { href: '/amministrazione/utenti', label: 'Utenti', icona: '◇', gruppo: 'amministrazione', resource: 'user' },
  { href: '/amministrazione/configurazioni', label: 'Configurazioni', icona: '⚙', gruppo: 'amministrazione', resource: 'settings' },
]

export default async function AppLayout({ children }: { children: ReactNode }) {
  const utente = await getCurrentUser()
  if (!utente) redirect('/accedi')

  async function esci() {
    'use server'
    await signOut({ redirectTo: '/accedi' })
  }

  const voci = VOCI.filter((v) => can(utente, 'read', v.resource)).map(
    ({ href, label, icona, gruppo }) => ({ href, label, icona, gruppo }),
  )

  const capacita = [
    utente.canViewCosts ? 'Vede i costi' : null,
    utente.isFieldOnly ? 'Solo campo' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="min-h-screen">
      <Sidebar
        voci={voci}
        utente={{
          nome: utente.name ?? utente.email,
          ruolo: ETICHETTA_RUOLO[utente.role],
          capacita: capacita || null,
        }}
        azioneEsci={
          <form action={esci}>
            <button
              type="submit"
              className="w-full rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
            >
              Esci
            </button>
          </form>
        }
      />

      {/* La sidebar resta fuori dalla transizione: e' l'elemento che da'
          continuita' fra una schermata e l'altra. */}
      <main className="ml-60 min-h-screen px-8 py-8">
        <div className="mx-auto max-w-6xl">
          <TransizionePagina>{children}</TransizionePagina>
        </div>
      </main>
    </div>
  )
}
