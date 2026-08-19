import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AvvisiProvider } from '@/components/avvisi'
import { Sidebar, type VoceMenu } from '@/components/sidebar'
import { TransizionePagina } from '@/components/transizione'
import { esci } from '@/lib/actions/auth'
import { can, type Action, type Resource, type Role } from '@/lib/auth/policy'
import { getCurrentUser } from '@/lib/auth/session'
import { contaAttivitaScadute } from '@/lib/queries/dashboard'
import { contaApprovazioniInAttesa } from '@/lib/queries/quotes'

const ETICHETTA_RUOLO: Record<Role, string> = {
  amministratore: 'Amministratore',
  contabilita: 'Contabilità',
  commerciale: 'Commerciale',
  cantiere: 'Operativo',
}

/**
 * Navigazione per AREE, non per tabelle.
 *
 * L'ordine del «Ciclo di lavoro» segue il percorso del cliente:
 * lead → sopralluogo → preventivo/firma → anagrafica consolidata → cantiere →
 * archivio dei lavori finiti. Gli URL coincidono con i nomi di menu
 * (`/lead`, `/agenda`, `/cantieri`, …): niente gergo tecnico nascosto
 * dietro etichette diverse. «Clienti» sta dopo le firme perché lì nasce il
 * rapporto stabile; prima è ancora un lead. Il filtro «Completati» dei cantieri è l'archivio:
 * non compete con le commesse aperte, serve a ritrovare tutto di un lavoro già
 * chiuso. Gli stati della pipeline NON stanno qui — sono filtri dentro «Lead»,
 * non sezioni: sono sedici, cambiano dopo l'audit, e la domanda vera non è
 * «quali sono in stato negoziazione» ma «cosa devo fare oggi».
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
const VOCI: readonly (VoceMenu & {
  resource: Resource
  azione?: Action
  /** Visibile solo a questo ruolo (es. panoramica economica direzione). */
  soloRuolo?: Role
})[] = [
  {
    // Ogni ruolo ha la sua home su `/`: cruscotto per la direzione, la giornata
    // per gli altri. Niente più `soloRuolo`: la matrice consente a tutti la
    // lettura della dashboard, e la pagina sceglie cosa mostrare.
    href: '/',
    label: 'Home',
    icona: '◈',
    gruppo: 'direzione',
    resource: 'dashboard',
  },

  { href: '/lead', label: 'Lead', icona: '◭', gruppo: 'ciclo', resource: 'opportunity' },
  { href: '/sviluppo', label: 'Sviluppo', icona: '◎', gruppo: 'ciclo', resource: 'sviluppo' },
  { href: '/agenda', label: 'Sopralluoghi', icona: '⌂', gruppo: 'ciclo', resource: 'survey' },
  { href: '/preventivi', label: 'Preventivi e firme', icona: '€', gruppo: 'ciclo', resource: 'quote' },
  { href: '/clienti', label: 'Clienti', icona: '◐', gruppo: 'ciclo', resource: 'contact' },
  { href: '/cantieri', label: 'Cantieri', icona: '◫', gruppo: 'ciclo', resource: 'project' },
  { href: '/cantieri/agenda', label: 'Calendario cantieri', icona: '◷', gruppo: 'ciclo', resource: 'schedule' },

  { href: '/attivita', label: 'Da fare', icona: '✓', gruppo: 'lavoro', resource: 'activity' },
  // Fatturazione e controllo bancario: `azione: update` sull'invoice esclude il
  // commerciale (che ha sola lettura dello stato) e lascia amministrazione e
  // contabilità. Non serve `soloRuolo`: la matrice permessi fa già il taglio.
  { href: '/fatturazione', label: 'Fatturazione', icona: '▦', gruppo: 'lavoro', resource: 'invoice', azione: 'update' },
  { href: '/controllo-bancario', label: 'Controllo bancario', icona: '⚖', gruppo: 'lavoro', resource: 'invoice', azione: 'update' },
  { href: '/approvazioni', label: 'Approvazioni', icona: '⚑', gruppo: 'lavoro', resource: 'quote_approval' },

  { href: '/amministrazione/utenti', label: 'Utenti', icona: '◇', gruppo: 'amministrazione', resource: 'user' },
  { href: '/amministrazione/prodotti', label: 'Schede prodotto', icona: '▤', gruppo: 'amministrazione', resource: 'settings', azione: 'update' },
  { href: '/amministrazione/impostazioni', label: 'Impostazioni', icona: '⚙', gruppo: 'amministrazione', resource: 'settings' },
]

export default async function AppLayout({ children }: { children: ReactNode }) {
  const utente = await getCurrentUser()
  if (!utente) redirect('/accedi')

  // Finche' la password e' quella assegnata dall'amministratore, la sessione
  // non identifica ancora la persona: nessun dato prima del cambio.
  if (utente.mustChangePassword) redirect('/cambia-password')

  // Contatori nel menu, in parallelo: il pool serverless è a 4 connessioni, non
  // più a 1, quindi le due query non si contendono l'unica connessione e non
  // serve più metterle in fila.
  const [scadute, approvazioni] = await Promise.all([
    can(utente, 'read', 'activity') ? contaAttivitaScadute(utente.id) : Promise.resolve(0),
    can(utente, 'read', 'quote_approval')
      ? contaApprovazioniInAttesa()
      : Promise.resolve(0),
  ])
  const badge: Record<string, number> = {
    '/attivita': scadute,
    '/approvazioni': approvazioni,
  }

  const voci = VOCI.filter(
    (v) =>
      (!v.soloRuolo || utente.role === v.soloRuolo) &&
      can(utente, v.azione ?? 'read', v.resource),
  ).map(({ href, label, icona, gruppo }) => ({
      href,
      label,
      icona,
      gruppo,
      badge: badge[href] ?? 0,
    }))

  const capacita = [
    utente.canViewCosts ? 'Vede i costi' : null,
    utente.isFieldOnly ? 'Solo campo' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <AvvisiProvider>
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
              className="bottone-fantasma w-full rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
            >
              Esci
            </button>
          </form>
        }
      />

      {/* La sidebar resta fuori dalla transizione: è l'elemento che dà
          continuità fra una schermata e l'altra. Sotto lg la navigazione è
          una barra superiore (h-14) + cassetto: il main compensa con il
          padding alto invece del margine sinistro. */}
      <main className="min-h-screen px-4 pb-10 pt-[4.5rem] sm:px-6 lg:ml-64 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <TransizionePagina>{children}</TransizionePagina>
        </div>
      </main>
    </div>
    </AvvisiProvider>
  )
}
