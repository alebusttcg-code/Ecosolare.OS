'use client'

import type { ChangeEvent, ReactNode } from 'react'

const STILE =
  'bottone-fantasma inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs'

/**
 * Coppia di ingressi per allegare un documento: dal disco o dalla fotocamera.
 *
 * «Scatta foto» usa `capture="environment"`: su telefono apre direttamente la
 * fotocamera posteriore e lo scatto arriva come JPEG (già tra i formati
 * ammessi); su desktop l'attributo viene ignorato e si apre il selettore
 * filtrato sulle immagini. Nessuna API extra, nessun permesso da gestire noi.
 *
 * Restituisce un fragment: la disposizione (riga, a capo, spaziature) la
 * decide chi lo usa.
 */
export function ScegliFile({
  onFile,
  disabled = false,
  etichetta,
}: {
  onFile: (file: File) => void
  disabled?: boolean
  /** Testo del bottone «da file» (es. «+ Carica file», «+ Nuova versione»). */
  etichetta: ReactNode
}) {
  const gestisci = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Azzerato subito: riscegliere lo stesso file deve ri-innescare onChange.
    e.target.value = ''
    if (file) onFile(file)
  }

  return (
    <>
      <label className={STILE} style={{ borderColor: 'var(--bordo)' }}>
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className="hidden"
          disabled={disabled}
          onChange={gestisci}
        />
        {etichetta}
      </label>

      <label
        className={STILE}
        style={{ borderColor: 'var(--bordo)' }}
        title="Apri la fotocamera e allega lo scatto"
      >
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={disabled}
          onChange={gestisci}
        />
        <span aria-hidden style={{ color: 'var(--color-eco-gold-300)' }}>
          ◉
        </span>
        Scatta foto
      </label>
    </>
  )
}
