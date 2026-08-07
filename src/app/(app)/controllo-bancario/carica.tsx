'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { caricaEstrattoConto, type EsitoImportazione } from '@/lib/actions/banca'

/**
 * Caricamento dell'estratto conto.
 *
 * Il controllo parte subito dopo l'importazione: chi carica il file deve vedere
 * immediatamente cosa non torna, altrimenti il file resta lì e nessuno lo guarda.
 */
export function CaricaEstratto() {
  const router = useRouter()
  const avvisa = useAvvisi()
  const modulo = useRef<HTMLFormElement>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [esito, setEsito] = useState<EsitoImportazione | null>(null)
  const [inCorso, avvia] = useTransition()

  return (
    <div>
      <form
        ref={modulo}
        action={(dati) => {
          setErrore(null)
          setEsito(null)
          avvia(async () => {
            const risultato = await caricaEstrattoConto(dati)
            if (risultato.ok) {
              setEsito(risultato.data)
              avvisa('Estratto conto importato.')
              modulo.current?.reset()
              router.refresh()
            } else {
              setErrore(Object.values(risultato.errors)[0] ?? 'Caricamento non riuscito.')
            }
          })
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="block flex-1" style={{ minWidth: '220px' }}>
          <span className="mb-1.5 block text-sm font-medium">Come chiamarlo</span>
          <input
            name="label"
            placeholder="Estratto conto agosto"
            className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200 outline-none focus:border-eco-blue-400"
            style={{ background: 'rgba(5,10,20,0.6)', borderColor: 'var(--bordo)' }}
          />
        </label>

        <label
          className="bottone-fantasma cursor-pointer rounded-lg border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--bordo)' }}
        >
          <input type="file" name="file" accept=".csv,text/csv,text/plain" className="hidden" required
            onChange={(e) => {
              // Il nome scelto compare accanto: senza, non si capisce se il file
              // e' stato davvero selezionato.
              const etichetta = e.target.closest('label')?.querySelector('span')
              if (etichetta) etichetta.textContent = e.target.files?.[0]?.name ?? 'Scegli il file CSV'
            }}
          />
          <span>Scegli il file CSV</span>
        </label>

        <button
          type="submit"
          disabled={inCorso}
          className="bottone-oro rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
            color: '#050a14',
          }}
        >
          {inCorso ? 'Controllo in corso…' : 'Carica e controlla'}
        </button>
      </form>

      {errore ? (
        <p
          className="mt-3 rounded-lg border p-3 text-sm"
          style={{
            borderColor: 'rgba(224,133,133,0.42)',
            background: 'rgba(224,133,133,0.08)',
            color: '#f0c9c9',
          }}
        >
          {errore}
        </p>
      ) : null}

      {esito ? (
        <p
          className="mt-3 rounded-lg border p-3 text-sm"
          style={{
            borderColor:
              esito.daVerificare > 0 ? 'rgba(217,164,65,0.42)' : 'rgba(163,197,99,0.4)',
            background:
              esito.daVerificare > 0 ? 'rgba(217,164,65,0.08)' : 'rgba(163,197,99,0.07)',
            color: esito.daVerificare > 0 ? '#e8c765' : '#b5d47c',
          }}
        >
          {esito.movimentiLetti} movimenti letti
          {esito.righeScartate > 0 ? `, ${esito.righeScartate} righe scartate` : ''}.{' '}
          {esito.daVerificare > 0
            ? `${esito.daVerificare} riscontri da verificare.`
            : 'Tutti i riscontri tornano.'}
        </p>
      ) : null}

      <p className="mt-3 text-xs" style={{ color: 'var(--testo-fioco)' }}>
        Serve il CSV esportato dall&apos;home banking. Il PDF non viene letto: ogni banca
        lo impagina a modo suo e interpretarlo a tentativi produrrebbe importi sbagliati
        in un controllo contabile.
      </p>
    </div>
  )
}
