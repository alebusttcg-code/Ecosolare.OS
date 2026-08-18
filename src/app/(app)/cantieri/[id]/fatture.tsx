'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import {
  creaBozzaFattura,
  emettiFattura,
  stornaFattura,
} from '@/lib/actions/fatture'

export interface FatturaVista {
  readonly id: string
  readonly status: 'bozza' | 'emessa' | 'esportata' | 'incassata' | 'stornata'
  readonly type: 'fattura' | 'acconto' | 'nota_credito'
  readonly displayNumber: string | null
  readonly totale: string
}

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

const COLORE_STATO: Record<FatturaVista['status'], string> = {
  bozza: 'var(--testo-fioco)',
  emessa: 'var(--color-eco-green-400)',
  esportata: 'var(--color-eco-green-400)',
  incassata: 'var(--color-eco-green-400)',
  stornata: 'var(--color-eco-red-400)',
}

/**
 * Le fatture di una tranche del piano pagamenti, e i pulsanti per gestirle.
 *
 * Una tranche si fattura, la bozza si emette (prende il numero), una emessa si
 * storna con una nota di credito. Dopo lo storno la tranche torna fatturabile.
 * I pulsanti compaiono solo a chi può gestire; la lettura dello stato è per tutti.
 */
export function AzioniFattura({
  milestoneId,
  fatture,
  puoGestire,
}: {
  milestoneId: string
  fatture: readonly FatturaVista[]
  puoGestire: boolean
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  const attive = fatture.filter(
    (f) => f.type !== 'nota_credito' && f.status !== 'stornata',
  )
  const bozza = attive.find((f) => f.status === 'bozza')
  const emessa = attive.find((f) =>
    ['emessa', 'esportata', 'incassata'].includes(f.status),
  )

  function azione(
    fn: () => Promise<{ ok: true } | { ok: false; errors: Record<string, string> }>,
    messaggioOk: string,
  ) {
    setErrore(null)
    esegui(async () => {
      try {
        const esito = await fn()
        if (esito.ok) {
          avvisa(messaggioOk)
          router.refresh()
        } else {
          setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
        }
      } catch (e) {
        const messaggio = e instanceof Error ? e.message : 'Operazione non riuscita.'
        setErrore(
          /accesso non consentito/i.test(messaggio)
            ? 'Non hai il permesso di gestire le fatture (serve amministrazione o contabilità).'
            : messaggio,
        )
      }
    })
  }

  return (
    <div className="mt-2 space-y-2">
      {fatture.length > 0 ? (
        <ul className="space-y-1">
          {fatture.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-xs">
              <span aria-hidden style={{ color: 'var(--color-eco-blue-300)' }}>
                €
              </span>
              <span className="tabular-nums">
                {f.displayNumber ?? 'bozza'}
                {f.type === 'nota_credito' ? ' · nota di credito' : ''}
              </span>
              <span className="tabular-nums" style={{ color: 'var(--testo-fioco)' }}>
                {euro.format(Number.parseFloat(f.totale))}
              </span>
              <span className="ml-auto" style={{ color: COLORE_STATO[f.status] }}>
                {f.status}
              </span>
              {f.displayNumber ? (
                <a
                  href={`/api/fatture/${f.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="collega"
                  style={{ color: 'var(--color-eco-blue-300)' }}
                >
                  PDF
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {puoGestire ? (
        <div className="flex flex-wrap items-center gap-2">
          {!bozza && !emessa ? (
            <button
              type="button"
              disabled={inCorso}
              onClick={() =>
                azione(() => creaBozzaFattura(milestoneId), 'Bozza di fattura creata.')
              }
              className="bottone-fantasma rounded-lg border px-2.5 py-1.5 text-xs"
              style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
            >
              Fattura questa tranche
            </button>
          ) : null}

          {bozza ? (
            <button
              type="button"
              disabled={inCorso}
              onClick={() => azione(() => emettiFattura(bozza.id), 'Fattura emessa.')}
              className="bottone-oro rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
                color: '#050a14',
              }}
            >
              Emetti
            </button>
          ) : null}

          {emessa ? (
            <button
              type="button"
              disabled={inCorso}
              onClick={() =>
                azione(() => stornaFattura(emessa.id), 'Nota di credito emessa.')
              }
              className="bottone-fantasma rounded-lg border px-2.5 py-1.5 text-xs"
              style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
            >
              Storna
            </button>
          ) : null}
        </div>
      ) : null}

      {errore ? (
        <p className="text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
          {errore}
        </p>
      ) : null}
    </div>
  )
}
