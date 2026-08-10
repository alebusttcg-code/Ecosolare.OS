import { and, desc, eq, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { LinkNome, nomePersona } from '@/components/link-nome'
import { Badge, Card, Intestazione, Vuoto, formattaData, formattaEuro } from '@/components/ui'
import { getDb } from '@/db'
import { contacts, opportunities, quoteVersions, quotes } from '@/db/schema'
import { can } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import { puoEliminarePreventivo, type StatoVersione } from '@/lib/domain/quote-lifecycle'
import { EliminaPreventivo } from './elimina'

export const metadata = { title: 'Preventivi e firme — EcoSolare OS' }

const ETICHETTA: Record<StatoVersione, { testo: string; tono: 'neutro' | 'blu' | 'positivo' | 'attenzione' | 'critico' }> = {
  bozza: { testo: 'Bozza', tono: 'neutro' },
  in_approvazione: { testo: 'In approvazione', tono: 'attenzione' },
  approvato: { testo: 'Approvato', tono: 'blu' },
  inviato: { testo: 'Consegnato', tono: 'blu' },
  accettato: { testo: 'Accettato', tono: 'positivo' },
  rifiutato: { testo: 'Rifiutato', tono: 'critico' },
  scaduto: { testo: 'Scaduto', tono: 'critico' },
}

export default async function PreventiviPage() {
  const utente = await guard('read', 'quote')

  const puoEliminare = can(utente, 'update', 'quote')

  const righe = await getDb()
    .select({
      quoteId: quotes.id,
      versionId: quoteVersions.id,
      versionNo: quoteVersions.versionNo,
      status: quoteVersions.status,
      grossTotal: quoteVersions.grossTotal,
      marginPct: quoteVersions.marginPct,
      sentAt: quoteVersions.sentAt,
      code: quotes.code,
      title: quotes.title,
      opportunityId: opportunities.id,
      opportunityCode: opportunities.code,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
    })
    .from(quotes)
    .innerJoin(quoteVersions, eq(quoteVersions.id, quotes.currentVersionId))
    .innerJoin(opportunities, eq(opportunities.id, quotes.opportunityId))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .where(and(isNull(opportunities.deletedAt), isNull(contacts.deletedAt)))
    .orderBy(desc(quotes.createdAt))
    .limit(100)

  const aperti = righe.filter(
    (r) => !['accettato', 'rifiutato', 'scaduto'].includes(r.status),
  ).length

  return (
    <div>
      <Intestazione
        titolo="Preventivi e firme"
        sottotitolo={`${righe.length} in elenco · ${aperti} ancora aperti`}
      />

      <Card>
        {righe.length === 0 ? (
          <Vuoto messaggio="Nessun preventivo. Si apre dalla scheda di un lead." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b text-left"
                  style={{ borderColor: 'var(--bordo-tenue)' }}
                >
                  <th className="pb-2.5 text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
                    Contatto
                  </th>
                  <th className="pb-2.5 text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
                    Preventivo
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
                  {puoEliminare ? (
                    <th className="pb-2.5 w-px text-right text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
                      <span className="sr-only">Azioni</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {righe.map((r) => {
                  const statoVersione = r.status as StatoVersione
                  const stato = ETICHETTA[statoVersione]
                  const margine = r.marginPct === null ? null : Number.parseFloat(r.marginPct)
                  const eliminabile =
                    puoEliminare && puoEliminarePreventivo(statoVersione) && !r.sentAt

                  return (
                    <tr
                      key={r.versionId}
                      className="riga border-b last:border-0"
                      style={{ borderColor: 'var(--bordo-tenue)' }}
                    >
                      <td className="py-3">
                        <LinkNome href={`/lead/${r.opportunityId}`} className="font-medium">
                          {nomePersona(r.clienteNome, r.clienteCognome)}
                        </LinkNome>
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/preventivi/${r.versionId}`}
                          className="collega transition-colors hover:text-eco-gold-300"
                          style={{ color: 'var(--color-eco-blue-300)' }}
                        >
                          {r.title}
                        </Link>
                        <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                          {r.code} · v{r.versionNo}
                          {r.sentAt ? ` · consegnato ${formattaData(r.sentAt)}` : ''}
                        </div>
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
                      {puoEliminare ? (
                        <td className="py-3 text-right">
                          {eliminabile ? (
                            <EliminaPreventivo quoteId={r.quoteId} titolo={r.title} />
                          ) : null}
                        </td>
                      ) : null}
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
