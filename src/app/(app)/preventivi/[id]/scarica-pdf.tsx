'use client'

import { useState } from 'react'

export function ScaricaPdfPreventivo({
  versionId,
  disabled = false,
}: {
  readonly versionId: string
  readonly disabled?: boolean
}) {
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function scarica() {
    setErrore(null)
    setInCorso(true)
    try {
      const risposta = await fetch(`/api/preventivi/${versionId}/pdf`, {
        credentials: 'same-origin',
      })

      if (!risposta.ok) {
        let testo = `Errore ${risposta.status}`
        try {
          const json = (await risposta.json()) as { errore?: string; dettaglio?: string }
          testo = [json.errore, json.dettaglio].filter(Boolean).join(' — ') || testo
        } catch {
          testo = (await risposta.text()).slice(0, 200) || testo
        }
        setErrore(testo)
        return
      }

      const blob = await risposta.blob()
      const disposition = risposta.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i)
      const nome = decodeURIComponent(match?.[1] ?? match?.[2] ?? 'Preventivo.pdf')

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = nome
      link.click()
      URL.revokeObjectURL(url)
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : 'Download non riuscito.')
    } finally {
      setInCorso(false)
    }
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled={disabled || inCorso}
        onClick={() => void scarica()}
        className="bottone-fantasma flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-white/[0.04] disabled:opacity-50"
        style={{ borderColor: 'rgba(217,164,65,0.42)', color: 'var(--color-eco-gold-300)' }}
      >
        <span aria-hidden>{inCorso ? '…' : '↓'}</span>
        {inCorso ? 'Generazione PDF…' : 'Scarica PDF'}
      </button>
      {errore ? (
        <p className="text-xs text-eco-red-400" role="alert">
          {errore}
        </p>
      ) : null}
    </div>
  )
}
