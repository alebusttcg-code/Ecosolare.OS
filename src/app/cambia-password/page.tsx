import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { ModuloCambioPassword } from './modulo'

export const metadata = { title: 'Cambia password — EcoSolare OS' }

/**
 * Fuori dal gruppo `(app)`: questa pagina deve essere raggiungibile proprio
 * quando il resto dell'applicazione è precluso, cioè finché la persona usa
 * ancora la password che le è stata assegnata.
 */
export default async function CambiaPasswordPage() {
  const utente = await getCurrentUser()
  if (!utente) redirect('/accedi')

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image
            src="/brand/ecosolare-logo.png"
            alt="EcoSolare"
            width={601}
            height={193}
            priority
            className="h-14 w-auto"
          />
        </div>

        <div className="pannello p-8">
          <p className="eyebrow">{utente.email}</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            {utente.mustChangePassword ? 'Scegli la tua password' : 'Cambia password'}
          </h1>
          <div className="mt-4 filetto" />

          {utente.mustChangePassword ? (
            <p
              className="mt-6 text-xs leading-relaxed"
              style={{ color: 'var(--testo-tenue)' }}
            >
              Quella che stai usando l&apos;ha generata un amministratore, quindi la
              conosce anche lui: finché non la cambi non identifica te. Da qui in poi
              nessuno potrà più leggerla.
            </p>
          ) : null}

          <ModuloCambioPassword />
        </div>
      </div>
    </main>
  )
}
