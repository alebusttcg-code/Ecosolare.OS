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
  await guard('read', 'contact')

  const { q = '', p = '1' } = await searchParams
  const pagina = Math.max(1, Number.parseInt(p, 10) || 1)
  const { righe, totale } = await searchContacts(q, pagina)
  const perPagina = 25
  const pagine = Math.max(1, Math.ceil(totale / perPagina))

  return (
    <div className="space-y-6">
      <Intestazione
        titolo="Clienti"
        sottotitolo={
          totale === 0
            ? 'Nessun cliente ancora: nasce quando un lead firma un preventivo.'
            : `${totale} ${totale === 1 ? 'cliente' : 'clienti'} con contratto firmato`
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
                : 'Un lead diventa cliente solo dopo aver accettato e firmato un preventivo. Parti da Lead → Nuovo lead.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left text-xs"
                style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
              >
                <th className="pb-2 font-medium">Nome</th>
                <th className="pb-2 font-medium">Recapiti</th>
                <th className="pb-2 font-medium">Commesse</th>
                <th className="pb-2 text-right font-medium">Cliente dal</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((riga) => (
                <tr
                  key={riga.id}
                  className="riga border-b last:border-0"
                  style={{ borderColor: 'var(--bordo)' }}
                >
                  <td className="py-2.5">
                    <Link
                      href={`/clienti/${riga.id}`}
                      className="font-medium text-eco-blue-300 hover:underline collega"
                    >
                      {[riga.firstName, riga.lastName].filter(Boolean).join(' ')}
                    </Link>
                  </td>
                  <td className="py-2.5" style={{ color: 'var(--testo-tenue)' }}>
                    {riga.phone ?? riga.email ?? '—'}
                  </td>
                  <td className="py-2.5">
                    {riga.commesse > 0 ? (
                      <Badge tone="positivo">{riga.commesse}</Badge>
                    ) : (
                      <span style={{ color: 'var(--testo-tenue)' }}>—</span>
                    )}
                  </td>
                  <td
                    className="py-2.5 text-right"
                    style={{ color: 'var(--testo-tenue)' }}
                  >
                    {formattaData(riga.clienteDal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
