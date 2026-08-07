import Link from 'next/link'
import { Badge, Card, Intestazione, Vuoto, formattaData } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import { getAttivitaAperte } from '@/lib/queries/dashboard'
import { CompletaAttivita } from './completa'

export const metadata = { title: 'Le mie attività — EcoSolare OS' }

const ETICHETTA_TIPO: Record<string, string> = {
  chiamata: 'Chiamata',
  email: 'Email',
  whatsapp: 'WhatsApp',
  appuntamento: 'Appuntamento',
  sopralluogo: 'Sopralluogo',
  task: 'Attività',
  nota: 'Nota',
}

export default async function AttivitaPage() {
  const utente = await guard('read', 'activity')
  const righe = await getAttivitaAperte(utente.id)

  return (
    <div className="space-y-6">
      <Intestazione
        titolo="Le mie attività"
        sottotitolo={`${righe.length} aperte, dalla più urgente`}
      />

      <Card>
        {righe.length === 0 ? (
          <Vuoto messaggio="Nessuna attività aperta." />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
            {righe.map((a) => (
              <li key={a.id} className="riga rounded-md py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{a.subject}</span>
                        {a.isNextAction ? <Badge tone="positivo">Prossima azione</Badge> : null}
                      </div>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                        {ETICHETTA_TIPO[a.kind] ?? a.kind}
                        {a.opportunityId ? (
                          <>
                            {' · '}
                            <Link
                              href={`/lead/${a.opportunityId}`}
                              className="text-eco-blue-300 hover:underline collega"
                            >
                              {a.opportunityCode} {a.opportunityTitle}
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {a.scaduta ? (
                        <Badge tone="attenzione">Scaduta {formattaData(a.dueAt)}</Badge>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                          {formattaData(a.dueAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2">
                    <CompletaAttivita
                      activityId={a.id}
                      richiedeProssima={a.isNextAction && a.opportunityId !== null}
                    />
                  </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
