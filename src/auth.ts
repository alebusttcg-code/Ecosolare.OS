import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { count, eq } from 'drizzle-orm'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { getDb } from '@/db'
import { accounts, sessions, users, verificationTokens } from '@/db/schema'
import { env } from '@/env'

/**
 * Autenticazione — D-003a.
 *
 * Due proprieta' che vanno tenute in questo ordine di importanza:
 *
 *  1. NESSUNA AUTO-REGISTRAZIONE. Un account Google valido del dominio non basta
 *     per entrare: l'utente deve essere stato creato da un amministratore.
 *     Senza questa regola, chiunque nel dominio aziendale entrerebbe nel gestionale
 *     con ruolo di default.
 *  2. La verifica in due passaggi e' delegata a Google Workspace, dove va imposta
 *     come obbligatoria per gli amministratori. Non la reimplementiamo qui.
 *
 * L'unica eccezione alla regola 1 e' il primo accesso in assoluto, che crea
 * l'amministratore iniziale: senza, non esisterebbe nessuno che possa creare
 * gli altri.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const config = env()

  return {
    adapter: DrizzleAdapter(getDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),

    session: {
      // Sessioni su database, non JWT: la disattivazione di un utente deve
      // avere effetto immediato, non alla scadenza del token (US-01.1).
      strategy: 'database',
      maxAge: 60 * 60 * 12,
    },

    providers: [
      Google({
        clientId: config.AUTH_GOOGLE_ID,
        clientSecret: config.AUTH_GOOGLE_SECRET,
      }),
    ],

    pages: {
      signIn: '/accedi',
      error: '/accedi',
    },

    callbacks: {
      async signIn({ user, profile }) {
        const email = user.email ?? profile?.email
        if (!email) return false

        // Restrizione di dominio (D-003a).
        const dominio = config.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase()
        if (dominio && !email.toLowerCase().endsWith(`@${dominio}`)) {
          return false
        }

        // Google conferma l'identita', ma non l'autorizzazione a entrare.
        if (profile && profile.email_verified === false) return false

        const db = getDb()
        const esistente = await db.query.users.findFirst({
          where: eq(users.email, email),
          columns: { id: true, isActive: true },
        })

        if (esistente) return esistente.isActive

        // Bootstrap del primo amministratore: consentito solo se il database
        // non contiene ancora nessun utente.
        const bootstrap = config.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase()
        if (!bootstrap || email.toLowerCase() !== bootstrap) return false

        const [totale] = await db.select({ value: count() }).from(users)
        return (totale?.value ?? 0) === 0
      },

      session({ session, user }) {
        // Il ruolo e le capacita' viaggiano nella sessione per comodita' della UI,
        // ma non sono la fonte di verita': ogni endpoint li rilegge dal database
        // prima di decidere (vedere src/lib/auth/session.ts).
        session.user.id = user.id
        session.user.role = user.role
        session.user.canViewCosts = user.canViewCosts
        session.user.isFieldOnly = user.isFieldOnly
        session.user.isActive = user.isActive
        return session
      },
    },

    events: {
      async createUser({ user }) {
        const bootstrap = config.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase()
        if (!bootstrap || !user.email || user.id === undefined) return
        if (user.email.toLowerCase() !== bootstrap) return

        // L'utente appena creato dal bootstrap nasce con i default piu'
        // restrittivi: qui lo si promuove ad amministratore.
        await getDb()
          .update(users)
          .set({ role: 'amministratore', canViewCosts: true, updatedAt: new Date() })
          .where(eq(users.id, user.id))
      },
    },

    trustHost: true,
  }
})
