'use client'

import { useMemo, useState } from 'react'
import {
  formattaImporto,
  formattaPercentuale,
  percentualeDaNumero,
  prezzoDaEuro,
  quantitaDaNumero,
} from '@/lib/domain/money'
import { calcolaPreventivo } from '@/lib/domain/pricing'
import { normalizzaQuantita, unitaRichiedeIntero } from '@/lib/domain/unita'
import { saveQuoteLines } from '@/lib/actions/quotes'
import {
  normalizzaDossier,
  type BloccoTermicoDossier,
  type DossierPreventivo,
} from '@/lib/domain/dossier-preventivo'
import { deduciRuolo } from '@/lib/domain/componenti-impianto'
import {
  coerenzaPrezzoTermico,
  datiMancantiTermico,
  ingressiTermico,
} from '@/lib/domain/diagnostica-termico'
import { useAzioneServer } from '@/lib/use-azione-server'
import type { RigaVisibile } from '@/lib/queries/quotes'

export interface VoceCatalogo {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly unit: string
  readonly type: 'materiale' | 'servizio' | 'manodopera' | 'kit'
  /** Ruolo nell'impianto: serve a dedurre il peso del blocco termico. */
  readonly componentRole: string | null
  /** SCOP dichiarato dal catalogo, per le pompe di calore. */
  readonly scop: number | null
  readonly prezzo: number
  readonly costo?: number
  readonly iva: number
}

const ETICHETTE_TIPO: Record<VoceCatalogo['type'], string> = {
  materiale: 'Materiali',
  kit: 'Kit',
  manodopera: 'Manodopera',
  servizio: 'Servizi',
}

const ORDINE_TIPO: VoceCatalogo['type'][] = ['materiale', 'kit', 'manodopera', 'servizio']

interface RigaEditor extends RigaVisibile {
  readonly chiave: string
}

let contatore = 0
function nuovaChiave(): string {
  contatore += 1
  return `nuova-${contatore}`
}

/**
 * Editor delle righe di preventivo.
 *
 * I totali mostrati qui sono calcolati **dallo stesso modulo puro** che usa il
 * server (`calcolaPreventivo`): l'anteprima non puo' divergere dal salvataggio.
 * Restano comunque un'anteprima — il valore che fa fede e' quello ricalcolato
 * dal server, perche' il browser non e' una fonte attendibile.
 */

/**
 * Valore numerico da un campo facoltativo, o `null` se vuoto.
 *
 * Vuoto e zero non sono la stessa cosa: uno SCOP pari a zero renderebbe il
 * termico incalcolabile, mentre un campo non compilato deve semplicemente
 * lasciare il blocco descrittivo.
 */
