'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { deleteDocumentFile, uploadDocument } from '@/lib/actions/documents'
import { DIMENSIONE_MASSIMA, formattaDimensione } from '@/lib/domain/upload'

export interface FileCaricato {
  readonly id: string
  readonly filename: string
  readonly mimeType: string
  readonly sizeBytes: number
  readonly versionNo: number
}

/**
 * Caricamento di un documento.
 *
 * Il controllo di formato e dimensione viene rifatto sul server: quello qui
 * serve solo a dare una risposta immediata, non è una difesa. `accept` non
 * limita nulla — è un suggerimento al selettore di file del sistema.
 */
export function CaricaDocumento({
  requirementId,
  files,
}: {
  requirementId: string
  files: readonly FileCaricato[]
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  function carica(file: File) {
    setErrore(null)

    if (file.size > DIMENSIONE_MASSIMA) {
      setErrore(
        `Il file pesa ${formattaDimensione(file.size)}: il limite è ${formattaDimensione(DIMENSIONE_MASSIMA)}.`,
      )
      return
    }

    const dati = new FormData()
    dati.set('requirementId', requirementId)
    dati.set('file', file)

    avvia(async () => {
      const esito = await uploadDocument(dati)
      if (esito.ok) {
        if (input.current) input.current.value = ''
        router.refresh()
      } else {
        setErrore(Object.values(esito.errors)[0] ?? 'Caricamento non riuscito.')
      }
    })
  }

  return (
    <div className="mt-2">
      {files.length > 0 ? (
        <ul className="mb-2 space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-xs">
              <span aria-hidden style={{ color: 'var(--color-eco-blue-300)' }}>
                {f.mimeType === 'application/pdf' ? '▤' : '▣'}
              </span>
              <a
                href={`/api/documenti/${f.id}`}
                target="_blank"
                rel="noreferrer"
                className="collega truncate"
                style={{ color: 'var(--color-eco-blue-300)' }}
              >
                {f.filename}
              </a>
              <span style={{ color: 'var(--testo-fioco)' }}>
                v{f.versionNo} · {formattaDimensione(f.sizeBytes)}
              </span>
              <button
                type="button"
                disabled={inCorso}
                onClick={() =>
                  avvia(async () => {
                    await deleteDocumentFile(f.id)
                    router.refresh()
                  })
                }
                className="ml-auto px-1 leading-none"
                style={{ color: 'var(--testo-fioco)' }}
                aria-label="Elimina il file"
                title="Elimina il file"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label
        className="bottone-fantasma inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1 text-xs"
        style={{ borderColor: 'var(--bordo)' }}
      >
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className="hidden"
          disabled={inCorso}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) carica(file)
          }}
        />
        {inCorso ? 'Caricamento…' : files.length > 0 ? '+ Nuova versione' : '+ Carica file'}
      </label>

      {errore ? (
        <p className="mt-1 text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
          {errore}
        </p>
      ) : null}
    </div>
  )
}
