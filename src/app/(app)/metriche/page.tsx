import Link from 'next/link'
import { Badge, Card, Intestazione, Stat, Vuoto, ritardo } from '@/components/ui'
import { guard } from '@/lib/auth/session'
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
} from '@/lib/domain/funnel'
import { formattaImporto } from '@/lib/domain/money'
import { getCoorteCommerciale, periodiDisponibili, trovaPeriodo } from '@/lib/queries/metrics'

export const metadata = { title: 'Metriche commerciali — EcoSolare OS' }

export default async function MetrichePage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  await guard('read', 'dashboard')

  const { periodo: codice } = await searchParams
  const adesso = new Date()
  const periodo = trovaPeriodo(codice, adesso)
  const periodi = periodiDisponibili(adesso)

  const coorte = await getCoorteCommerciale(periodo.da, periodo.a)

  const imbuto = calcolaImbuto(coorte)
  const tempi = calcolaTempi(coorte)
  const valori = calcolaValori(coorte)
  const maturita = calcolaMaturita(coorte)
  const perFonte = ripartisci(coorte, (p) => p.fonte)
  const perCommerciale = ripartisci(coorte, (p) => p.commerciale, 'Non assegnato')
  const perLinea = ripartisci(coorte, (p) => p.lineaBusiness)
  const perdite = motiviDiPerdita(coorte)

  const contratti = imbuto.find((t) => t.codice === 'contratto')!
  const massimoImbuto = Math.max(1, ...imbuto.map((t) => t.conteggio))

  return (
    <div>
      <Intestazione
        eyebrow="Direzione"
        titolo="Metriche commerciali"
        sottotitolo={`Coorte dei lead entrati ${periodo.etichetta.toLowerCase()} · ${coorte.length} pratiche`}
        azione={
          <div className="flex flex-wrap gap-1.5">
            {periodi.map((p) => (
              <Link
                key={p.codice}
                href={`/metriche?periodo=${p.codice}`}
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
        }
      />

      {coorte.length === 0 ? (
        <Card>
          <Vuoto messaggio="Nessun lead entrato in questo periodo." />
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Lead ricevuti" value={coorte.length} icona="◭" indice={0} />
            <Stat
              label="Contratti firmati"
              value={contratti.conteggio}
              tone="positivo"
              icona="✓"
              indice={1}
              hint={`conversione ${formattaPercentuale(contratti.daLead)}`}
            />
            <Stat
              label="Valore acquisito"
              value={valori.valoreContratti / 100}
              formato="euro"
              icona="€"
              indice={2}
            />
            <Stat
              label="Ticket medio"
              value={(valori.ticketMedio ?? 0) / 100}
              formato="euro"
              icona="◇"
              indice={3}
              hint={valori.ticketMedio === null ? 'nessun contratto' : undefined}
            />
          </div>

          {/* La maturità della coorte va detta accanto ai numeri, non in fondo:
              è ciò che impedisce la lettura sbagliata più comune. */}
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
                {maturita.ancoraAperte} pratiche su {maturita.totale} sono ancora aperte
                ({formattaPercentuale(maturita.quotaConclusa)} ha già un esito). Le
                conversioni qui sotto sono destinate a salire: i lead più recenti non
                hanno ancora avuto il tempo di diventare contratti.
              </p>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card title="Imbuto commerciale" indice={1}>
                <ul className="space-y-3">
                  {imbuto.map((tappa, indice) => (
                    <li key={tappa.codice} className="riga rounded-md py-1">
                      <div className="flex items-center gap-4">
                        <span className="w-28 shrink-0 truncate text-sm sm:w-44">{tappa.etichetta}</span>
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
                  La percentuale a destra è la conversione dalla tappa precedente. Chi
                  arriva a una tappa conta anche in quelle prima, anche se una
                  registrazione è stata saltata: è ciò che impedisce percentuali sopra
                  il 100%.
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
              <p className="mt-4 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                Mediane, non medie: una pratica dimenticata per due mesi sposterebbe la
                media e nasconderebbe il comportamento normale.
              </p>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Ripartizione titolo="Per fonte" righe={perFonte} indice={1} />
            <Ripartizione titolo="Per commerciale" righe={perCommerciale} indice={2} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Ripartizione titolo="Per linea di business" righe={perLinea} indice={1} />

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
              <p className="mt-4 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                L&apos;importo è il valore dei preventivi che non si sono chiusi per quel
                motivo.
              </p>
            </Card>
          </div>

          <Card title="Pipeline ancora aperta" indice={1}>
            <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
              <Voce
                etichetta="Valore in corso"
                valore={formattaImporto(valori.valoreInCorso)}
              />
              <Voce
                etichetta="Preventivi inviati"
                valore={formattaImporto(valori.valorePreventiviInviati)}
              />
              <Voce etichetta="Pratiche aperte" valore={String(maturita.ancoraAperte)} />
            </div>
          </Card>
        </div>
      )}
    </div>
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

function Voce({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
        {etichetta}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{valore}</div>
    </div>
  )
}

function Ripartizione({
  titolo,
  righe,
  indice,
}: {
  titolo: string
  righe: readonly { chiave: string; lead: number; contratti: number; conversione: number | null; valore: number }[]
  indice: number
}) {
  return (
    <Card title={titolo} indice={indice}>
      {righe.length === 0 ? (
        <Vuoto messaggio="Nessun dato." />
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b text-left text-xs"
              style={{ borderColor: 'var(--bordo-tenue)', color: 'var(--testo-fioco)' }}
            >
              <th className="pb-2 font-medium">Voce</th>
              <th className="pb-2 text-right font-medium">Lead</th>
              <th className="pb-2 text-right font-medium">Contratti</th>
              <th className="pb-2 text-right font-medium">Conv.</th>
              <th className="pb-2 text-right font-medium">Valore</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr
                key={r.chiave}
                className="riga border-b last:border-0"
                style={{ borderColor: 'var(--bordo-tenue)' }}
              >
                <td className="py-2">{r.chiave}</td>
                <td className="py-2 text-right tabular-nums">{r.lead}</td>
                <td className="py-2 text-right tabular-nums">{r.contratti}</td>
                <td
                  className="py-2 text-right tabular-nums"
                  style={{ color: 'var(--color-eco-gold-300)' }}
                >
                  {formattaPercentuale(r.conversione)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formattaImporto(r.valore)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </Card>
  )
}
