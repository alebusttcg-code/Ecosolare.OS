import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { Sidebar, type VoceMenu } from '@/components/sidebar'
import { TransizionePagina } from '@/components/transizione'
import { esci } from '@/lib/actions/auth'
import { can, type Action, type Resource, type Role } from '@/lib/auth/policy'
import { getCurrentUser } from '@/lib/auth/session'

const ETICHETTA_RUOLO: Record<Role, string> = {
  amministratore: 'Amministratore',
  contabilita: 'Contabilità',
  commerciale: 'Commerciale',
  cantiere: 'Cantiere',
}

/**
 * Navigazione per AREE, non per tabelle.
 *
 * I nomi ricalcano l'architettura logica presentata all'azienda: chi ha visto
 * quello schema ritrova qui le stesse parole. Gli stati della pipeline NON
 * stanno qui — sono filtri dentro «Acquisizione lead», non sezioni: sono
 * sedici, cambiano dopo l'audit, e la domanda vera non è «quali sono in stato
 * negoziazione» ma «cosa devo fare oggi».
 *
 * Mostrare solo ciò che l'utente può aprire non è un controllo di accesso —
 * quello avviene comunque nel backend (ADR-006) — ma una voce che poi nega
 * l'accesso insegna che il sistema non è affidabile.
 */
/**
 * `azione` serve dove leggere non basta per rendere utile la voce: il controllo
 * bancario e' uno strumento operativo, e mostrarlo a chi puo' solo consultare
 * gli incassi sarebbe una voce che non porta a nulla.
 */
const VOCI: readonly (VoceMenu & { resource: Resource; azione?: Action })[] = [
  { href: '/', label: 'Dashboard', icona: '◈', gruppo: 'direzione', resource: 'dashboard' },
  { href: '/metriche', label: 'Metriche commerciali', icona: '▦', gruppo: 'direzione', resource: 'dashboard' },

  { href: '/clienti', label: 'Clienti', icona: '◐', gruppo: 'ciclo', resource: 'contact' },
  { href: '/opportunita', label: 'Acquisizione lead', icona: '◭', gruppo: 'ciclo', resource: 'opportunity' },
  { href: '/sopralluoghi', label: 'Agenda e sopralluoghi', icona: '⌂', gruppo: 'ciclo', resource: 'survey' },
  { href: '/preventivi', label: 'Preventivi e firme', icona: '€', gruppo: 'ciclo', resource: 'quote' },
  { href: '/commesse', label: 'Cantieri e commesse', icona: '◫', gruppo: 'ciclo', resource: 'project' },

  { href: '/attivita', label: 'Le mie attività', icona: '✓', gruppo: 'lavoro', resource: 'activity' },
  { href: '/banca', label: 'Controllo bancario', icona: '⚖', gruppo: 'lavoro', resource: 'invoice', azione: 'update' },
  { href: '/approvazioni', label: 'Approvazioni', icona: '⚑', gruppo: 'lavoro', resource: 'quote_approval' },

  { href: '/amministrazione/utenti', label: 'Utenti', icona: '◇', gruppo: 'amministrazione', resource: 'user' },
  { href: '/amministrazione/configurazioni', label: 'Configurazioni', icona: '⚙', gruppo: 'amministrazione', resource: 'settings' },
]

export default async function AppLayout({ children }: { children: ReactNode }) {
  const utente = await getCurrentUser()
  if (!utente) redirect('/accedi')

  // Finche' la password e' quella assegnata dall'amministratore, la sessione
  // non identifica ancora la persona: nessun dato prima del cambio.
  if (utente.mustChangePassword) redirect('/cambia-password')

  const voci = VOCI.filter((v) => can(utente, v.azione ?? 'read', v.resource)).map(
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
              className="bottone-fantasma w-full rounded-lg border px-3 py-1.5 text-xs"
              style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
            >
              Esci
            </button>
          </form>
        }
      />

      {/* La sidebar resta fuori dalla transizione: è l'elemento che dà
          continuità fra una schermata e l'altra. */}
      <main className="ml-64 min-h-screen px-8 py-8">
        <div className="mx-auto max-w-6xl">
          <TransizionePagina>{children}</TransizionePagina>
        </div>
      </main>
    </div>
  )
}
