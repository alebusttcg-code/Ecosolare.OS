import Link from 'next/link'
import { Badge, Card, Vuoto, formattaData } from '@/components/ui'
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Clienti</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
            {totale} {totale === 1 ? 'contatto' : 'contatti'}
          </p>
        </div>
        <Link
          href="/clienti/nuovo"
          className="rounded-md bg-eco-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-eco-blue-600"
        >
          Nuovo cliente
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cerca per nome, email o telefono…"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
        />
        <button
          type="submit"
          className="rounded-md border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Cerca
        </button>
      </form>

      <Card>
        {righe.length === 0 ? (
          <Vuoto
            messaggio={
              q ? `Nessun risultato per "${q}".` : 'Nessun cliente ancora registrato.'
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left text-xs"
                style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
              >
                <th className="pb-2 font-medium">Nome</th>
                <th className="pb-2 font-medium">Contatti</th>
                <th className="pb-2 font-medium">Opportunita</th>
                <th className="pb-2 text-right font-medium">Creato</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((riga) => (
                <tr key={riga.id} className="border-b last:border-0" style={{ borderColor: 'var(--bordo)' }}>
                  <td className="py-2.5">
                    <Link
                      href={`/clienti/${riga.id}`}
                      className="font-medium text-eco-blue-500 hover:underline"
                    >
                      {[riga.firstName, riga.lastName].filter(Boolean).join(' ')}
                    </Link>
                  </td>
                  <td className="py-2.5" style={{ color: 'var(--testo-tenue)' }}>
                    {riga.phone ?? riga.email ?? '—'}
                  </td>
                  <td className="py-2.5">
                    {riga.opportunitaAperte > 0 ? (
                      <Badge tone="positivo">{riga.opportunitaAperte} aperte</Badge>
                    ) : (
                      <span style={{ color: 'var(--testo-tenue)' }}>—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right" style={{ color: 'var(--testo-tenue)' }}>
                    {formattaData(riga.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
