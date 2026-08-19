import Link from 'next/link'
import { Card, Intestazione, Stat, Vuoto, formattaEuro } from '@/components/ui'
import type { CurrentUser } from '@/lib/auth/session'
import { getFattureElenco } from '@/lib/queries/fatture'
import { dataEstesa, primoNome, saluto } from '@/lib/saluto'

/**
 * Home della contabilità: non i lead, ma i soldi da chiudere.
 *
 * In cima le fatture ancora in bozza — quelle che aspettano un numero — e la
 * porta al controllo bancario. Sotto, la lista delle bozze da emettere, così la
 * prima azione della giornata è già davanti invece che a due clic di distanza.
 */
export async function HomeContabilita({ utente }: { utente: CurrentUser }) {
  const fatture = await getFattureElenco()
  const bozze = fatture.filter((f) => f.status === 'bozza')
  const emesse = fatture.filter(
    (f) => f.status === 'emessa' || f.status === 'esportata' || f.status === 'incassata',
  )
  const prime = bozze.slice(0, 8)

  return (
    <div className="space-y-8">
      <Intestazione
        eyebrow="Amministrazione"
        titolo={`${saluto()}, ${primoNome(utente.name, utente.email)}`}
        titoloOro
        sottotitolo={`${dataEstesa()} · fatture da emettere e controllo incassi`}
      />

      <div className="grid grid-cols-2 gap-4">
        <Stat
          label="Da emettere"
          value={bozze.length}
          tone={bozze.length > 0 ? 'attenzione' : 'positivo'}
          icona="▦"
          href="/fatturazione"
          hint={bozze.length > 0 ? 'bozze in attesa di numero' : 'nessuna bozza in attesa'}
        />
        <Stat
          label="Emesse"
          value={emesse.length}
          tone="neutro"
          icona="€"
          href="/fatturazione"
          hint="fatture numerate a registro"
        />
      </div>

      <Card
        title="Bozze da emettere"
        action={
          <Link href="/fatturazione" className="text-xs" style={{ color: 'var(--color-eco-blue-300)' }}>
            Fatturazione →
          </Link>
        }
      >
        {prime.length === 0 ? (
          <Vuoto messaggio="Nessuna bozza in attesa. Le fatture nascono da una scadenza del piano pagamenti." />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
            {prime.map((f) => (
              <li key={f.id}>
                <Link
                  href="/fatturazione"
                  prefetch={false}
                  className="riga flex flex-col gap-1 rounded-md py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{f.cliente}</div>
                    {f.projectCode ? (
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                        {f.projectCode}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-sm font-semibold tabular-nums sm:text-right">
                    {formattaEuro(f.totale)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/controllo-bancario"
          className="bottone-fantasma inline-flex rounded-lg border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Controllo bancario →
        </Link>
        <Link
          href="/cantieri"
          className="bottone-fantasma inline-flex rounded-lg border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Cantieri →
        </Link>
      </div>
    </div>
  )
}
