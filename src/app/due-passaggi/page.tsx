import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { mfaObbligatoria } from '@/lib/auth/mfa'
import { getCurrentUser } from '@/lib/auth/session'
import { ModuloDuePassaggi } from './modulo'

export const metadata = { title: 'Verifica in due passaggi — EcoSolare OS' }

/**
 * Fuori dal gruppo `(app)`: chi ha la verifica obbligatoria e non l'ha ancora
 * attivata viene mandato qui dal layout, e da lì non può andare altrove. Se la
 * pagina stesse dentro il gruppo, il reindirizzamento girerebbe su se stesso.
 */
export default async function DuePassaggiPage() {
  const utente = await getCurrentUser()
  if (!utente) redirect('/accedi')

  // Prima la password iniziale, poi il secondo fattore: chiedere di proteggere
  // una password che ancora non è sua non ha senso.
  if (utente.mustChangePassword) redirect('/cambia-password')

  const obbligatoria = mfaObbligatoria(utente.role)

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
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
            {utente.mfaAttiva
              ? 'Verifica in due passaggi'
              : obbligatoria
                ? 'Attiva la verifica in due passaggi'
                : 'Proteggi il tuo accesso'}
          </h1>
          <div className="mt-4 filetto" />

          {!utente.mfaAttiva ? (
            <p
              className="mt-6 text-sm leading-relaxed"
              style={{ color: 'var(--testo-tenue)' }}
            >
              {obbligatoria
                ? 'Il tuo ruolo vede costi, margini e anagrafiche complete: una password da sola non basta a proteggerli. Serve un minuto e si fa una volta.'
                : 'Aggiunge un codice che cambia ogni trenta secondi. Se qualcuno scopre la tua password, senza il tuo telefono non entra comunque.'}
            </p>
          ) : null}

          <ModuloDuePassaggi
            attiva={utente.mfaAttiva}
            obbligatoria={obbligatoria}
            email={utente.email}
          />

          {utente.mfaAttiva || !obbligatoria ? (
            <p className="mt-8 text-xs" style={{ color: 'var(--testo-fioco)' }}>
              <Link href="/" className="underline">
                Torna al programma
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </main>
  )
}
