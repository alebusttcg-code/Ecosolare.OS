'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import { ScegliFile } from '@/components/scegli-file'
import { deleteSurveyPhoto, uploadSurveyPhoto } from '@/lib/actions/survey-files'
import { normalizzaAllegato } from '@/lib/domain/normalizza-allegato'
import { DIMENSIONE_MASSIMA, formattaDimensione } from '@/lib/domain/upload'

export interface FotoSopralluogo {
  readonly id: string
  readonly filename: string
  readonly mimeType: string
  readonly sizeBytes: number
}

/**
 * Caricamento fotografie per un campo del sopralluogo.
 *
 * Ogni scatto o file viene salvato subito sul server: sul campo non si aspetta
 * il «Salva bozza» per non perdere immagini se la connessione cede.
 */
export function CaricaFotoSopralluogo({
  surveyId,
  fieldCode,
  files,
  disabled = false,
  onCaricata,
  onEliminata,
}: {
  surveyId: string
  fieldCode: string
  files: readonly FotoSopralluogo[]
  disabled?: boolean
  onCaricata?: (fileId: string) => void
  onEliminata?: (fileId: string) => void
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  function carica(file: File) {
    setErrore(null)

    if (file.size > DIMENSIONE_MASSIMA) {
      setErrore(
        `Il file pesa ${formattaDimensione(file.size)}: il limite è ${formattaDimensione(DIMENSIONE_MASSIMA)}.`,
      )
      return
    }

    esegui(async () => {
      let allegato: File
      try {
        allegato = await normalizzaAllegato(file)
      } catch (errore) {
        setErrore(
          errore instanceof Error
            ? errore.message
            : 'Non è stato possibile preparare la foto per il caricamento.',
        )
        return
      }

      const dati = new FormData()
      dati.set('surveyId', surveyId)
      dati.set('fieldCode', fieldCode)
      dati.set('file', allegato)

      const esito = await uploadSurveyPhoto(dati)
      if (esito.ok) {
        onCaricata?.(esito.data.fileId)
        avvisa('Fotografia caricata.')
        router.refresh()
      } else setErrore(Object.values(esito.errors)[0] ?? 'Caricamento non riuscito.')
    })
  }

  return (
    <div className="mt-2">
      {files.length > 0 ? (
        <ul className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((f) => (
            <li
              key={f.id}
              className="group relative overflow-hidden rounded-lg border"
              style={{ borderColor: 'var(--bordo)', background: 'rgba(5,10,20,0.45)' }}
            >
              <a
                href={`/api/sopralluoghi/file/${f.id}`}
                target="_blank"
                rel="noreferrer"
                className="block aspect-[4/3] overflow-hidden"
                title={f.filename}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/sopralluoghi/file/${f.id}`}
                  alt={f.filename}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
              </a>
              <div
                className="flex items-center gap-1 border-t px-2 py-1 text-[10px]"
                style={{ borderColor: 'var(--bordo-tenue)', color: 'var(--testo-fioco)' }}
              >
                <span className="min-w-0 flex-1 truncate">{f.filename}</span>
                <span className="shrink-0 tabular-nums">{formattaDimensione(f.sizeBytes)}</span>
                {!disabled ? (
                  <button
                    type="button"
                    disabled={inCorso}
                    onClick={() =>
                      esegui(async () => {
                        await deleteSurveyPhoto(f.id)
                        onEliminata?.(f.id)
                        avvisa('Fotografia eliminata.', 'info')
                        router.refresh()
                      })
                    }
                    className="shrink-0 px-1 leading-none opacity-70 transition-opacity hover:opacity-100"
                    aria-label="Elimina la fotografia"
                    title="Elimina la fotografia"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!disabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <ScegliFile
            onFile={carica}
            disabled={inCorso}
            soloImmagini
            etichetta={
              inCorso ? 'Caricamento…' : files.length > 0 ? '+ Altra foto' : '+ Carica foto'
            }
          />
        </div>
      ) : files.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
          Nessuna fotografia allegata.
        </p>
      ) : null}

      {errore ? (
        <p className="mt-1 text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
          {errore}
        </p>
      ) : null}
    </div>
  )
}
