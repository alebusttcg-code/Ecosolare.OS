import { redirect } from 'next/navigation'
import { signOut } from '@/auth'
import { getCurrentUser } from '@/lib/auth/session'
import type { Role } from '@/lib/auth/policy'

const ETICHETTA_RUOLO: Record<Role, string> = {
  amministratore: 'Amministratore',
  contabilita: 'Contabilita',
  commerciale: 'Commerciale',
  cantiere: 'Cantiere',
}

export default async function HomePage() {
  const utente = await getCurrentUser()
  if (!utente) redirect('/accedi')

  async function esci() {
    'use server'
    await signOut({ redirectTo: '/accedi' })
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-10 flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--bordo)' }}>
        <div>
          <h1 className="text-lg font-semibold">
            <span className="text-eco-blue-500">Eco</span>
            <span className="text-eco-gold-500">Solare</span>
            <span className="ml-2 font-normal" style={{ color: 'var(--testo-tenue)' }}>
              OS
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div>{utente.name ?? utente.email}</div>
            <div style={{ color: 'var(--testo-tenue)' }}>
              {ETICHETTA_RUOLO[utente.role]}
              {utente.canViewCosts ? ' · costi visibili' : ''}
              {utente.isFieldOnly ? ' · solo campo' : ''}
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
      </header>

      <section
        className="rounded-lg border p-6"
        style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
      >
        <h2 className="text-base font-semibold">Sprint 0 — fondamenta</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
          Autenticazione, ruoli, policy layer e audit log sono operativi. I moduli
          funzionali arrivano con la Fase 1, dopo l&apos;audit operativo.
        </p>

        <ul className="mt-6 space-y-2 text-sm">
          <li className="flex gap-2">
            <span className="text-eco-green-500">✓</span> Accesso con Google Workspace,
            nessuna auto-registrazione
          </li>
          <li className="flex gap-2">
            <span className="text-eco-green-500">✓</span> Quattro ruoli e due capacita,
            verificati server-side
          </li>
          <li className="flex gap-2">
            <span className="text-eco-green-500">✓</span> Audit log con distinzione fra
            utente, automazione e AI
          </li>
          <li className="flex gap-2">
            <span style={{ color: 'var(--testo-tenue)' }}>○</span>
            <span style={{ color: 'var(--testo-tenue)' }}>
              Anagrafiche, lead e pipeline — Fase 1
            </span>
          </li>
        </ul>
      </section>
    </main>
  )
}
