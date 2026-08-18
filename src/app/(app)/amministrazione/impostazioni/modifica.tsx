'use client'

import { useMemo, useState } from 'react'
import { updateSetting } from '@/lib/actions/admin'
import { useAzioneServer } from '@/lib/use-azione-server'

export interface ConfigurazioneInElenco {
  readonly key: string
  readonly value: unknown
  readonly description: string | null
}

interface MetaConfig {
  readonly titolo: string
  readonly gruppo: string
  readonly unita?: string
}

const META: Record<string, MetaConfig> = {
  'sla.prima_risposta_minuti': {
    titolo: 'Presa in carico lead',
    gruppo: 'Lead e contatti',
    unita: 'minuti',
  },
  'dedup.soglia_segnalazione': {
    titolo: 'Soglia duplicati',
    gruppo: 'Lead e contatti',
    unita: 'punti',
  },
  'orari.servizio': {
    titolo: 'Orari di servizio',
    gruppo: 'Lead e contatti',
  },
  'pipeline.giorni_default_prossima_azione': {
    titolo: 'Scadenza prossima azione',
    gruppo: 'Pipeline',
    unita: 'giorni',
  },
  'pipeline.giorni_alert_opportunita_ferma': {
    titolo: 'Alert opportunità ferma',
    gruppo: 'Pipeline',
    unita: 'giorni',
  },
  'preventivi.giorni_validita': {
    titolo: 'Validità preventivo',
    gruppo: 'Preventivi',
    unita: 'giorni',
  },
  'preventivi.soglia_margine_pct': {
    titolo: 'Soglia margine',
    gruppo: 'Preventivi',
    unita: '%',
  },
  'fattura.aliquota_iva_default_pct': {
    titolo: 'Aliquota IVA di default',
    gruppo: 'Fatturazione',
    unita: '%',
  },
  'fattura.sezionale_default': {
    titolo: 'Sezionale registro',
    gruppo: 'Fatturazione',
  },
  'fattura.azienda_partita_iva': {
    titolo: 'Partita IVA azienda',
    gruppo: 'Fatturazione',
  },
  'fattura.azienda_ragione_sociale': {
    titolo: 'Ragione sociale azienda',
    gruppo: 'Fatturazione',
  },
  'fisica.motore_producibilita_attivo': {
    titolo: 'Motore fisico di producibilità',
    gruppo: 'Motore fisico',
  },
}

const ORDINE_GRUPPI = [
  'Lead e contatti',
  'Pipeline',
  'Preventivi',
  'Motore fisico',
  'Fatturazione',
  'Altro',
] as const

function metaDi(key: string): MetaConfig {
  return (
    META[key] ?? {
      titolo: key.split('.').pop()?.replaceAll('_', ' ') ?? key,
      gruppo: 'Altro',
    }
  )
}

function valoreIniziale(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value, null, 2)
}

function eOggettoComplesso(value: unknown): boolean {
  return value !== null && typeof value === 'object'
}

/**
 * Elenco regole di sistema, raggruppate e con etichette leggibili.
 * Il valore resta JSON al confine (forma variabile per chiave).
 */
export function ElencoRegoleSistema({
  voci,
}: {
  voci: readonly ConfigurazioneInElenco[]
}) {
  const gruppi = useMemo(() => {
    const mappa = new Map<string, ConfigurazioneInElenco[]>()
    for (const voce of voci) {
      const g = metaDi(voce.key).gruppo
      const lista = mappa.get(g) ?? []
      lista.push(voce)
      mappa.set(g, lista)
    }
    return ORDINE_GRUPPI.filter((g) => mappa.has(g)).map((g) => ({
      nome: g,
      voci: mappa.get(g)!,
    }))
  }, [voci])

  return (
    <div className="space-y-6">
      {gruppi.map((gruppo) => (
        <section key={gruppo.nome}>
          <h3
            className="mb-1 text-[11px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: 'var(--testo-fioco)' }}
          >
            {gruppo.nome}
          </h3>
          <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
            {gruppo.voci.map((voce) => (
              <li key={voce.key} className="py-4 first:pt-2 last:pb-0">
                <ModificaConfigurazione voce={voce} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ModificaConfigurazione({ voce }: { voce: ConfigurazioneInElenco }) {
  const meta = metaDi(voce.key)
  const complesso = eOggettoComplesso(voce.value)
  const [errore, setErrore] = useState<string | null>(null)
  const [salvato, setSalvato] = useState(false)
  const { inCorso, esegui } = useAzioneServer()

  return (
    <form
      action={(formData) => {
        setErrore(null)
        setSalvato(false)
        esegui(async () => {
          const grezzo = String(formData.get('value') ?? '').trim()
          const esito = await updateSetting({
            key: voce.key,
            value: grezzo,
          })
          if (esito.ok) setSalvato(true)
          else setErrore(Object.values(esito.errors)[0] ?? 'Salvataggio non riuscito.')
        })
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium">{meta.titolo}</span>
            {meta.unita ? (
              <span className="text-[11px]" style={{ color: 'var(--testo-fioco)' }}>
                {meta.unita}
              </span>
            ) : null}
          </div>
          {voce.description ? (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
              {voce.description}
            </p>
          ) : null}
          <p className="font-mono text-[10px]" style={{ color: 'var(--testo-fioco)' }}>
            {voce.key}
          </p>
        </div>

        <div className={`w-full shrink-0 space-y-2 ${complesso ? 'sm:w-[min(100%,22rem)]' : 'sm:w-40'}`}>
          {complesso ? (
            <textarea
              name="value"
              rows={4}
              defaultValue={valoreIniziale(voce.value)}
              spellCheck={false}
              className="w-full resize-y rounded-lg border px-3 py-2 font-mono text-xs leading-relaxed transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
              style={{
                background: 'rgba(5,10,20,0.55)',
                borderColor: errore ? 'var(--color-eco-red-400)' : 'var(--bordo)',
              }}
            />
          ) : (
            <input
              name="value"
              defaultValue={valoreIniziale(voce.value)}
              inputMode={typeof voce.value === 'number' ? 'decimal' : undefined}
              className="w-full rounded-lg border px-3 py-2 text-sm tabular-nums transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
              style={{
                background: 'rgba(5,10,20,0.55)',
                borderColor: errore ? 'var(--color-eco-red-400)' : 'var(--bordo)',
              }}
            />
          )}
          <div className="flex items-center justify-end gap-2">
            {salvato ? (
              <span className="text-xs" style={{ color: 'var(--color-eco-green-400)' }}>
                Salvato
              </span>
            ) : null}
            {errore ? <span className="text-xs text-eco-red-400">{errore}</span> : null}
            <button
              type="submit"
              disabled={inCorso}
              className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
              style={{ borderColor: 'var(--bordo)' }}
            >
              {inCorso ? '…' : 'Salva'}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
