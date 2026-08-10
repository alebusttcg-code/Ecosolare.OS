import Link from 'next/link'
import { Badge, Card, Intestazione, Vuoto, formattaData } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import { searchContacts } from '@/lib/queries/contacts'

export const metadata = { title: 'Clienti — EcoSolare OS' }

export default async function ClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>
}) {
  // L'autorizzazione si verifica anche qui, non solo nel menu (ADR-006).
  const utente = await guard('read', 'contact')

  const { q = '', p = '1' } = await searchParams
  const pagina = Math.max(1, Number.parseInt(p, 10) || 1)
  const { righe, totale } = await searchContacts(utente, q, pagina)
  const perPagina = 25
  const pagine = Math.max(1, Math.ceil(totale / perPagina))

  return (
    <div className="space-y-6">
      <Intestazione
        titolo="Clienti"
        sottotitolo={
          totale === 0
            ? 'Nessun cliente ancora: nasce quando confermi un preventivo accettato e apri il cantiere.'
            : `${totale} ${totale === 1 ? 'cliente' : 'clienti'} con cantiere aperto`
        }
      />

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cerca per nome, email o telefono…"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
        />
        <button
          type="submit"
          className="bottone-fantasma rounded-lg border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Cerca
        </button>
      </form>

      <Card>
        {righe.length === 0 ? (
          <Vuoto
            messaggio={
              q
                ? `Nessun risultato per "${q}".`
                : 'Un lead diventa cliente quando accetti il preventivo e usi «Conferma e apri cantiere». Parti da Lead → Nuovo lead.'
            }
          />
        ) : (
          <div>
            <div
              className="mb-2 hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] gap-4 text-xs sm:grid"
              style={{ color: 'var(--testo-tenue)' }}
            >
              <span>Nome</span>
              <span>Recapiti</span>
              <span className="text-center">Cantieri</span>
              <span className="text-right">Cliente dal</span>
            </div>
            <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
              {righe.map((riga) => (
                <li key={riga.id} className="first:pt-0 last:pb-0">
                  <Link
                    href={`/clienti/${riga.id}`}
                    prefetch={false}
                    className="riga group grid grid-cols-1 gap-1 rounded-md py-3 outline-none focus-visible:ring-2 focus-visible:ring-[rgba(91,155,213,0.45)] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4"
                  >
                    <span className="truncate text-sm font-medium text-eco-blue-300 transition-colors group-hover:text-eco-gold-300">
                      {[riga.firstName, riga.lastName].filter(Boolean).join(' ')}
                    </span>
                    <span className="truncate text-sm" style={{ color: 'var(--testo-tenue)' }}>
                      {riga.phone ?? riga.email ?? '—'}
                    </span>
                    <span className="sm:text-center">
                      {riga.commesse > 0 ? (
                        <Badge tone="positivo">{riga.commesse}</Badge>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
                          —
                        </span>
                      )}
                    </span>
                    <span
                      className="text-sm sm:text-right"
                      style={{ color: 'var(--testo-tenue)' }}
                    >
                      {formattaData(riga.clienteDal)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {pagine > 1 ? (
        <div className="flex items-center justify-center gap-4 text-sm">
          {pagina > 1 ? (
            <Link href={`/clienti?q=${encodeURIComponent(q)}&p=${pagina - 1}`}>
              ← Precedente
            </Link>
          ) : null}
          <span style={{ color: 'var(--testo-tenue)' }}>
            Pagina {pagina} di {pagine}
          </span>
          {pagina < pagine ? (
            <Link href={`/clienti?q=${encodeURIComponent(q)}&p=${pagina + 1}`}>
              Successiva →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
