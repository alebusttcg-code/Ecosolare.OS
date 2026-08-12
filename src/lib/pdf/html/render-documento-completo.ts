import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DatiPdfPreventivo } from '@/lib/pdf/dati-preventivo'
import { baseUrlApplicazione } from '@/lib/pdf/base-url-applicazione'
import { QuoteDocument, type PaginaTecnicaHtml } from './preventivo-documento'

const DIRNAME = path.dirname(fileURLToPath(import.meta.url))

let cssCache: string | null = null

/** CSS co-locato al modulo così il file tracing di Next lo include nel deploy. */
function cssPreventivoPerStampa(): string {
  if (cssCache) return cssCache
  cssCache = readFileSync(path.join(DIRNAME, 'preventivo-stampa.css'), 'utf8')
  return cssCache
}

/** Replica client-side di PdfReadySignal, eseguita in pagina prima della stampa. */
const SCRIPT_READY = String.raw`(async () => {
  const FONT_ATTESI = [
    '12px Manrope',
    '600 12px Manrope',
    '700 12px Manrope',
    '12px "Bodoni Moda"',
    '700 12px "Bodoni Moda"',
  ]
  try {
    await document.fonts.ready
    await Promise.all(FONT_ATTESI.map((font) => document.fonts.load(font)))
    const fontMancante = FONT_ATTESI.find((font) => !document.fonts.check(font))
    if (fontMancante) throw new Error('Font non caricato: ' + fontMancante)
    await Promise.all(
      Array.from(document.images).map(async (immagine) => {
        if (!immagine.complete) {
          await new Promise((resolve, reject) => {
            immagine.addEventListener('load', () => resolve(undefined), { once: true })
            immagine.addEventListener(
              'error',
              () => reject(new Error('Immagine non caricata: ' + immagine.src)),
              { once: true },
            )
          })
        }
        await immagine.decode().catch(() => undefined)
      }),
    )
    document.body.dataset.pdfReady = 'true'
  } catch (errore) {
    document.body.dataset.pdfError =
      errore instanceof Error ? errore.message : 'Preparazione PDF fallita.'
  }
})()`

/** Documento HTML completo pronto per Playwright setContent (senza round-trip HTTP autenticato). */
export function renderDocumentoPreventivoCompleto(
  dati: DatiPdfPreventivo,
  pagineTecniche: readonly PaginaTecnicaHtml[],
  richiesta?: string,
): string {
  const base = baseUrlApplicazione(richiesta)
  const markup = renderToStaticMarkup(
    createElement(QuoteDocument, { dati, pagineTecniche }),
  )

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <base href="${base}/" />
  <style>${cssPreventivoPerStampa()}</style>
</head>
<body>
  ${markup}
  <script>${SCRIPT_READY}<\/script>
</body>
</html>`
}
