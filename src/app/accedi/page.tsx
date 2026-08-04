import { redirect } from 'next/navigation'
import { signIn } from '@/auth'
import { getCurrentUser } from '@/lib/auth/session'

export const metadata = { title: 'Accedi — EcoSolare OS' }

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
      <div
        className="w-full max-w-sm rounded-lg border p-8"
        style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
      >
        <div className="mb-8">
          <h1 className="text-xl font-semibold">
            <span className="text-eco-blue-500">Eco</span>
            <span className="text-eco-gold-500">Solare</span>
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
            Sistema operativo aziendale
          </p>
        </div>

        {error ? (
          <p className="mb-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            Accesso non riuscito. L&apos;account deve essere stato abilitato da un
            amministratore.
          </p>
        ) : null}

        <form action={accediConGoogle}>
          <button
            type="submit"
            className="w-full rounded-md bg-eco-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-eco-blue-600"
          >
            Accedi con Google
          </button>
        </form>

        <p className="mt-6 text-xs leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
          L&apos;accesso e riservato agli utenti abilitati. La verifica in due passaggi
          e gestita dall&apos;account Google aziendale.
        </p>
      </div>
    </main>
  )
}
