import Image from 'next/image'
import { redirect } from 'next/navigation'
import { homeDopoAccesso } from '@/lib/auth/home'
import { getCurrentUser } from '@/lib/auth/session'
import { ModuloAccesso } from './modulo'

export const metadata = { title: 'Accedi — EcoSolare OS' }

const FLUSSO = ['Lead', 'Sopralluogo', 'Preventivo', 'Cantiere', 'Lavoro completato']

export default async function AccediPage() {
  const utente = await getCurrentUser()
  if (utente) redirect(homeDopoAccesso(utente))

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* Aurora dietro la soglia: oro del sole in alto, blu del marchio in
          basso. Sono luci, non decorazioni: definiscono il centro. */}
      <div
        className="alone-accesso"
        aria-hidden
        style={{
          width: 560,
          height: 560,
          top: '-12%',
          left: '50%',
          marginLeft: -280,
          background:
            'radial-gradient(closest-side, rgba(217,164,65,0.16) 0%, rgba(217,164,65,0.05) 45%, transparent 75%)',
        }}
      />
      <div
        className="alone-accesso"
        aria-hidden
        style={{
          width: 640,
          height: 640,
          bottom: '-22%',
          right: '-10%',
          background:
            'radial-gradient(closest-side, rgba(63,127,196,0.14) 0%, rgba(63,127,196,0.04) 50%, transparent 78%)',
          animationDelay: '-5.5s',
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="rivela mb-8 flex justify-center">
          <Image
            src="/brand/ecosolare-logo.png"
            alt="EcoSolare"
            width={601}
            height={193}
            priority
            className="h-16 w-auto"
            style={{ filter: 'drop-shadow(0 4px 18px rgba(217,164,65,0.28))' }}
          />
        </div>

        <div
          className="pannello rivela p-8"
          style={{ '--ritardo': '90ms', borderColor: 'rgba(217,164,65,0.25)' } as React.CSSProperties}
        >
          <p className="eyebrow">Operating System</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            Accesso riservato
          </h1>
          <div className="mt-4 filetto barra-cresce" />

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

        <div
          className="rivela mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs"
          style={{ '--ritardo': '220ms' } as React.CSSProperties}
        >
          {FLUSSO.map((tappa, indice) => (
            <span key={tappa} className="flex items-center gap-2">
              <span
                style={{
                  color: indice === FLUSSO.length - 1 ? '#d9a441' : '#5b9bd5',
                }}
              >
                {tappa}
              </span>
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
