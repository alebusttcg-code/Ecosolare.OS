import Link from 'next/link'
import { LinkNome } from '@/components/link-nome'
import { Badge, Card, Intestazione, Stat, Vuoto, formattaData, formattaEuro } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import { ETICHETTE_ESITO, SPIEGAZIONI, type EsitoAbbinamento } from '@/lib/domain/riconciliazione'
import {
  contaNonAncoraControllati,
  contaOkAmministrativi,
  getDettaglioEstratto,
  listEstratti,
} from '@/lib/queries/banca'
import { CaricaEstratto } from './carica'
import { VerificaRiscontro } from './verifica'

export const metadata = { title: 'Controllo bancario — EcoSolare OS' }

const TONO: Record<EsitoAbbinamento, 'positivo' | 'attenzione' | 'critico'> = {
  abbinato: 'positivo',
  importo_diverso: 'attenzione',
  solo_importo: 'attenzione',
  non_trovato: 'critico',
}

export default async function BancaPage({
  searchParams,
}: {
  searchParams: Promise<{ estratto?: string }>
}) {
  // Chi può agire sugli incassi: contabilità e amministratore.
  await guard('update', 'invoice')

  const { estratto: idRichiesto } = await searchParams
  const adesso = new Date()
  const novantaGiorniFa = new Date(adesso.getTime() - 90 * 86_400_000)

  const estratti = await listEstratti()
  const okConcessi = await contaOkAmministrativi(novantaGiorniFa, adesso)
  const nonControllati = await contaNonAncoraControllati()

  const idCorrente = idRichiesto ?? estratti[0]?.id
  const dettaglio = idCorrente ? await getDettaglioEstratto(idCorrente) : null

  const daVerificare = dettaglio
    ? dettaglio.riscontri.filter((r) => r.esito !== 'abbinato' && r.verificatoIl === null)
    : []

  return (
    <div>
      <Intestazione
        titolo="Controllo bancario"
        sottotitolo="La contabile dice ciò che il cliente afferma. L’estratto conto dice ciò che è successo."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="OK amministrativi"
          value={okConcessi}
          hint="ultimi 90 giorni"
          icona="✓"
          indice={0}
        />
        <Stat
          label="Mai confrontati"
          value={nonControllati}
          tone={nonControllati > 0 ? 'attenzione' : 'positivo'}
          hint="nessun estratto li copre"
          icona="◷"
          indice={1}
        />
        <Stat
          label="Da verificare"
          value={daVerificare.length}
          tone={daVerificare.length > 0 ? 'critico' : 'positivo'}
          hint="su questo estratto"
          icona="!"
          indice={2}
        />
        <Stat
          label="Entrate non attese"
          value={dettaglio?.entrateNonAttese.length ?? 0}
          hint="senza OK corrispondente"
          icona="◇"
          indice={3}
        />
      </div>

      <div className="mt-8 space-y-6">
        <Card title="Registro fatture — export per il commercialista">
          {/* Form GET: il browser scarica il CSV senza lasciare la pagina. */}
          <form
            method="get"
            action="/api/fatture/export"
            className="flex flex-wrap items-end gap-3"
          >
            <label className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
              <span className="block">Dal</span>
              <input
                type="date"
                name="dal"
                className="mt-1 rounded-lg border bg-transparent px-2 py-1.5 text-sm"
                style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
              />
            </label>
            <label className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
              <span className="block">Al</span>
              <input
                type="date"
                name="al"
                className="mt-1 rounded-lg border bg-transparent px-2 py-1.5 text-sm"
                style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
              />
            </label>
            <button
              type="submit"
              className="bottone-fantasma rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
            >
              Scarica CSV
            </button>
          </form>
          <p className="mt-2 text-xs" style={{ color: 'var(--testo-fioco)' }}>
            Solo le fatture emesse. Senza periodo, l’anno in corso. Numeri e date
            all’italiana, pronto per il gestionale del commercialista.
          </p>
        </Card>
        <Card title="Carica un estratto conto" indice={1}>
          <CaricaEstratto />
        </Card>

        {estratti.length === 0 ? (
          <Card indice={2}>
            <Vuoto messaggio="Nessun estratto conto caricato. Il controllo si fa quando vuoi: una volta al mese, o dopo ogni gruppo di incassi." />
          </Card>
        ) : null}

        {dettaglio ? (
          <>
            {estratti.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {estratti.map((e) => (
                  <Link
                    key={e.id}
                    href={`/controllo-bancario?estratto=${e.id}`}
                    className="rounded-lg border px-3 py-1.5 text-xs transition-colors"
                    style={{
                      borderColor:
                        e.id === dettaglio.estratto.id
                          ? 'var(--color-eco-gold-400)'
                          : 'var(--bordo)',
                      color:
                        e.id === dettaglio.estratto.id
                          ? 'var(--color-eco-gold-300)'
                          : 'var(--testo-tenue)',
                      background:
                        e.id === dettaglio.estratto.id
                          ? 'rgba(217,164,65,0.08)'
                          : 'transparent',
                    }}
                  >
                    {e.label}
                    {e.daVerificare > 0 ? ` · ${e.daVerificare}` : ''}
                  </Link>
                ))}
              </div>
            ) : null}

            <Card
              title={`Riscontri — ${dettaglio.estratto.label}`}
              accento={daVerificare.length > 0 ? 'rosso' : 'verde'}
              indice={2}
              action={
                <span className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
                  {dettaglio.estratto.periodFrom
                    ? `${formattaData(dettaglio.estratto.periodFrom)} – ${formattaData(dettaglio.estratto.periodTo)}`
                    : ''}
                  {' · '}
                  {dettaglio.estratto.importedRows} movimenti
                </span>
              }
            >
              {dettaglio.riscontri.length === 0 ? (
                <Vuoto messaggio="Nessun OK amministrativo ricade nel periodo di questo estratto." />
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                  {dettaglio.riscontri.map((r) => {
                    const chiuso = r.verificatoIl !== null
                    const ok = r.esito === 'abbinato'

                    return (
                      <li key={r.id} className="riga rounded-md py-3.5 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <LinkNome href={`/clienti/${r.clienteId}`} className="text-sm font-medium">
                                {r.cliente}
                              </LinkNome>
                              <Badge tone={ok ? 'positivo' : chiuso ? 'neutro' : TONO[r.esito]}>
                                {chiuso && !ok ? 'chiarito' : ETICHETTE_ESITO[r.esito]}
                              </Badge>
                            </div>
                            <div
                              className="mt-0.5 text-xs"
                              style={{ color: 'var(--testo-fioco)' }}
                            >
                              <Link
                                href={`/cantieri/${r.commessaId}`}
                                className="collega"
                                style={{ color: 'var(--color-eco-blue-300)' }}
                              >
                                {r.commessaCodice}
                              </Link>
                              {' · '}
                              {r.scadenza}
                              {r.okAmministrativoIl
                                ? ` · OK del ${formattaData(r.okAmministrativoIl)}`
                                : ''}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-4">
                            <div className="text-right text-sm">
                              <div className="tabular-nums">
                                {formattaEuro(r.importoAtteso)}
                              </div>
                              {r.movimentoImporto && r.esito !== 'abbinato' ? (
                                <div
                                  className="text-xs tabular-nums"
                                  style={{ color: 'var(--color-eco-gold-300)' }}
                                >
                                  in banca {formattaEuro(r.movimentoImporto)}
                                </div>
                              ) : null}
                            </div>
                            {!ok && !chiuso ? <VerificaRiscontro checkId={r.id} /> : null}
                          </div>
                        </div>

                        {/* La spiegazione compare solo dove serve: sui casi che
                            tornano sarebbe rumore su ogni riga. */}
                        {!ok && !chiuso ? (
                          <p
                            className="mt-2 text-xs leading-relaxed"
                            style={{ color: 'var(--testo-tenue)' }}
                          >
                            {SPIEGAZIONI[r.esito]}
                            {r.movimentoDescrizione ? (
                              <>
                                {' '}
                                <span style={{ color: 'var(--testo-fioco)' }}>
                                  Movimento del {formattaData(r.movimentoData)}:{' '}
                                  <span className="font-mono">{r.movimentoDescrizione}</span>
                                </span>
                              </>
                            ) : null}
                          </p>
                        ) : null}

                        {chiuso && r.notaVerifica ? (
                          <p className="mt-2 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                            <span style={{ color: 'var(--color-eco-green-400)' }}>✓</span>{' '}
                            {r.notaVerifica}
                            <span style={{ color: 'var(--testo-fioco)' }}>
                              {' '}
                              — {r.verificatoDa}, {formattaData(r.verificatoIl)}
                            </span>
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            {dettaglio.entrateNonAttese.length > 0 ? (
              <Card title="Entrate senza OK amministrativo" accento="blu" indice={3}>
                <p className="mb-3 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                  Denaro arrivato che non corrisponde a nessuna scadenza con via libera.
                  Può essere un saldo, un anticipo non ancora registrato o un incasso di
                  altra natura.
                </p>
                <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
                  {dettaglio.entrateNonAttese.map((m) => (
                    <li
                      key={m.id}
                      className="riga flex items-center justify-between gap-4 rounded-md py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs">{m.description}</div>
                        <div className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
                          {formattaData(m.valueDate)}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm tabular-nums">
                        {formattaEuro(m.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {dettaglio.scartate.length > 0 ? (
              <Card title={`Righe non lette (${dettaglio.scartate.length})`} indice={4}>
                <p className="mb-3 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                  Elencate invece che ignorate: quasi sempre sono righe di saldo o totali,
                  ma se ci fosse un movimento vero fra queste è giusto accorgersene.
                </p>
                <ul className="space-y-1.5">
                  {dettaglio.scartate.slice(0, 12).map((s) => (
                    <li key={s.riga} className="flex gap-3 text-xs">
                      <span className="shrink-0 tabular-nums" style={{ color: 'var(--testo-fioco)' }}>
                        riga {s.riga}
                      </span>
                      <span style={{ color: 'var(--color-eco-gold-300)' }}>{s.motivo}</span>
                      <span className="truncate font-mono" style={{ color: 'var(--testo-fioco)' }}>
                        {s.contenuto}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
