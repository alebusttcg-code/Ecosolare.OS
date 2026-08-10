import Link from 'next/link'
import { LinkNome } from '@/components/link-nome'
import { SelettorePeriodoEconomia } from '@/components/selettore-periodo-economia'
import { Badge, Card, Stat, Vuoto, formattaData } from '@/components/ui'
import { formattaImporto } from '@/lib/domain/money'
import type { StatoVersione } from '@/lib/domain/quote-lifecycle'
import { periodiEconomiaPreset, risolviPeriodoEconomia } from '@/lib/domain/periodo-economia'
import { elencoPreventiviAperti, getPanoramicaEconomica } from '@/lib/queries/economia'

const ETICHETTA_PREVENTIVO: Record<
  StatoVersione,
  { testo: string; tono: 'neutro' | 'blu' | 'attenzione' }
> = {
  bozza: { testo: 'Bozza', tono: 'neutro' },
  in_approvazione: { testo: 'In approvazione', tono: 'attenzione' },
  approvato: { testo: 'Approvato', tono: 'blu' },
  inviato: { testo: 'Consegnato', tono: 'blu' },
  accettato: { testo: 'Accettato', tono: 'blu' },
  rifiutato: { testo: 'Rifiutato', tono: 'neutro' },
  scaduto: { testo: 'Scaduto', tono: 'neutro' },
}

export async function SezioneEconomia({
  canViewCosts,
  params,
  coorte,
  adesso,
}: {
  canViewCosts: boolean
  params: { periodo?: string; da?: string; a?: string }
  coorte?: string
  adesso: Date
}) {
  const periodo = risolviPeriodoEconomia(params, adesso)
  const preset = periodiEconomiaPreset(adesso)
  const panoramica = await getPanoramicaEconomica(canViewCosts, periodo)
  const preventivi = await elencoPreventiviAperti(periodo, 10)

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow" style={{ color: 'var(--color-eco-gold-300)' }}>
            Economia
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Risultati economici
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
            Periodo eventi · {periodo.etichetta} · fatturato, incassi, preventivi e
            cantieri
          </p>
        </div>
        <SelettorePeriodoEconomia
          periodo={periodo}
          preset={preset}
          customDa={params.da}
          customA={params.a}
          conserva={coorte ? { coorte } : undefined}
        />
      </div>

      <div>
        <p className="mb-3 eyebrow" style={{ color: 'var(--testo-fioco)' }}>
          Incassi
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 [&>*]:h-full">
          <Stat
            label="Fatturato totale"
            value={panoramica.fatturatoTotale / 100}
            formato="euro"
            icona="€"
            indice={0}
            hint="scadenze fatturate o incassate nel periodo"
          />
          <Stat
            label="Incassato"
            value={panoramica.incassatoTotale / 100}
            formato="euro"
            tone="positivo"
            icona="✓"
            indice={1}
            hint="pagamenti verificati nel periodo"
          />
          <Stat
            label="Da incassare"
            value={panoramica.daIncassare / 100}
            formato="euro"
            tone={panoramica.daIncassare > 0 ? 'attenzione' : 'neutro'}
            icona="◷"
            indice={2}
            hint="fatturato del periodo non ancora incassato"
          />
          <Stat
            label="Previsto a piano"
            value={panoramica.incassiPrevisti / 100}
            formato="euro"
            icona="◇"
            indice={3}
            hint={`${panoramica.incassiPrevistiConteggio} scadenze nel periodo`}
          />
        </div>
      </div>

      <div>
        <p className="mb-3 eyebrow" style={{ color: 'var(--testo-fioco)' }}>
          Pipeline e cantieri
        </p>
        <div
          className={`grid grid-cols-2 gap-4 [&>*]:h-full ${
            panoramica.marginePrevistoAperto !== null ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
          }`}
        >
          <Stat
            label="Preventivi aperti"
            value={panoramica.preventiviApertiImporto / 100}
            formato="euro"
            icona="◭"
            indice={4}
            hint={`${panoramica.preventiviApertiConteggio} consegnati nel periodo, ancora aperti`}
          />
          {panoramica.marginePrevistoAperto !== null ? (
            <Stat
              label="Margine previsto (aperti)"
              value={panoramica.marginePrevistoAperto / 100}
              formato="euro"
              icona="▦"
              indice={5}
              hint="su preventivi ancora in trattativa"
            />
          ) : null}
          <Stat
            label="Contratti firmati"
            value={panoramica.contrattiFirmatiImporto / 100}
            formato="euro"
            icona="✎"
            indice={6}
            hint={`${panoramica.contrattiFirmatiConteggio} firmati nel periodo`}
          />
          <Stat
            label="Cantieri attivi"
            value={panoramica.commesseAttiveImporto / 100}
            formato="euro"
            icona="◫"
            indice={7}
            hint={`${panoramica.commesseAttiveConteggio} avviati nel periodo, ancora aperti`}
          />
        </div>
      </div>

      <Card indice={8}>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h3 className="text-sm font-medium">Preventivi aperti</h3>
          <Link
            href="/preventivi"
            className="text-xs transition-colors hover:text-eco-gold-300 collega"
            style={{ color: 'var(--color-eco-blue-300)' }}
          >
            Tutti i preventivi →
          </Link>
        </div>

        {preventivi.length === 0 ? (
          <Vuoto messaggio="Nessun preventivo aperto consegnato in questo periodo." />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
            {preventivi.map((p) => {
              const stato = ETICHETTA_PREVENTIVO[p.stato as StatoVersione] ?? {
                testo: p.stato,
                tono: 'neutro' as const,
              }
              return (
                <li
                  key={p.versionId}
                  className="riga flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <LinkNome href={`/lead/${p.opportunityId}`} className="text-sm font-medium">
                      {p.cliente}
                    </LinkNome>
                    <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                      <Link
                        href={`/preventivi/${p.versionId}`}
                        className="text-eco-blue-300 hover:underline collega"
                      >
                        {p.titolo}
                      </Link>
                      {' · '}
                      {p.code}
                      {p.inviatoIl ? ` · consegnato ${formattaData(p.inviatoIl)}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {p.marginePct !== null ? (
                      <span className="text-xs tabular-nums" style={{ color: 'var(--testo-tenue)' }}>
                        {p.marginePct.toFixed(1)}%
                      </span>
                    ) : null}
                    <span className="text-sm tabular-nums">{formattaImporto(p.totale)}</span>
                    <Badge tone={stato.tono}>{stato.testo}</Badge>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
        Gli incassi seguono le date di fattura e incasso; i preventivi la consegna (o la
        creazione se non ancora consegnati); i contratti la firma; i cantieri la data di
        avvio. Il margine reale a consuntivo arriverà con la Fase 5 del blueprint.
      </p>
    </section>
  )
}
