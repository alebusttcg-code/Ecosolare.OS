'use client'

import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { FotocameraDialogo } from '@/components/fotocamera-dialogo'

const STILE =
  'bottone-fantasma inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs'

/**
 * Coppia di ingressi per allegare un documento: dal disco o dalla fotocamera.
 *
 * «Carica» apre il selettore file. «Scatta foto» apre un dialogo con anteprima
 * live (`getUserMedia`): su desktop l'attributo `capture` dell'input file non
 * attiva la webcam e aprirebbe solo il Finder.
 */
export function ScegliFile({
  onFile,
  disabled = false,
  etichetta,
  soloImmagini = false,
}: {
  onFile: (file: File) => void
  disabled?: boolean
  /** Testo del bottone «da file» (es. «+ Carica file», «+ Nuova versione»). */
  etichetta: ReactNode
  /** Solo JPEG/PNG: per fotografie di sopralluogo, senza PDF. */
  soloImmagini?: boolean
}) {
  const [fotocameraAperta, setFotocameraAperta] = useState(false)
  const fallbackCaptureRef = useRef<HTMLInputElement>(null)

  const gestisci = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Azzerato subito: riscegliere lo stesso file deve ri-innescare onChange.
    e.target.value = ''
    if (file) onFile(file)
  }

  function apriFotocamera() {
    if (disabled) return
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      setFotocameraAperta(true)
      return
    }
    // Dispositivi senza API webcam: ripiega sul selettore con hint `capture`.
    fallbackCaptureRef.current?.click()
  }

  return (
    <>
      <label className={STILE} style={{ borderColor: 'var(--bordo)' }}>
        <input
          type="file"
          accept={
            soloImmagini
              ? 'image/*,.heic,.heif'
              : 'image/*,.heic,.heif,application/pdf,.pdf'
          }
          className="hidden"
          disabled={disabled}
          onChange={gestisci}
        />
        {etichetta}
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={apriFotocamera}
        className={STILE}
        style={{ borderColor: 'var(--bordo)' }}
        title="Apri la fotocamera e allega lo scatto"
      >
        <span aria-hidden style={{ color: 'var(--color-eco-gold-300)' }}>
          ◉
        </span>
        Scatta foto
      </button>

      <input
        ref={fallbackCaptureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={gestisci}
      />

      <FotocameraDialogo
        aperto={fotocameraAperta}
        onChiudi={() => setFotocameraAperta(false)}
        onScatto={onFile}
      />
    </>
  )
}
