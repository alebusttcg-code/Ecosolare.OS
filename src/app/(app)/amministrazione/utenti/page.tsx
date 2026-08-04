import { asc } from 'drizzle-orm'
import { getDb } from '@/db'
import { users } from '@/db/schema'
import { guard } from '@/lib/auth/session'
import { GestioneUtenti } from './gestione'

export const metadata = { title: 'Utenti — EcoSolare OS' }

export default async function UtentiPage() {
  const utente = await guard('read', 'user')

  const elenco = await getDb()
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      canViewCosts: users.canViewCosts,
      isFieldOnly: users.isFieldOnly,
      isActive: users.isActive,
    })
    .from(users)
    .orderBy(asc(users.email))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Utenti</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
          {elenco.length} abilitati. Nessuno puo accedere senza essere in questo elenco.
        </p>
      </div>

      <GestioneUtenti utenti={elenco} utenteCorrenteId={utente.id} />
    </div>
  )
}
