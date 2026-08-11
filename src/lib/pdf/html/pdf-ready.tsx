'use client'

import { useEffect } from 'react'

const FONT_ATTESI = [
  '12px Manrope',
  '600 12px Manrope',
  '700 12px Manrope',
  '12px "Bodoni Moda"',
  '700 12px "Bodoni Moda"',
] as const

export function PdfReadySignal() {
  useEffect(() => {
    let annullato = false
    document.body.removeAttribute('data-pdf-ready')
    document.body.removeAttribute('data-pdf-error')

    async function prepara() {
      await document.fonts.ready
      await Promise.all(FONT_ATTESI.map((font) => document.fonts.load(font)))
      const fontMancante = FONT_ATTESI.find((font) => !document.fonts.check(font))
      if (fontMancante) throw new Error(`Font non caricato: ${fontMancante}`)

      await Promise.all(
        Array.from(document.images).map(async (immagine) => {
          if (!immagine.complete) {
            await new Promise<void>((resolve, reject) => {
              immagine.addEventListener('load', () => resolve(), { once: true })
              immagine.addEventListener('error', () => reject(new Error(`Immagine non caricata: ${immagine.src}`)), { once: true })
            })
          }
          await immagine.decode().catch(() => undefined)
        }),
      )

      if (!annullato) document.body.dataset.pdfReady = 'true'
    }

    void prepara().catch((errore: unknown) => {
      if (!annullato) {
        document.body.dataset.pdfError =
          errore instanceof Error ? errore.message : 'Preparazione PDF fallita.'
      }
    })

    return () => {
      annullato = true
    }
  }, [])

  return null
}
