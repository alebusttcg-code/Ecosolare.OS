'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { Badge } from '@/components/ui'
import {
  generaCodiceCollegamentoTelegram,
  scollegaTelegram,
  type StatoTelegram,
} from '@/lib/actions/telegram'
import { useAzioneServer } from '@/lib/use-azione-server'

export function CollegamentoTelegram({ statoIniziale }: { statoIniziale: StatoTelegram }) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const { inCorso, esegui } = useAzioneServer()
  const [stato, setStato] = useState(statoIniziale)
  const [errore, setErrore] = useState<string | null>(null)

  if (!stato.configurato) {
    return (
      <p className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
        Reminder Telegram non configurati su questo ambiente (manca il token del bot).
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {stato.collegato ? (
          <Badge tone="positivo">Telegram collegato</Badge>
        ) : (
          <Badge tone="attenzione">Telegram non collegato</Badge>
        )}
      </div>

      <p className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
        Il giorno della scadenza ricevi un messaggio per ogni follow-up. Rispondi a quel
        messaggio con le note: il bot lo smarca nel CRM.
      </p>

      {stato.istruzioniStart ? (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--bordo)', background: 'rgba(255,255,255,0.04)' }}
        >
          <code className="text-eco-gold-300">{stato.istruzioniStart}</code>
          <p className="mt-1 text-xs" style={{ color: 'var(--testo-fioco)' }}>
            Valido 15 minuti.
          </p>
        </div>
      ) : null}

      {errore ? <p className="text-xs text-eco-red-400">{errore}</p> : null}

      <div className="flex flex-wrap gap-2">
        {!stato.collegato || stato.istruzioniStart ? (
          <button
            type="button"
            disabled={inCorso}
            onClick={() =>
              esegui(async () => {
                setErrore(null)
                const esito = await generaCodiceCollegamentoTelegram()
                if (!esito.ok) {
                  setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
                  return
                }
                setStato((s) => ({
                  ...s,
                  codiceAttivo: esito.data.codice,
                  codiceScadeAt: esito.data.scadeAt,
                  istruzioniStart: esito.data.istruzioni,
                }))
                avvisa('Codice generato — aprilo su Telegram entro 15 minuti.')
                router.refresh()
              })
            }
            className="bottone-oro rounded-lg px-3 py-1.5 text-xs font-semibold text-eco-abisso disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
            }}
          >
            {inCorso ? '…' : stato.istruzioniStart ? 'Nuovo codice' : 'Collega Telegram'}
          </button>
        ) : null}

        {stato.collegato ? (
          <button
            type="button"
            disabled={inCorso}
            onClick={() =>
              esegui(async () => {
                setErrore(null)
                const esito = await scollegaTelegram()
                if (!esito.ok) {
                  setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
                  return
                }
                setStato((s) => ({
                  ...s,
                  collegato: false,
                  codiceAttivo: null,
                  codiceScadeAt: null,
                  istruzioniStart: null,
                }))
                avvisa('Telegram scollegato.')
                router.refresh()
              })
            }
            className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs disabled:opacity-60"
            style={{ borderColor: 'var(--bordo)' }}
          >
            Scollega
          </button>
        ) : null}
      </div>
    </div>
  )
}
