'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAvvisi } from '@/components/avvisi'
import { formattaData } from '@/components/ui'
import {
  impostaFollowUpLead,
  segnaFollowUpFatto,
} from '@/lib/actions/follow-up-lead'
import { useAzioneServer } from '@/lib/use-azione-server'

interface FollowUpCorrente {
  id: string
  dueAt: Date | null
  notes: string | null
  completedAt: Date | null
}

function isoData(d: Date | null): string {
  const base = d ?? new Date(Date.now() + 2 * 86_400_000)
  return base.toISOString().slice(0, 10)
}

/**
 * Un unico follow-up per lead, gestito a mano: cliccando si apre il popup per
 * data e note; la spunta lo segna «fatto» (o lo riapre).
 */
export function FollowUpLead({
  opportunityId,
  corrente,
}: {
  opportunityId: string
  corrente: FollowUpCorrente | null
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const { inCorso, esegui } = useAzioneServer()
  const [aperto, setAperto] = useState(false)
  const [data, setData] = useState(() => isoData(corrente?.dueAt ?? null))
  const [note, setNote] = useState(corrente?.notes ?? '')
  const [errore, setErrore] = useState<string | null>(null)

  const fatto = Boolean(corrente?.completedAt)

  function apri() {
    setData(isoData(corrente?.dueAt ?? null))
    setNote(corrente?.notes ?? '')
    setErrore(null)
    setAperto(true)
  }

  function salva() {
    setErrore(null)
    esegui(async () => {
      try {
        const esito = await impostaFollowUpLead({
          opportunityId,
          dueAt: new Date(`${data}T09:00:00`),
          notes: note.trim() || undefined,
        })
        if (!esito.ok) {
          setErrore(Object.values(esito.errors)[0] ?? 'Salvataggio non riuscito.')
          return
        }
        setAperto(false)
        avvisa('Follow-up salvato.')
        router.refresh()
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Errore imprevisto.')
      }
    })
  }

  function toggleFatto() {
    if (!corrente) return
    esegui(async () => {
      try {
        const esito = await segnaFollowUpFatto({
          activityId: corrente.id,
          opportunityId,
          fatto: !fatto,
        })
        if (!esito.ok) {
          avvisa(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
          return
        }
        avvisa(fatto ? 'Follow-up riaperto.' : 'Follow-up segnato come fatto.')
        router.refresh()
      } catch (e) {
        avvisa(e instanceof Error ? e.message : 'Errore imprevisto.')
      }
    })
  }

  return (
    <div>
      {corrente ? (
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={apri}
            className="group min-w-0 text-left"
          >
            <div className={`text-sm font-medium ${fatto ? 'line-through opacity-60' : ''}`}>
              Follow-up
            </div>
            <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
              {fatto
                ? `Fatto ${formattaData(corrente.completedAt)}`
                : `Scade ${formattaData(corrente.dueAt)}`}
            </div>
            {corrente.notes ? (
              <p className="mt-1 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                {corrente.notes}
              </p>
            ) : null}
            <span className="mt-1 inline-block text-[11px] text-eco-blue-300 opacity-0 transition group-hover:opacity-100">
              Modifica
            </span>
          </button>
          <label
            className="flex shrink-0 cursor-pointer items-center gap-2 text-xs"
            style={{ color: 'var(--testo-tenue)' }}
          >
            <input
              type="checkbox"
              checked={fatto}
              onChange={toggleFatto}
              disabled={inCorso}
              className="h-4 w-4 accent-eco-gold-400"
            />
            Fatto
          </label>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
            Nessun follow-up impostato.
          </span>
          <button
            type="button"
            onClick={apri}
            className="bottone-fantasma shrink-0 rounded-lg border px-3 py-1.5 text-xs"
            style={{ borderColor: 'var(--bordo)' }}
          >
            + Imposta follow-up
          </button>
        </div>
      )}

      {aperto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(4,7,13,0.7)' }}
          onClick={() => setAperto(false)}
          role="presentation"
        >
          <div
            className="pannello w-full max-w-md rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-sm font-semibold">Follow-up</h3>
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-medium">Data</span>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
                style={{
                  background: 'rgba(5,10,20,0.6)',
                  borderColor: 'var(--bordo)',
                  caretColor: '#e8c765',
                }}
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium">Note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Cosa ricordare per questo follow-up…"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
                style={{
                  background: 'rgba(5,10,20,0.6)',
                  borderColor: 'var(--bordo)',
                  caretColor: '#e8c765',
                }}
              />
            </label>
            {errore ? (
              <p className="mt-2 text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
                {errore}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAperto(false)}
                className="bottone-fantasma rounded-lg border px-4 py-2 text-sm"
                style={{ borderColor: 'var(--bordo)' }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={salva}
                disabled={inCorso}
                className="bottone-oro rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg,#e8c765,#d9a441)',
                  color: '#050a14',
                }}
              >
                {inCorso ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
