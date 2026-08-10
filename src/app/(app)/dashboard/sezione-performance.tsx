import Link from 'next/link'
import { Badge, Card, Stat, Vuoto, ritardo } from '@/components/ui'
import {
  calcolaImbuto,
  calcolaMaturita,
  calcolaTempi,
  calcolaValori,
  formattaGiorni,
  formattaOre,
  formattaPercentuale,
  motiviDiPerdita,
  ripartisci,
  totaleAzienda,
  type RigaRipartizione,
} from '@/lib/domain/funnel'
import { formattaImporto } from '@/lib/domain/money'
import { urlPeriodoEconomia } from '@/lib/domain/periodo-economia'
import { getCoorteCommerciale, periodiDisponibili, trovaPeriodo } from '@/lib/queries/metrics'

export async function SezionePerformance({
  coorteCodice,
  periodoEconomia,
  adesso,
}: {
  coorteCodice?: string
  periodoEconomia: { periodo?: string; da?: string; a?: string }
  adesso: Date
}) {
  const periodo = trovaPeriodo(coorteCodice, adesso)
  const periodi = periodiDisponibili(adesso)
  const coorte = await getCoorteCommerciale(periodo.da, periodo.a)

  const imbuto = calcolaImbuto(coorte)
  const tempi = calcolaTempi(coorte)
  const valori = calcolaValori(coorte)
  const maturita = calcolaMaturita(coorte)
  const azienda = totaleAzienda(coorte)
  const perFonte = ripartisci(coorte, (p) => p.fonte)
  const perCommerciale = ripartisci(coorte, (p) => p.commerciale, 'Non assegnato')
  const perLinea = ripartisci(coorte, (p) => p.lineaBusiness)
  const perdite = motiviDiPerdita(coorte)
  const massimoImbuto = Math.max(1, ...imbuto.map((t) => t.conteggio))

  const hrefCoorte = (codice: string) =>
    urlPeriodoEconomia(
      periodoEconomia.periodo ?? 'mese',
      periodoEconomia.da,
      periodoEconomia.a,
      { coorte: codice },
    )

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow" style={{ color: 'var(--color-eco-blue-300)' }}>
            Performance commerciale
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Analisi della coorte
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
            Coorte lead entrati {periodo.etichetta.toLowerCase()} · {coorte.length}{' '}
            pratiche · generale e per commerciale
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {periodi.map((p) => (
            <Link
              key={p.codice}
              href={hrefCoorte(p.codice)}
              className="rounded-lg border px-3 py-1.5 text-xs transition-colors"
              style={{
                borderColor:
                  p.codice === periodo.codice
                    ? 'var(--color-eco-gold-400)'
                    : 'var(--bordo)',
                color:
                  p.codice === periodo.codice
                    ? 'var(--color-eco-gold-300)'
                    : 'var(--testo-tenue)',
                background:
                  p.codice === periodo.codice ? 'rgba(217,164,65,0.08)' : 'transparent',
              }}
            >
              {p.etichetta}
            </Link>
          ))}
        </div>
      </div>

      {coorte.length === 0 ? (
        <Card>
          <Vuoto messaggio="Nessun lead entrato in questo periodo. Crea un lead da Lead → Nuovo lead e completa la prima attività di contatto." />
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <Stat label="Lead" value={azienda.lead} icona="◭" indice={0} />
            <Stat
              label="Sopralluoghi"
              value={azienda.sopralluoghi}
              icona="◎"
              indice={1}
              hint={`da lead ${formattaPercentuale(azienda.tassoSopralluogo)}`}
            />
            <Stat
              label="Contratti"
              value={azienda.contratti}
              tone="positivo"
              icona="✓"
              indice={2}
              hint={`chiusura ${formattaPercentuale(azienda.conversione)}`}
            />
            <Stat
              label="Fatturato"
              value={azienda.valore / 100}
              formato="euro"
              icona="€"
              indice={3}
            />
            <Stat
              label="Ticket medio"
              value={(valori.ticketMedio ?? 0) / 100}
              formato="euro"
              icona="◇"
              indice={4}
              hint={valori.ticketMedio === null ? 'nessun contratto' : undefined}
            />
            <Stat
              label="In corso"
              value={maturita.ancoraAperte}
              icona="…"
              indice={5}
              hint={formattaImporto(valori.valoreInCorso)}
            />
          </div>

          {maturita.ancoraAperte > 0 ? (
            <div
              className="rounded-xl border p-4 text-sm"
              style={{
                borderColor: 'rgba(91,155,213,0.35)',
                background: 'rgba(91,155,213,0.06)',
              }}
            >
              <Badge tone="blu">Coorte non ancora matura</Badge>
              <p className="mt-2 leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
                {maturita.ancoraAperte} pratiche su {maturita.totale} sono ancora aperte (
                {formattaPercentuale(maturita.quotaConclusa)} ha già un esito). Le
                conversioni qui sotto sono destinate a salire: i lead più recenti non
                hanno ancora avuto il tempo di diventare contratti.
              </p>
            </div>
          ) : null}

          <Card title="Totale azienda" accento="oro" indice={0}>
            <p className="mb-4 text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Stessi indicatori della tabella per commerciale, sommati su tutta la
              coorte del periodo.
            </p>
            <TabellaPrestazioni
              righe={[azienda]}
              colonnaChiave="Ambito"
              evidenziaPrima
            />
          </Card>

          <Card title="Per commerciale" accento="blu" indice={1}>
            <p className="mb-4 text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Lead assegnati, sopralluoghi effettuati, tassi e fatturato da contratti
              firmati. Ordinati per fatturato generato.
            </p>
            <TabellaPrestazioni righe={perCommerciale} colonnaChiave="Commerciale" />
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card title="Imbuto commerciale" indice={1}>
                <ul className="space-y-3">
                  {imbuto.map((tappa, indice) => (
                    <li key={tappa.codice} className="riga rounded-md py-1">
                      <div className="flex items-center gap-4">
                        <span className="w-28 shrink-0 truncate text-sm sm:w-44">
                          {tappa.etichetta}
                        </span>
                        <div
                          className="h-2 flex-1 overflow-hidden rounded-full"
                          style={{ background: 'rgba(255,255,255,0.04)' }}
                        >
                          <div
                            className="barra-cresce h-full rounded-full"
                            style={{
                              width: `${(tappa.conteggio / massimoImbuto) * 100}%`,
                              background:
                                'linear-gradient(90deg, #3f7fc4 0%, #d9a441 100%)',
                              ...ritardo(indice, 60),
                            }}
                          />
                        </div>
                        <span className="w-10 text-right text-sm font-medium tabular-nums">
                          {tappa.conteggio}
                        </span>
                        <span
                          className="w-16 text-right text-xs tabular-nums"
                          style={{ color: 'var(--color-eco-gold-300)' }}
                          title="Conversione dalla tappa precedente"
                        >
                          {formattaPercentuale(tappa.daPrecedente)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                  La percentuale a destra è la conversione dalla tappa precedente.
                </p>
              </Card>
            </div>

            <Card title="Tempi mediani" accento="blu" indice={2}>
              <dl className="space-y-3 text-sm">
                <Tempo
                  etichetta="Presa in carico"
                  valore={formattaOre(tempi.speedToLeadOre)}
                  nota="dal lead alla prima risposta"
                />
                <Tempo
                  etichetta="Lead → sopralluogo"
                  valore={formattaGiorni(tempi.leadASopralluogoGiorni)}
                />
                <Tempo
                  etichetta="Sopralluogo → preventivo"
                  valore={formattaGiorni(tempi.sopralluogoAPreventivoGiorni)}
                />
                <Tempo
                  etichetta="Preventivo → firma"
                  valore={formattaGiorni(tempi.preventivoAFirmaGiorni)}
                />
                <div
                  className="flex items-baseline justify-between gap-3 border-t pt-3"
                  style={{ borderColor: 'var(--bordo-tenue)' }}
                >
                  <dt className="font-medium">Ciclo completo</dt>
                  <dd className="font-semibold tabular-nums">
                    {formattaGiorni(tempi.cicloCompletoGiorni)}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Ripartizione titolo="Per fonte" righe={perFonte} indice={1} />
            <Ripartizione titolo="Per linea di business" righe={perLinea} indice={2} />
          </div>

          <Card title="Dove si perde" accento="rosso" indice={2}>
            {perdite.length === 0 ? (
              <Vuoto messaggio="Nessuna pratica persa in questo periodo." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                {perdite.map((m) => (
                  <li
                    key={m.motivo}
                    className="riga flex items-center justify-between gap-4 rounded-md py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm">{m.motivo}</span>
                    <div className="flex shrink-0 items-center gap-4 text-sm">
                      <span className="tabular-nums" style={{ color: 'var(--testo-tenue)' }}>
                        {m.conteggio} · {formattaPercentuale(m.quota)}
                      </span>
                      <span
                        className="w-24 text-right tabular-nums"
                        style={{ color: 'var(--color-eco-red-400)' }}
                      >
                        {formattaImporto(m.valorePerso)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </section>
  )
}

function Tempo({
  etichetta,
  valore,
  nota,
}: {
  etichetta: string
  valore: string
  nota?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt style={{ color: 'var(--testo-tenue)' }}>
        {etichetta}
        {nota ? (
          <span className="block text-xs" style={{ color: 'var(--testo-fioco)' }}>
            {nota}
          </span>
        ) : null}
      </dt>
      <dd className="shrink-0 tabular-nums">{valore}</dd>
    </div>
  )
}

function TabellaPrestazioni({
  righe,
  colonnaChiave,
  evidenziaPrima = false,
}: {
  righe: readonly RigaRipartizione[]
  colonnaChiave: string
  evidenziaPrima?: boolean
}) {
  if (righe.length === 0) {
    return <Vuoto messaggio="Nessun dato." />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr
            className="border-b text-left text-xs"
            style={{ borderColor: 'var(--bordo-tenue)', color: 'var(--testo-fioco)' }}
          >
            <th className="pb-2 pr-3 font-medium">{colonnaChiave}</th>
            <th className="pb-2 text-right font-medium">Lead</th>
            <th className="pb-2 text-right font-medium">Soprall.</th>
            <th className="pb-2 text-right font-medium">Lead→sopr.</th>
            <th className="pb-2 text-right font-medium">Contratti</th>
            <th className="pb-2 text-right font-medium">Chiusura</th>
            <th className="pb-2 text-right font-medium">Fatturato</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r, i) => {
            const evidenzia = evidenziaPrima && i === 0
            return (
              <tr
                key={r.chiave}
                className="riga border-b last:border-0"
                style={{
                  borderColor: 'var(--bordo-tenue)',
                  background: evidenzia ? 'rgba(217,164,65,0.06)' : undefined,
                }}
              >
                <td className={`py-2.5 pr-3 ${evidenzia ? 'font-medium' : ''}`}>{r.chiave}</td>
                <td className="py-2.5 text-right tabular-nums">{r.lead}</td>
                <td className="py-2.5 text-right tabular-nums">{r.sopralluoghi}</td>
                <td
                  className="py-2.5 text-right tabular-nums"
                  style={{ color: 'var(--color-eco-blue-300)' }}
                >
                  {formattaPercentuale(r.tassoSopralluogo)}
                </td>
                <td className="py-2.5 text-right tabular-nums">{r.contratti}</td>
                <td
                  className="py-2.5 text-right tabular-nums"
                  style={{ color: 'var(--color-eco-gold-300)' }}
                >
                  {formattaPercentuale(r.conversione)}
                </td>
                <td className="py-2.5 text-right font-medium tabular-nums">
                  {formattaImporto(r.valore)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Ripartizione({
  titolo,
  righe,
  indice,
}: {
  titolo: string
  righe: readonly RigaRipartizione[]
  indice: number
}) {
  return (
    <Card title={titolo} indice={indice}>
      <TabellaPrestazioni righe={righe} colonnaChiave="Voce" />
    </Card>
  )
}
