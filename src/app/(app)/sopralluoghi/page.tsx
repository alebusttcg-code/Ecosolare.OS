import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { Badge, Card, Intestazione, Vuoto, formattaData } from '@/components/ui'
import { getDb } from '@/db'
import { contacts, opportunities, surveyTemplates, surveys, users } from '@/db/schema'
import { guard } from '@/lib/auth/session'

export const metadata = { title: 'Sopralluoghi — EcoSolare OS' }

export default async function SopralluoghiPage() {
  await guard('read', 'survey')

  const righe = await getDb()
    .select({
      id: surveys.id,
      status: surveys.status,
      completedAt: surveys.completedAt,
      performedAt: surveys.performedAt,
      hasCriticalIssues: surveys.hasCriticalIssues,
      estimatedPowerKw: surveys.estimatedPowerKw,
      templateName: surveyTemplates.name,
      opportunityCode: opportunities.code,
      opportunityTitle: opportunities.title,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
      tecnico: users.name,
    })
    .from(surveys)
    .innerJoin(surveyTemplates, eq(surveyTemplates.id, surveys.templateId))
    .innerJoin(opportunities, eq(opportunities.id, surveys.opportunityId))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .leftJoin(users, eq(users.id, surveys.performedBy))
    .orderBy(desc(surveys.createdAt))
    .limit(100)

  const inCorso = righe.filter((r) => r.status === 'bozza').length

  return (
    <div>
      <Intestazione
        eyebrow="Tecnico"
        titolo="Sopralluoghi"
        sottotitolo={`${righe.length} in archivio · ${inCorso} da completare`}
      />

      <Card>
        {righe.length === 0 ? (
          <Vuoto messaggio="Nessun sopralluogo. Si aprono dalla scheda di un'opportunità." />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
            {righe.map((r) => (
              <li
                key={r.id}
                className="riga flex items-center justify-between gap-4 rounded-md py-3.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/sopralluoghi/${r.id}`}
                    className="collega text-sm font-medium transition-colors hover:text-eco-gold-300"
                    style={{ color: 'var(--color-eco-blue-300)' }}
                  >
                    {[r.clienteNome, r.clienteCognome].filter(Boolean).join(' ')}
                  </Link>
                  <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                    {r.opportunityCode} · {r.templateName}
                    {r.tecnico ? ` · ${r.tecnico}` : ''}
                    {r.estimatedPowerKw ? ` · ${r.estimatedPowerKw} kWp` : ''}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {r.hasCriticalIssues ? <Badge tone="attenzione">Criticità</Badge> : null}
                  {r.status === 'completato' ? (
                    <Badge tone="positivo">
                      Completato {formattaData(r.completedAt)}
                    </Badge>
                  ) : (
                    <Badge tone="blu">In compilazione</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
