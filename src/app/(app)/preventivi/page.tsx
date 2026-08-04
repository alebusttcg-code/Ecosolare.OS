import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { Badge, Card, Intestazione, Vuoto, formattaData, formattaEuro } from '@/components/ui'
import { getDb } from '@/db'
import { contacts, opportunities, quoteVersions, quotes } from '@/db/schema'
import { guard } from '@/lib/auth/session'
import type { StatoVersione } from '@/lib/domain/quote-lifecycle'

export const metadata = { title: 'Preventivi — EcoSolare OS' }

const ETICHETTA: Record<StatoVersione, { testo: string; tono: 'neutro' | 'blu' | 'positivo' | 'attenzione' | 'critico' }> = {
  bozza: { testo: 'Bozza', tono: 'neutro' },
  in_approvazione: { testo: 'In approvazione', tono: 'attenzione' },
  approvato: { testo: 'Approvato', tono: 'blu' },
  inviato: { testo: 'Inviato', tono: 'blu' },
  accettato: { testo: 'Accettato', tono: 'positivo' },
  rifiutato: { testo: 'Rifiutato', tono: 'critico' },
  scaduto: { testo: 'Scaduto', tono: 'critico' },
}

export default async function PreventiviPage() {
  const utente = await guard('read', 'quote')

  const righe = await getDb()
    .select({
      versionId: quoteVersions.id,
      versionNo: quoteVersions.versionNo,
      status: quoteVersions.status,
      grossTotal: quoteVersions.grossTotal,
      marginPct: quoteVersions.marginPct,
      sentAt: quoteVersions.sentAt,
      code: quotes.code,
      title: quotes.title,
      opportunityCode: opportunities.code,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
    })
    .from(quotes)
    .innerJoin(quoteVersions, eq(quoteVersions.id, quotes.currentVersionId))
    .innerJoin(opportunities, eq(opportunities.id, quotes.opportunityId))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .orderBy(desc(quotes.createdAt))
    .limit(100)

  const aperti = righe.filter(
    (r) => !['accettato', 'rifiutato', 'scaduto'].includes(r.status),
  ).length

  return (
    <div>
      <Intestazione
        eyebrow="Commerciale"
        titolo="Preventivi"
        sottotitolo={`${righe.length} in archivio · ${aperti} ancora aperti`}
      />

      <Card>
        {righe.length === 0 ? (
          <Vuoto messaggio="Nessun preventivo. Si aprono dalla scheda di un'opportunità." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b text-left"
                  style={{ borderColor: 'var(--bordo-tenue)' }}
                >
                  <th className="pb-2.5 text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
                    Preventivo
                  </th>
                  <th className="pb-2.5 text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
                    Cliente
                  </th>
                  <th className="pb-2.5 text-right text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
                    Totale
                  </th>
                  {utente.canViewCosts ? (
                    <th className="pb-2.5 text-right text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
                      Margine
                    </th>
                  ) : null}
                  <th className="pb-2.5 text-right text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
                    Stato
                  </th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r) => {
                  const stato = ETICHETTA[r.status as StatoVersione]
                  const margine = r.marginPct === null ? null : Number.parseFloat(r.marginPct)

                  return (
                    <tr
                      key={r.versionId}
                      className="border-b last:border-0"
                      style={{ borderColor: 'var(--bordo-tenue)' }}
                    >
                      <td className="py-3">
                        <Link
                          href={`/preventivi/${r.versionId}`}
                          className="font-medium transition-colors hover:text-eco-gold-300"
                          style={{ color: 'var(--color-eco-blue-300)' }}
                        >
                          {r.title}
                        </Link>
                        <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                          {r.code} · v{r.versionNo}
                          {r.sentAt ? ` · inviato ${formattaData(r.sentAt)}` : ''}
                        </div>
                      </td>
                      <td className="py-3" style={{ color: 'var(--testo-tenue)' }}>
                        {[r.clienteNome, r.clienteCognome].filter(Boolean).join(' ')}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formattaEuro(r.grossTotal)}
                      </td>
                      {utente.canViewCosts ? (
                        <td
                          className="py-3 text-right tabular-nums"
                          style={{
                            color:
                              margine === null
                                ? 'var(--testo-fioco)'
                                : margine < 20
                                  ? 'var(--color-eco-gold-300)'
                                  : 'var(--color-eco-green-400)',
                          }}
                        >
                          {margine === null ? '—' : `${margine.toFixed(1)}%`}
                        </td>
                      ) : null}
                      <td className="py-3 text-right">
                        <Badge tone={stato.tono}>{stato.testo}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
