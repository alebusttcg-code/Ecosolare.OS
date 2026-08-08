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
import { saveQuoteLines } from '@/lib/actions/quotes'
import { useAzioneServer } from '@/lib/use-azione-server'
import type { RigaVisibile } from '@/lib/queries/quotes'

export interface VoceCatalogo {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly unit: string
  readonly prezzo: number
  readonly costo?: number
  readonly iva: number
}

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
export function EditorPreventivo({
  versionId,
  righeIniziali,
  scontoIniziale,
  modificabile,
  mostraCosti,
  catalogo,
  sogliaMarginePct,
}: {
  versionId: string
  righeIniziali: readonly RigaVisibile[]
  scontoIniziale: number
  modificabile: boolean
  mostraCosti: boolean
  catalogo: readonly VoceCatalogo[]
  sogliaMarginePct: number
}) {
  const [righe, setRighe] = useState<RigaEditor[]>(
    righeIniziali.map((r) => ({ ...r, chiave: r.id })),
  )
  const [sconto, setSconto] = useState(scontoIniziale)
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

  function aggiorna(chiave: string, patch: Partial<RigaEditor>) {
    setRighe((precedenti) =>
      precedenti.map((r) => (r.chiave === chiave ? { ...r, ...patch } : r)),
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
      },
    ])
  }

  function salva() {
    setMessaggio(null)
    setErrore(null)
    esegui(async () => {
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
        parti.push('Sotto la soglia minima: l invio richiedera l approvazione.')
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
                      step="0.001"
                      value={r.quantity}
                      disabled={!modificabile}
                      onChange={(e) => aggiorna(r.chiave, { quantity: numero(e.target.value) })}
                      className="w-full rounded-md border px-2 py-1 text-right text-sm transition-colors duration-200 outline-none focus:border-eco-blue-400"
                      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
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
            {catalogo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
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
          {inCorso ? 'Salvataggio…' : 'Salva righe'}
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
