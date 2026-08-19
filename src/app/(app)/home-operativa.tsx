import Link from 'next/link'
import { Badge, Card, Intestazione, Stat, Vuoto, formattaData } from '@/components/ui'
import type { CurrentUser } from '@/lib/auth/session'
import { contaScadute, listDaFare } from '@/lib/queries/da-fare'
import { dataEstesa, primoNome, saluto } from '@/lib/saluto'

/**
 * Home di chi lavora sul campo o al telefono (commerciale, cantiere).
 *
 * Non è il cruscotto della direzione: è **la giornata di questa persona**. In
 * cima le poche cose che contano oggi — quante sono in ritardo — e sotto la
 * lista di cosa fare, la stessa di «Da fare» ma già filtrata sulle proprie,
 * così chi entra non atterra su un elenco ma su quello che deve chiudere.
 */
export async function HomeOperativa({ utente }: { utente: CurrentUser }) {
  const voci = await listDaFare(
    { id: utente.id, role: utente.role },
    { tipo: 'tutte', persone: 'mie' },
  )
  const scadute = contaScadute(voci)
  const prossime = voci.slice(0, 8)

  const eCantiere = utente.role === 'cantiere'
  const destinazione = eCantiere
    ? { href: '/cantieri', label: 'Vai ai cantieri' }
    : { href: '/lead', label: 'Vai ai lead' }

  return (
    <div className="space-y-8">
      <Intestazione
        eyebrow="La tua giornata"
        titolo={`${saluto()}, ${primoNome(utente.name, utente.email)}`}
        titoloOro
        sottotitolo={`${dataEstesa()} · ${eCantiere ? 'i tuoi cantieri e le cose da fare' : 'i tuoi lead e le cose da fare'}`}
      />

      <div className="grid grid-cols-2 gap-4">
        <Stat
          label="In ritardo"
          value={scadute}
          tone={scadute > 0 ? 'critico' : 'positivo'}
          icona="⚑"
          href="/attivita"
          hint={scadute > 0 ? 'cose da fare oltre la scadenza' : 'sei in pari, niente in ritardo'}
        />
        <Stat
          label="Da fare in tutto"
          value={voci.length}
          tone="neutro"
          icona="✓"
          href="/attivita"
          hint="attività e follow-up aperti a te assegnati"
        />
      </div>

      <Card
        title="Le tue prossime cose da fare"
        action={
          <Link href="/attivita" className="text-xs" style={{ color: 'var(--color-eco-blue-300)' }}>
            Tutte →
          </Link>
        }
      >
        {prossime.length === 0 ? (
          <Vuoto messaggio="Niente in coda: nessuna attività aperta a te assegnata." />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
            {prossime.map((v) => {
              const corpo = (
                <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{v.subject}</div>
                    <div
                      className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
                      style={{ color: 'var(--testo-fioco)' }}
                    >
                      {v.clienteNome ? <span>{v.clienteNome}</span> : null}
                      {v.faseLabel ? <span>· {v.faseLabel}{v.step ? ` ${v.step}/2` : ''}</span> : null}
                      {v.opportunityCode ? <span>· {v.opportunityCode}</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <span className="text-xs tabular-nums" style={{ color: 'var(--testo-tenue)' }}>
                      {v.dueAt ? formattaData(v.dueAt) : 'senza scadenza'}
                    </span>
                    {v.scaduta ? <Badge tone="critico">In ritardo</Badge> : null}
                  </div>
                </div>
              )
              return (
                <li key={v.id}>
                  {v.opportunityId ? (
                    <Link href={`/lead/${v.opportunityId}`} prefetch={false} className="riga block rounded-md">
                      {corpo}
                    </Link>
                  ) : (
                    corpo
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <div>
        <Link
          href={destinazione.href}
          className="bottone-fantasma inline-flex rounded-lg border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--bordo)' }}
        >
          {destinazione.label} →
        </Link>
      </div>
    </div>
  )
}
