import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { ModuloAccesso } from './modulo'

export const metadata = { title: 'Accedi — EcoSolare OS' }

const FLUSSO = ['Lead', 'Sopralluogo', 'Preventivo', 'Commessa', 'Cantiere', 'Margine']

export default async function AccediPage() {
  if (await getCurrentUser()) redirect('/')

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

          <ModuloAccesso />

          <p
            className="mt-6 text-xs leading-relaxed"
            style={{ color: 'var(--testo-fioco)' }}
          >
            Le credenziali le assegna un amministratore. Se hai dimenticato la
            password, chiedigli di rigenerarla: nessuno può leggerla, nemmeno il
            sistema.
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