function valoreOpzionale(grezzo: string): number | null {
  const pulito = grezzo.trim().replace(',', '.')
  if (pulito === '') return null
  const n = Number.parseFloat(pulito)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function EditorPreventivo({
  versionId,
  righeIniziali,
  scontoIniziale,
  modificabile,
  mostraCosti,
  catalogo,
  sogliaMarginePct,
  dossierIniziale,
  consumoGasAnnuoSmc,
  prezzoGasPredefinito,
}: {
  versionId: string
  righeIniziali: readonly RigaVisibile[]
  scontoIniziale: number
  modificabile: boolean
  mostraCosti: boolean
  catalogo: readonly VoceCatalogo[]
  sogliaMarginePct: number
  dossierIniziale?: DossierPreventivo | null
  /** Gas dell'ultimo anno, dallo studio tetto. Null se nessuno l'ha compilato. */
  consumoGasAnnuoSmc?: number | null
  /** Prezzo del gas configurato in azienda, usato quando il preventivo tace. */
  prezzoGasPredefinito?: number | null
}) {
  const [righe, setRighe] = useState<RigaEditor[]>(
    righeIniziali.map((r) => ({
      ...r,
      quantity: normalizzaQuantita(r.quantity, r.unit),
      chiave: r.id,
    })),
  )
  const [sconto, setSconto] = useState(scontoIniziale)
  const termicoIniziale = normalizzaDossier(dossierIniziale).termico
  const [termicoAttivo, setTermicoAttivo] = useState(!!termicoIniziale?.presente)
  const [termicoTipo, setTermicoTipo] = useState<BloccoTermicoDossier['tipo']>(
    termicoIniziale?.tipo ?? 'pdc',
  )
  const [termicoDesc, setTermicoDesc] = useState(termicoIniziale?.descrizione ?? '')
  /*
   * Sola lettura: il prezzo del termico ora si deduce dalle righe. Questo
   * valore resta solo per i preventivi salvati prima, dove nessuna riga e'
   * riconosciuta come pompa di calore.
   */
  const termicoPrezzo = termicoIniziale ? String(termicoIniziale.prezzoLordoEur) : ''
  const [termicoDetrazione, setTermicoDetrazione] = useState(
    termicoIniziale ? String(termicoIniziale.detrazionePct) : '50',
  )
  const [termicoIncentivo, setTermicoIncentivo] = useState<
    BloccoTermicoDossier['incentivo']
  >(termicoIniziale?.incentivo ?? 'detrazione')
  const [termicoAnniDetrazione, setTermicoAnniDetrazione] = useState(
    termicoIniziale?.anniDetrazione != null
      ? String(termicoIniziale.anniDetrazione)
      : '10',
  )
  const [termicoScop, setTermicoScop] = useState(
    termicoIniziale?.scop != null ? String(termicoIniziale.scop) : '',
  )
  const [termicoPrezzoGas, setTermicoPrezzoGas] = useState(
    termicoIniziale?.prezzoGasEurSmc != null
      ? String(termicoIniziale.prezzoGasEurSmc)
      : '',
  )
  const [termicoAnniCt, setTermicoAnniCt] = useState(
    termicoIniziale?.anniContoTermico != null
      ? String(termicoIniziale.anniContoTermico)
      : '5',
  )
  const [termicoCt, setTermicoCt] = useState(
    termicoIniziale?.contoTermicoEur != null
      ? String(termicoIniziale.contoTermicoEur)
      : '',
  )
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  const totali = useMemo(
    () =>
      calcolaPreventivo(
        righe.map((r) => ({
          quantita: quantitaDaNumero(r.quantity),
          prezzoUnitario: prezzoDaEuro(r.unitPrice),
          costoUnitario: prezzoDaEuro(r.unitCost ?? 0),
          scontoPct: percentualeDaNumero(r.discountPct),
          aliquotaIva: percentualeDaNumero(r.vatRate),
        })),
        percentualeDaNumero(sconto),
      ),
    [righe, sconto],
  )

  /*
   * Quanto pesa l'impianto termico nel totale, letto dalle righe.
   *
   * Prima era un campo che il commerciale ricompilava a mano: lo stesso prezzo
   * scritto in due punti, e niente che verificasse che coincidessero. Quando
   * divergevano, la pagina del prezzo mostrava due verita' sullo stesso
   * impianto e il piano economico usava quella sbagliata.
   *
   * Il ruolo si legge dal catalogo e, quando manca, si deduce dalla descrizione
   * con la stessa funzione che usa il server: l'anteprima non puo' divergere
   * dal salvataggio.
   */
  const prezzoTermicoCents = useMemo(
    () =>
      righe.reduce((somma, riga, indice) => {
        const ruolo = riga.componentRole ?? deduciRuolo(riga.description)
        if (ruolo !== 'pompa_calore') return somma
        const totale = totali.righe[indice]
        return somma + (totale ? totale.imponibile + totale.iva : 0)
      }, 0),
    [righe, totali],
  )

  /*
   * La coerenza fra il prezzo dedotto dalle righe e quello scritto a mano nei
   * preventivi storici. Quando divergono le righe vincono — ma in silenzio no:
   * `manualeIgnorato` accende un avviso, invece di lasciare che la differenza
   * si scopra confrontando due pagine.
   */
  const coerenzaTermico = useMemo(
    () =>
      coerenzaPrezzoTermico({
        dedottoCents: prezzoTermicoCents,
        manualeCents: Math.round(
          Number.parseFloat(termicoPrezzo.replace(',', '.')) * 100,
        ),
      }),
    [prezzoTermicoCents, termicoPrezzo],
  )
  const termicoDedotto = coerenzaTermico.fonte === 'righe'

  /*
   * Perché la pompa di calore non entra nel piano economico.
   *
   * Il motore è severo di proposito — senza i tre dati non inventa un
   * risparmio — ma finora taceva: il preventivo usciva con il termico come
   * pura voce di spesa, il rientro peggiore del vero, e nessuno sapeva che era
   * mancato un campo. I tre dati stanno in tre posti diversi, quindi l'avviso
   * deve dire anche dove si compilano.
   */
  const scopDalCatalogo = useMemo(() => {
    const scop = righe
      .map((riga) => (riga.componentRole ?? deduciRuolo(riga.description)) === 'pompa_calore'
        ? riga.scop ?? null
        : null)
      .filter((valore): valore is number => valore != null && valore > 0)
    return scop.length > 0 ? Math.min(...scop) : null
  }, [righe])

  const mancantiTermico = useMemo(
    () =>
      termicoAttivo
        ? datiMancantiTermico(
            ingressiTermico({
              consumoGasAnnuoSmc,
              scopCatalogo: scopDalCatalogo,
              scopManuale: Number.parseFloat(termicoScop.replace(',', '.')),
              prezzoGasManuale: Number.parseFloat(
                termicoPrezzoGas.replace(',', '.'),
              ),
              prezzoGasPredefinito,
            }),
          )
        : [],
    [
      termicoAttivo,
      consumoGasAnnuoSmc,
      scopDalCatalogo,
      termicoScop,
      termicoPrezzoGas,
      prezzoGasPredefinito,
    ],
  )

  function aggiorna(chiave: string, patch: Partial<RigaEditor>) {
    setRighe((precedenti) =>
      precedenti.map((r) => {
        if (r.chiave !== chiave) return r
        const unita = patch.unit ?? r.unit
        const quantitaGrezza = patch.quantity ?? r.quantity
        return {
          ...r,
          ...patch,
          quantity: normalizzaQuantita(quantitaGrezza, unita),
        }
      }),
    )
  }

  function aggiungiDaCatalogo(voce: VoceCatalogo) {
    setRighe((precedenti) => [
      ...precedenti,
      {
        chiave: nuovaChiave(),
        id: '',
        productId: voce.id,
        description: voce.name,
        unit: voce.unit,
        quantity: 1,
        unitPrice: voce.prezzo,
        ...(mostraCosti ? { unitCost: voce.costo ?? 0 } : {}),
        discountPct: 0,
        vatRate: voce.iva,
        componentRole: voce.componentRole,
        scop: voce.scop,
      },
    ])
  }

  function aggiungiLibera() {
    setRighe((precedenti) => [
      ...precedenti,
      {
        chiave: nuovaChiave(),
        id: '',
        productId: null,
        description: '',
        unit: 'pz',
        quantity: 1,
        unitPrice: 0,
        ...(mostraCosti ? { unitCost: 0 } : {}),
        discountPct: 0,
        vatRate: 10,
        // Riga libera: il ruolo si dedurrà dalla descrizione, come sul server.
        componentRole: null,
        scop: null,
      },
    ])
  }

  function salva() {
    setMessaggio(null)
    setErrore(null)
    esegui(async () => {
      let dossier: DossierPreventivo = { termico: null }
      if (termicoAttivo) {
        /*
         * Il prezzo non si digita piu': e' la somma delle righe termiche. Il
         * valore salvato in precedenza resta come ripiego per i preventivi in
         * cui nessuna riga e' riconosciuta, cosi' non perdono la divisione
         * degli incentivi gia' fatta.
         */
        const prezzoSalvato = Number.parseFloat(termicoPrezzo.replace(',', '.'))
        const prezzo = termicoDedotto
          ? prezzoTermicoCents / 100
          : Number.isFinite(prezzoSalvato) && prezzoSalvato > 0
            ? prezzoSalvato
            : 0
        const detrazione = Number.parseFloat(termicoDetrazione.replace(',', '.'))
        const ctRaw = termicoCt.trim()
        const ct =
          ctRaw === '' ? null : Number.parseFloat(ctRaw.replace(',', '.'))
        if (!termicoDesc.trim()) {
          setErrore('Descrivi il blocco termico (modello / potenza).')
          return
        }
        if (
          termicoIncentivo === 'detrazione' &&
          !(Number.isFinite(detrazione) && detrazione > 0)
        ) {
          setErrore('Indica una percentuale di detrazione maggiore di zero.')
          return
        }
        if (
          termicoIncentivo === 'conto_termico' &&
          !(ct != null && Number.isFinite(ct) && ct > 0)
        ) {
          setErrore('Indica l’importo del Conto Termico scelto.')
          return
        }
        dossier = {
          termico: {
            presente: true,
            tipo: termicoTipo,
            descrizione: termicoDesc.trim(),
            prezzoLordoEur: prezzo,
            incentivo: termicoIncentivo,
            detrazionePct:
              termicoIncentivo === 'detrazione' && Number.isFinite(detrazione)
                ? detrazione
                : 0,
            contoTermicoEur:
              termicoIncentivo === 'conto_termico' && ct != null && Number.isFinite(ct)
                ? ct
                : null,
            anniDetrazione:
              termicoIncentivo === 'detrazione'
                ? valoreOpzionale(termicoAnniDetrazione)
                : null,
            scop: valoreOpzionale(termicoScop),
            prezzoGasEurSmc: valoreOpzionale(termicoPrezzoGas),
            anniContoTermico: valoreOpzionale(termicoAnniCt),
          },
        }
      }

      const esito = await saveQuoteLines({
        versionId,
        globalDiscountPct: sconto,
        righe: righe.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          ...(r.productId ? { productId: r.productId } : {}),
          description: r.description,
          unit: r.unit,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          ...(mostraCosti ? { unitCost: r.unitCost ?? 0 } : {}),
          discountPct: r.discountPct,
          vatRate: r.vatRate,
        })),
        dossier,
      })

      if (!esito.ok) {
        setErrore(Object.values(esito.errors)[0] ?? 'Salvataggio non riuscito.')
        return
      }

      const parti: string[] = ['Salvato.']
      if (esito.data.marginePct !== null) {
        parti.push(`Margine ${formattaPercentuale(esito.data.marginePct)}.`)
      }
      if (esito.data.sottoSoglia) {
        parti.push('Sotto la soglia minima: l\'invio richiederà l\'approvazione.')
      }
      if (esito.data.righeSenzaCosto.length > 0) {
        parti.push(
          `Costo non noto per: ${esito.data.righeSenzaCosto.join(', ')}. Il margine e sovrastimato.`,
        )
      }
      setMessaggio(parti.join(' '))
    })
  }

  const numero = (valore: string): number => {
    const n = Number.parseFloat(valore.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  return (
    <div className="space-y-4">
      <div
        className="overflow-x-auto rounded-lg border"
        style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
      >
        {/* Larghezza minima: sotto questa soglia la descrizione diventa
            illeggibile. Meglio far scorrere la tabella che comprimerla. */}
        <table className="w-full min-w-[780px] text-sm">
          <thead>
            <tr
              className="border-b text-left text-xs"
              style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
            >
              <th className="min-w-[220px] p-2 font-medium">Descrizione</th>
              <th className="w-20 p-2 font-medium">Q.tà</th>
              <th className="w-16 p-2 font-medium">U.m.</th>
              <th className="w-28 p-2 text-right font-medium">Prezzo</th>
              {mostraCosti ? (
                <th className="w-28 p-2 text-right font-medium">Costo</th>
              ) : null}
              <th className="w-20 p-2 text-right font-medium">Sc. %</th>
              <th className="w-20 p-2 text-right font-medium">IVA %</th>
              <th className="w-28 p-2 text-right font-medium">Imponibile</th>
              <th className="w-10 p-2" />
            </tr>
          </thead>
          <tbody>
            {righe.length === 0 ? (
              <tr>
                <td
                  colSpan={mostraCosti ? 9 : 8}
                  className="p-6 text-center text-sm"
                  style={{ color: 'var(--testo-tenue)' }}
                >
                  Nessuna riga. Aggiungi dal catalogo o crea una riga libera.
                </td>
              </tr>
            ) : (
              righe.map((r, indice) => (
                <tr key={r.chiave} className="riga border-b last:border-0" style={{ borderColor: 'var(--bordo)' }}>
                  <td className="p-1">
                    <input
                      value={r.description}
                      disabled={!modificabile}
                      onChange={(e) => aggiorna(r.chiave, { description: e.target.value })}
                      className="w-full rounded-md border px-2 py-1 text-sm transition-colors duration-200 outline-none focus:border-eco-blue-400"
                      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      step={unitaRichiedeIntero(r.unit) ? '1' : '0.001'}
                      min={1}
                      inputMode={unitaRichiedeIntero(r.unit) ? 'numeric' : 'decimal'}
                      value={r.quantity}
                      disabled={!modificabile}
                      onChange={(e) => aggiorna(r.chiave, { quantity: numero(e.target.value) })}
                      className="w-full rounded-md border px-2 py-1 text-right text-sm transition-colors duration-200 outline-none focus:border-eco-blue-400"
                      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
                      title={
                        unitaRichiedeIntero(r.unit)
                          ? 'Con unità a pezzi la quantità è intera'
                          : undefined
                      }
                    />
                  </td>
                  <td className="p-1">
                    <input
                      value={r.unit}
                      disabled={!modificabile}
                      onChange={(e) => aggiorna(r.chiave, { unit: e.target.value })}
                      className="w-full rounded-md border px-2 py-1 text-sm transition-colors duration-200 outline-none focus:border-eco-blue-400"
                      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      step="0.0001"
                      value={r.unitPrice}
                      disabled={!modificabile}
                      onChange={(e) => aggiorna(r.chiave, { unitPrice: numero(e.target.value) })}
                      className="w-full rounded-md border px-2 py-1 text-right text-sm transition-colors duration-200 outline-none focus:border-eco-blue-400"
                      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
                    />
                  </td>
                  {mostraCosti ? (
                    <td className="p-1">
                      <input
                        type="number"
                        step="0.0001"
                        value={r.unitCost ?? 0}
                        disabled={!modificabile}
                        onChange={(e) => aggiorna(r.chiave, { unitCost: numero(e.target.value) })}
                        className="w-full rounded-md border px-2 py-1 text-right text-sm transition-colors duration-200 outline-none focus:border-eco-blue-400"
                        style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
                      />
                    </td>
                  ) : null}
                  <td className="p-1">
                    <input
                      type="number"
                      step="0.01"
                      value={r.discountPct}
                      disabled={!modificabile}
                      onChange={(e) => aggiorna(r.chiave, { discountPct: numero(e.target.value) })}
                      className="w-full rounded-md border px-2 py-1 text-right text-sm transition-colors duration-200 outline-none focus:border-eco-blue-400"
                      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      step="0.01"
                      value={r.vatRate}
                      disabled={!modificabile}
                      onChange={(e) => aggiorna(r.chiave, { vatRate: numero(e.target.value) })}
                      className="w-full rounded-md border px-2 py-1 text-right text-sm transition-colors duration-200 outline-none focus:border-eco-blue-400"
                      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
                    />
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {formattaImporto(totali.righe[indice]?.imponibile ?? 0)}
                  </td>
                  <td className="p-1 text-center">
                    {modificabile ? (
                      <button
                        type="button"
                        onClick={() =>
                          setRighe((p) => p.filter((x) => x.chiave !== r.chiave))
                        }
                        className="px-1 text-lg leading-none"
                        style={{ color: 'var(--testo-tenue)' }}
                        aria-label="Rimuovi riga"
                      >
                        ×
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modificabile ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value=""
            onChange={(e) => {
              const voce = catalogo.find((c) => c.id === e.target.value)
              if (voce) aggiungiDaCatalogo(voce)
            }}
            className="bottone-fantasma rounded-lg border px-3 py-1.5 text-sm"
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
          >
            <option value="">+ Aggiungi dal catalogo…</option>
            {ORDINE_TIPO.map((tipo) => {
              const voci = catalogo.filter((c) => c.type === tipo)
              if (voci.length === 0) return null
              return (
                <optgroup key={tipo} label={ETICHETTE_TIPO[tipo]}>
                  {voci.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.unit})
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
          {catalogo.some((c) => c.type === 'manodopera') ? (
            <button
              type="button"
              onClick={() => {
                const voce =
                  catalogo.find((c) => c.type === 'manodopera' && c.code === 'MAN-STD') ??
                  catalogo.find((c) => c.type === 'manodopera')
                if (voce) aggiungiDaCatalogo(voce)
              }}
              className="bottone-fantasma rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'rgba(217,164,65,0.45)', color: 'var(--color-eco-gold-300)' }}
            >
              + Manodopera
            </button>
          ) : null}
          <button
            type="button"
            onClick={aggiungiLibera}
            className="bottone-fantasma rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--bordo)' }}
          >
            + Riga libera
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div
          className="space-y-2 rounded-lg border p-4 text-sm"
          style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
        >
          <div className="flex items-center justify-between">
            <span>Sconto globale</span>
            <span className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                value={sconto}
                disabled={!modificabile}
                onChange={(e) => setSconto(numero(e.target.value))}
                className="w-20 rounded border px-2 py-1 text-right text-sm"
                style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
              />
              %
            </span>
          </div>
          <div className="flex justify-between">
            <span>Imponibile</span>
            <span className="tabular-nums">{formattaImporto(totali.imponibile)}</span>
          </div>
          {totali.ripartizioneIva.map((v) => (
            <div key={v.aliquota} className="flex justify-between" style={{ color: 'var(--testo-tenue)' }}>
              <span>IVA {formattaPercentuale(v.aliquota)}</span>
              <span className="tabular-nums">{formattaImporto(v.imposta)}</span>
            </div>
          ))}
          <div
            className="flex justify-between border-t pt-2 font-semibold"
            style={{ borderColor: 'var(--bordo)' }}
          >
            <span>Totale</span>
            <span className="tabular-nums">{formattaImporto(totali.totale)}</span>
          </div>
        </div>

        {mostraCosti ? (
          <PannelloMargine totali={totali} sogliaMarginePct={sogliaMarginePct} />
        ) : (
          <div
            className="rounded-lg border p-4 text-sm"
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
          >
            <div className="font-medium">Marginalità</div>
            <p className="mt-2 text-xs" style={{ color: 'var(--testo-tenue)' }}>
              I costi di acquisto non sono visibili con il tuo profilo. Al salvataggio il
              sistema verifica il margine e segnala se il preventivo è sotto la soglia
              minima del {sogliaMarginePct}%.
            </p>
          </div>
        )}
      </div>

      <div
        className="space-y-3 rounded-lg border p-4 text-sm"
        style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
      >
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={termicoAttivo}
            disabled={!modificabile}
            onChange={(e) => setTermicoAttivo(e.target.checked)}
          />
          Blocco termico (PdC / ibrido) nel preventivo
        </label>
        {termicoAttivo ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs" style={{ color: 'var(--testo-fioco)' }}>
                Tipo
              </span>
              <select
                value={termicoTipo}
                disabled={!modificabile}
                onChange={(e) =>
                  setTermicoTipo(e.target.value as BloccoTermicoDossier['tipo'])
                }
                className="w-full rounded-md border px-2 py-1.5 text-sm"
                style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
              >
                <option value="pdc">Pompa di calore</option>
                <option value="ibrido">Caldaia ibrida</option>
                <option value="altro">Altro</option>
              </select>
            </label>

            {mancantiTermico.length > 0 ? (
              <div
                className="rounded-md border p-3 sm:col-span-2"
                style={{
                  borderColor: 'rgba(217,164,65,0.42)',
                  background: 'rgba(217,164,65,0.08)',
                }}
              >
                <p className="text-xs font-semibold" style={{ color: '#e8c765' }}>
                  Il risparmio sul riscaldamento non entra nel piano economico
                </p>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--testo-fioco)' }}>
                  La pompa di calore resta nel preventivo come costo, quindi il
                  rientro dell’investimento esce peggiore del vero.{' '}
                  {mancantiTermico.length === 1 ? 'Manca' : 'Mancano'}:
                </p>
                <ul className="mt-1.5 space-y-1">
                  {mancantiTermico.map((mancante) => (
                    <li key={mancante.cosa} className="text-[11px]">
                      <b style={{ color: 'var(--testo)' }}>{mancante.cosa}</b>
                      <span style={{ color: 'var(--testo-fioco)' }}> — {mancante.dove}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p
                className="rounded-md border p-2 text-[11px] sm:col-span-2"
                style={{
                  borderColor: 'rgba(163,197,99,0.35)',
                  background: 'rgba(163,197,99,0.07)',
                  color: '#b5d47c',
                }}
              >
                Il risparmio sul riscaldamento entra nel piano economico insieme
                al costo.
              </p>
            )}
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs" style={{ color: 'var(--testo-fioco)' }}>
                Descrizione (modello, potenza…)
              </span>
              <textarea
                value={termicoDesc}
                disabled={!modificabile}
                onChange={(e) => setTermicoDesc(e.target.value)}
                rows={2}
                className="w-full rounded-md border px-2 py-1.5 text-sm"
                style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
              />
            </label>
            <div className="block">
              <span className="mb-1 block text-xs" style={{ color: 'var(--testo-fioco)' }}>
                Prezzo IVA inclusa (€)
              </span>
              {termicoDedotto ? (
                <>
                  <p
                    className="rounded-md border px-2 py-1.5 text-sm tabular-nums"
                    style={{ background: 'rgba(5,10,20,0.35)', borderColor: 'var(--bordo)' }}
                  >
                    {formattaImporto(prezzoTermicoCents)}
                  </p>
                  <span
                    className="mt-1 block text-[11px]"
                    style={{ color: 'var(--testo-fioco)' }}
                  >
                    Somma delle righe riconosciute come pompa di calore. Per
                    cambiarlo, cambia le righe.
                  </span>
                  {coerenzaTermico.manualeIgnorato ? (
                    <span
                      className="mt-1 block rounded-md border px-2 py-1.5 text-[11px]"
                      style={{
                        borderColor: 'rgba(217,164,65,0.42)',
                        background: 'rgba(217,164,65,0.08)',
                        color: '#e8c765',
                      }}
                    >
                      Questo preventivo riportava a mano{' '}
                      {formattaImporto(coerenzaTermico.manualeCents)}: vale la
                      somma delle righe. Se il valore giusto era l’altro,
                      aggiorna le righe.
                    </span>
                  ) : null}
                </>
              ) : (
                <p
                  className="rounded-md border px-2 py-1.5 text-[11px]"
                  style={{
                    borderColor: 'rgba(217,164,65,0.42)',
                    background: 'rgba(217,164,65,0.08)',
                    color: '#e8c765',
                  }}
                >
                  Nessuna riga riconosciuta come pompa di calore: aggiungila al
                  preventivo perché il suo costo si separi dalla quota
                  fotovoltaica e l’agevolazione termica sia calcolata su di essa.
                </p>
              )}
            </div>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs" style={{ color: 'var(--testo-fioco)' }}>
                Agevolazione sulle spese termiche
              </span>
              <select
                value={termicoIncentivo}
                disabled={!modificabile}
                onChange={(e) =>
                  setTermicoIncentivo(
                    e.target.value as BloccoTermicoDossier['incentivo'],
                  )
                }
                className="w-full rounded-md border px-2 py-1.5 text-sm"
                style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
              >
                <option value="detrazione">Detrazione fiscale</option>
                <option value="conto_termico">Conto Termico 3.0</option>
                <option value="nessuno">Nessuna agevolazione</option>
              </select>
            </label>
            {termicoIncentivo === 'detrazione' ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs" style={{ color: 'var(--testo-fioco)' }}>
                    Detrazione (%)
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={termicoDetrazione}
                    disabled={!modificabile}
                    onChange={(e) => setTermicoDetrazione(e.target.value)}
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                    style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs" style={{ color: 'var(--testo-fioco)' }}>
                    Ripartita in (anni)
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={termicoAnniDetrazione}
                    disabled={!modificabile}
                    onChange={(e) => setTermicoAnniDetrazione(e.target.value)}
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                    style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
                  />
                </label>
              </>
            ) : null}
            {termicoIncentivo === 'conto_termico' ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs" style={{ color: 'var(--testo-fioco)' }}>
                    Conto Termico indicativo (€)
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={termicoCt}
                    disabled={!modificabile}
                    onChange={(e) => setTermicoCt(e.target.value)}
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                    style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs" style={{ color: 'var(--testo-fioco)' }}>
                    Erogato in (anni)
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={termicoAnniCt}
                    disabled={!modificabile}
                    onChange={(e) => setTermicoAnniCt(e.target.value)}
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                    style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
                  />
                </label>
              </>
            ) : null}

            <p
              className="text-[11px] sm:col-span-2"
              style={{ color: 'var(--testo-fioco)' }}
            >
              La detrazione e il Conto Termico sono alternativi sulle stesse
              spese. Il piano economico usa soltanto l’agevolazione selezionata.
            </p>

            {/*
              I due campi che fanno la differenza fra un blocco descrittivo e
              un blocco calcolato: senza SCOP e prezzo del gas il risparmio
              sul riscaldamento non entra nel piano economico.
            */}
            <label className="block">
              <span className="mb-1 block text-xs" style={{ color: 'var(--testo-fioco)' }}>
                SCOP della pompa di calore
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={termicoScop}
                disabled={!modificabile}
                placeholder="es. 3,8"
                onChange={(e) => setTermicoScop(e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-sm"
                style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs" style={{ color: 'var(--testo-fioco)' }}>
                Prezzo gas (€/Smc)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={termicoPrezzoGas}
                disabled={!modificabile}
                placeholder="dalla bolletta"
                onChange={(e) => setTermicoPrezzoGas(e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-sm"
                style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
              />
            </label>

            <p
              className="text-[11px] sm:col-span-2"
              style={{ color: 'var(--testo-fioco)' }}
            >
              Con SCOP e prezzo del gas compilati — e il gas consumato nello studio
              tetto — il risparmio sul riscaldamento entra nel piano economico
              insieme al costo. Senza, la pompa di calore resta una voce di spesa.
            </p>
          </div>
        ) : null}
      </div>

      {errore ? (
        <p className="rounded-lg border p-3 text-sm" style={{ borderColor: 'rgba(224,133,133,0.42)', background: 'rgba(224,133,133,0.08)', color: '#f0c9c9' }}>
          {errore}
        </p>
      ) : null}
      {messaggio ? (
        <p
          className="rounded border p-3 text-sm"
          style={{ borderColor: 'var(--bordo)', background: 'rgba(255,255,255,0.04)' }}
        >
          {messaggio}
        </p>
      ) : null}

      {modificabile ? (
        <button
          type="button"
          onClick={salva}
          disabled={inCorso}
          className="rounded-md bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso hover:opacity-90 disabled:opacity-50"
        >
          {inCorso ? 'Salvataggio…' : 'Salva preventivo'}
        </button>
      ) : null}
    </div>
  )
}

function PannelloMargine({
  totali,
  sogliaMarginePct,
}: {
  totali: ReturnType<typeof calcolaPreventivo>
  sogliaMarginePct: number
}) {
  const sottoSoglia =
    totali.marginePct !== null && totali.marginePct < percentualeDaNumero(sogliaMarginePct)

  return (
    <div
      className="space-y-2 rounded-lg border p-4 text-sm"
      style={{
        background: 'var(--superficie)',
        borderColor: sottoSoglia ? '#e8b924' : 'var(--bordo)',
      }}
    >
      <div className="font-medium">Marginalità</div>
      <div className="flex justify-between">
        <span>Costo previsto</span>
        <span className="tabular-nums">{formattaImporto(totali.costoTotale)}</span>
      </div>
      <div className="flex justify-between">
        <span>Margine</span>
        <span className="tabular-nums">{formattaImporto(totali.margine)}</span>
      </div>
      <div className="flex justify-between font-semibold">
        <span>Margine %</span>
        <span className="tabular-nums">
          {totali.marginePct === null ? '—' : formattaPercentuale(totali.marginePct)}
        </span>
      </div>
      {sottoSoglia ? (
        <p className="text-xs" style={{ color: '#8a6100' }}>
          Sotto la soglia minima del {sogliaMarginePct}%. L&apos;invio richiederà
          l&apos;approvazione della direzione — non è vietato, va deciso
          consapevolmente.
        </p>
      ) : null}
    </div>
  )
}
