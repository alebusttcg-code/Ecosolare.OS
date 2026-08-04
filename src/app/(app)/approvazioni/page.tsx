import { and, desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { Card, Intestazione, Vuoto, formattaData } from '@/components/ui'
import { getDb } from '@/db'
import { approvals, quoteVersions, quotes, users } from '@/db/schema'
import { guard } from '@/lib/auth/session'
import { Decisione } from './decisione'

export const metadata = { title: 'Approvazioni — EcoSolare OS' }

export default async function ApprovazioniPage() {
  const utente = await guard('read', 'quote_approval')

  const righe = await getDb()
    .select({
      id: approvals.id,
      reason: approvals.reason,
      context: approvals.context,
      requestedAt: approvals.requestedAt,
      requestedBy: approvals.requestedBy,
      richiedente: users.name,
      richiedenteEmail: users.email,
      versionId: quoteVersions.id,
      versionNo: quoteVersions.versionNo,
      revenueNet: quoteVersions.revenueNet,
      marginPct: quoteVersions.marginPct,
      quoteCode: quotes.code,
      quoteTitle: quotes.title,
    })
    .from(approvals)
    .leftJoin(users, eq(users.id, approvals.requestedBy))
    .innerJoin(quoteVersions, eq(quoteVersions.id, approvals.entityId))
    .innerJoin(quotes, eq(quotes.id, quoteVersions.quoteId))
    .where(
      and(eq(approvals.status, 'richiesta'), eq(approvals.entityType, 'quote_version')),
    )
    .orderBy(desc(approvals.requestedAt))

  return (
    <div className="space-y-6">
      <Intestazione
        eyebrow="Direzione"
        titolo="Approvazioni"
        sottotitolo={`${righe.length} in attesa di decisione`}
      />

      {righe.length === 0 ? (
        <Card>
          <Vuoto messaggio="Nessuna richiesta in attesa." />
        </Card>
      ) : (
        righe.map((r) => {
          const proprio = r.requestedBy === utente.id

          return (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/preventivi/${r.versionId}`}
                    className="text-sm font-medium text-eco-blue-300 hover:underline"
                  >
                    {r.quoteCode} — {r.quoteTitle} (v{r.versionNo})
                  </Link>
                  <div className="mt-1 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                    {r.reason} · richiesta da {r.richiedente ?? r.richiedenteEmail} il{' '}
                    {formattaData(r.requestedAt)}
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <div className="tabular-nums">
                    {r.marginPct === null ? '—' : `${r.marginPct}%`}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                    su {r.revenueNet} €
                  </div>
                </div>
              </div>

              {proprio ? (
                <p
                  className="mt-4 rounded border p-3 text-xs"
                  style={{ borderColor: 'var(--bordo)', background: 'rgba(255,255,255,0.04)' }}
                >
                  Hai presentato tu questa richiesta: deve deciderla qualcun altro. È il
                  senso stesso del passaggio di approvazione.
                </p>
              ) : (
                <Decisione approvalId={r.id} />
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}
