import Image from 'next/image'
import { redirect } from 'next/navigation'
import { signIn } from '@/auth'
import { getCurrentUser } from '@/lib/auth/session'

export const metadata = { title: 'Accedi — EcoSolare OS' }

const FLUSSO = ['Lead', 'Sopralluogo', 'Preventivo', 'Commessa', 'Cantiere', 'Margine']

export default async function AccediPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (await getCurrentUser()) redirect('/')

  const { error } = await searchParams

  async function accediConGoogle() {
    'use server'
    await signIn('google', { redirectTo: '/' })
  }

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
          <p className="eyebrow">Operating System</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            Accesso riservato
          </h1>
          <div className="mt-4 filetto" />

          {error ? (
            <p
              className="mt-6 rounded-lg border px-4 py-3 text-sm"
              style={{
                borderColor: 'rgba(224,133,133,0.4)',
                background: 'rgba(224,133,133,0.08)',
                color: '#e8a0a0',
              }}
            >
              Accesso non riuscito. L&apos;account deve essere stato abilitato da un
              amministratore.
            </p>
          ) : null}

          <form action={accediConGoogle} className="mt-6">
            <button
              type="submit"
              className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
                color: '#050a14',
              }}
            >
              Accedi con Google
            </button>
          </form>

          <p
            className="mt-6 text-xs leading-relaxed"
            style={{ color: 'var(--testo-fioco)' }}
          >
            L&apos;accesso è riservato agli utenti abilitati. La verifica in due passaggi
            è gestita dall&apos;account Google aziendale.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs">
          {FLUSSO.map((tappa, indice) => (
            <span key={tappa} className="flex items-center gap-2">
              <span style={{ color: indice > 3 ? '#d9a441' : '#5b9bd5' }}>{tappa}</span>
              {indice < FLUSSO.length - 1 ? (
                <span style={{ color: 'var(--testo-fioco)' }}>›</span>
              ) : null}
            </span>
          ))}
        </div>
      </div>
    </main>
  )
}
