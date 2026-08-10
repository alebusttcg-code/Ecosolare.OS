'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Dialogo } from '@/components/dialogo'
import {
  dataLocaleIso,
  type PeriodoEconomia,
  urlPeriodoEconomia,
} from '@/lib/domain/periodo-economia'

const stileVoce = (attivo: boolean) =>
  ({
    borderColor: attivo ? 'var(--color-eco-gold-400)' : 'var(--bordo)',
    color: attivo ? 'var(--color-eco-gold-300)' : 'var(--testo-tenue)',
    background: attivo ? 'rgba(217,164,65,0.08)' : 'transparent',
  }) as const

export function SelettorePeriodoEconomia({
  periodo,
  preset,
  customDa,
  customA,
  /** Parametri query da mantenere (es. coorte commerciale sulla Dashboard). */
  conserva,
}: {
  periodo: PeriodoEconomia
  preset: readonly PeriodoEconomia[]
  customDa?: string
  customA?: string
  conserva?: Record<string, string | undefined>
}) {
  const router = useRouter()
  const [aperto, setAperto] = useState(false)
  const [da, setDa] = useState(customDa ?? dataLocaleIso(periodo.da))
  const [a, setA] = useState(customA ?? dataLocaleIso(periodo.a))
  const [errore, setErrore] = useState<string | null>(null)

  const url = (codice: string, daIso?: string, aIso?: string) =>
    urlPeriodoEconomia(codice, daIso, aIso, conserva)

  const applicaCustom = () => {
    if (!da || !a) {
      setErrore('Seleziona data di inizio e fine.')
      return
    }
    if (da > a) {
      setErrore('La data di fine deve essere uguale o successiva all’inizio.')
      return
    }
    setErrore(null)
    setAperto(false)
    router.push(url('custom', da, a))
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {preset.map((p) => (
          <Link
            key={p.codice}
            href={url(p.codice)}
            className="rounded-lg border px-3 py-1.5 text-xs transition-colors"
            style={stileVoce(periodo.codice === p.codice)}
          >
            {p.etichetta}
          </Link>
        ))}

        <button
          type="button"
          onClick={() => {
            setErrore(null)
            setAperto(true)
          }}
          className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-white/[0.03]"
          style={stileVoce(periodo.codice === 'custom')}
        >
          {periodo.codice === 'custom' ? periodo.etichetta : 'Personalizzato'}
        </button>
      </div>

      <Dialogo aperto={aperto} titolo="Intervallo personalizzato" onChiudi={() => setAperto(false)}>
        <div className="space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
            Scegli l’intervallo da analizzare. Gli incassi seguono le date di fattura e
            incasso; preventivi e contratti seguono invio e firma nel periodo.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
                Da
              </span>
              <input
                type="date"
                value={da}
                onChange={(e) => setDa(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
                style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)', colorScheme: 'dark' }}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
                A
              </span>
              <input
                type="date"
                value={a}
                onChange={(e) => setA(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
                style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)', colorScheme: 'dark' }}
              />
            </label>
          </div>

          {errore ? (
            <p className="text-xs" style={{ color: 'var(--color-attenzione)' }}>
              {errore}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAperto(false)}
              className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-white/[0.04]"
              style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={applicaCustom}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                borderColor: 'rgba(217,164,65,0.35)',
                color: 'var(--color-eco-gold-300)',
                background: 'rgba(217,164,65,0.1)',
              }}
            >
              Applica
            </button>
          </div>
        </div>
      </Dialogo>
    </>
  )
}
