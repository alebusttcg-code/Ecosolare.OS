import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LinkNome, nomePersona } from '@/components/link-nome'
import { Badge, Card, formattaData } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import { puoModificare, type StatoVersione } from '@/lib/domain/quote-lifecycle'
import { getCatalogo, getQuoteVersion } from '@/lib/queries/quotes'
import { CHIAVI_MARGINE, getSetting } from '@/lib/settings'
import { AzioniPreventivo } from './azioni'
import { RegistraFirma } from './firma'
import { EditorPreventivo } from './editor'

export const metadata = { title: 'Preventivi e firme — EcoSolare OS' }

const ETICHETTA_STATO: Record<StatoVersione, string> = {
  bozza: 'Bozza',
  in_approvazione: 'In approvazione',
  approvato: 'Approvato',
  inviato: 'Inviato',
  accettato: 'Accettato',
  rifiutato: 'Rifiutato',
  scaduto: 'Scaduto',
}

export default async function PreventivoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const utente = await guard('read', 'quote')
  const { id } = await params

  // La capacita' decide cosa viene serializzato verso il browser, non solo
  // cosa si vede (§11.4 regola 7).
  const mostraCosti = utente.canViewCosts

  const [dati, catalogo, soglia] = await Promise.all([
    getQuoteVersion(id, mostraCosti),
    getCatalogo(mostraCosti),
    getSetting(CHIAVI_MARGINE.sogliaMarginePct, 20),
  ])

  if (!dati) notFound()

  const stato = dati.versione.status as StatoVersione
  const modificabile = puoModificare(stato)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/preventivi"
          className="text-sm"
          style={{ color: 'var(--testo-tenue)' }}
        >
          ← Preventivi e firme
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            <LinkNome href={`/lead/${dati.opportunityId}`} hero>
              {nomePersona(dati.clienteNome, dati.clienteCognome) || 'Senza nome'}
            </LinkNome>
          </h1>
          <Badge
            tone={
              stato === 'accettato'
                ? 'positivo'
                : stato === 'rifiutato' || stato === 'scaduto'
                  ? 'critico'
                  : stato === 'in_approvazione'
                    ? 'attenzione'
                    : 'neutro'
            }
          >
            {ETICHETTA_STATO[stato]}
          </Badge>
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
          {dati.quoteTitle} · {dati.quoteCode} · versione {dati.versione.versionNo} · lead{' '}
          <Link href={`/lead/${dati.opportunityId}`} className="text-eco-blue-300 hover:underline collega">
            {dati.opportunityCode}
          </Link>
        </p>
      </div>

      {!modificabile ? (
        <p
          className="rounded-lg border p-3 text-sm"
          style={{ borderColor: 'var(--bordo)', background: 'rgba(255,255,255,0.04)' }}
        >
          Questa versione non è modificabile: il contatto ha ricevuto questi numeri e devono
          restare ricostruibili. Per cambiare qualcosa, crea una nuova versione.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <EditorPreventivo
            versionId={dati.versione.id}
            righeIniziali={dati.righe}
            scontoIniziale={Number.parseFloat(dati.versione.globalDiscountPct)}
            modificabile={modificabile}
            mostraCosti={mostraCosti}
            catalogo={catalogo}
            sogliaMarginePct={soglia}
          />
        </div>

        <div className="space-y-6">
          <Card title="Azioni">
            <AzioniPreventivo
              versionId={dati.versione.id}
              quoteId={dati.quoteId}
              titolo={dati.quoteTitle}
              stato={stato}
              haRighe={dati.righe.length > 0}
            />
          </Card>

          {stato === 'inviato' || stato === 'accettato' ? (
            <Card title="Contratto" accento="oro">
              <RegistraFirma versionId={dati.versione.id} />
            </Card>
          ) : null}

          <Card title="Versioni">
            <ul className="space-y-2 text-sm">
              {dati.versioni.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <Link
                    href={`/preventivi/${v.id}`}
                    className={
                      v.id === dati.versione.id
                        ? 'font-medium'
                        : 'text-eco-blue-300 hover:underline'
                    }
                  >
                    v{v.versionNo}
                  </Link>
                  <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                    {ETICHETTA_STATO[v.status as StatoVersione]}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {dati.versione.sentAt ? (
            <Card title="Cronologia">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt style={{ color: 'var(--testo-tenue)' }}>Inviato</dt>
                  <dd>{formattaData(dati.versione.sentAt)}</dd>
                </div>
                {dati.versione.decidedAt ? (
                  <div className="flex justify-between">
                    <dt style={{ color: 'var(--testo-tenue)' }}>Deciso</dt>
                    <dd>{formattaData(dati.versione.decidedAt)}</dd>
                  </div>
                ) : null}
                {dati.versione.rejectionReason ? (
                  <div>
                    <dt style={{ color: 'var(--testo-tenue)' }}>Motivo del rifiuto</dt>
                    <dd>{dati.versione.rejectionReason}</dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
