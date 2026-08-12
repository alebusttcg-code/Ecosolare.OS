import { chromium } from 'playwright'
import type { DatiPdfPreventivo } from '@/lib/pdf/dati-preventivo'
import {
  assemblaPreventivoConDocumentiTecnici,
  caricaDocumentiTecnici,
  espandiPagineTecniche,
  type DocumentoTecnicoPreventivo,
} from '@/lib/pdf/premium/documenti-tecnici'

/**
 * Le pagine commerciali, quelle che ci sono sempre. Le cinque della
 * simulazione compaiono solo con lo studio tetto, quindi il totale non e' piu'
 * una costante: si legge dal documento appena stampato invece di darlo per
 * scontato, o l'assemblaggio degli allegati sbaglia di cinque pagine.
 */
const PAGINE_COMMERCIALI = 9
const VIEWPORT = { width: 1400, height: 1980 } as const
const A4_CSS = {
  width: (210 / 25.4) * 96,
  height: (297 / 25.4) * 96,
} as const

export type OpzioniGeneraPdf = {
  /** URL assoluto della stessa anteprima HTML mostrata nel CRM. */
  readonly renderUrl: string
  /** Sessione della richiesta corrente, inoltrata esclusivamente allo stesso origin. */
  readonly cookieHeader?: string | null
  readonly documentiTecnici?: readonly DocumentoTecnicoPreventivo[]
}

function verificaUrlRender(renderUrl: string): URL {
  const url = new URL(renderUrl)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('La route HTML del preventivo deve usare HTTP o HTTPS.')
  }
  return url
}

/**
 * Stampa la route HTML/CSS A4 con il Chromium distribuito dalla versione
 * bloccata di Playwright. Font e immagini espongono un unico segnale di ready.
 */
interface CorpoStampato {
  readonly pdf: Buffer
  readonly numeroPagine: number
}

async function stampaHtmlConChromium(
  renderUrl: string,
  cookieHeader?: string | null,
): Promise<CorpoStampato> {
  const url = verificaUrlRender(renderUrl)
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({
      locale: 'it-IT',
      timezoneId: 'Europe/Rome',
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      colorScheme: 'light',
      extraHTTPHeaders: {
        'Accept-Language': 'it-IT,it;q=0.9',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    })
    const page = await context.newPage()
    const risposta = await page.goto(url.toString(), { waitUntil: 'networkidle' })
    if (!risposta?.ok()) {
      throw new Error(
        `Anteprima HTML non disponibile (${risposta?.status() ?? 'nessuna risposta'}).`,
      )
    }
    const destinazione = new URL(page.url())
    if (destinazione.origin !== url.origin || destinazione.pathname !== url.pathname) {
      throw new Error('La route HTML del preventivo ha reindirizzato la generazione PDF.')
    }

    await page.waitForFunction(() => {
      const body = document.body
      return body.dataset.pdfReady === 'true' || Boolean(body.dataset.pdfError)
    })
    const erroreReady = await page.locator('body').getAttribute('data-pdf-error')
    if (erroreReady) throw new Error(`Anteprima HTML non pronta: ${erroreReady}`)

    const pagine = page.locator('.pdf-page')
    const numeroPagine = await pagine.count()
    if (numeroPagine < PAGINE_COMMERCIALI) {
      throw new Error(`Preventivo incompleto: trovate ${numeroPagine} pagine, attese almeno ${PAGINE_COMMERCIALI}.`)
    }
    for (let indice = 0; indice < numeroPagine; indice += 1) {
      const box = await pagine.nth(indice).boundingBox()
      if (
        !box ||
        Math.abs(box.width - A4_CSS.width) > 1 ||
        Math.abs(box.height - A4_CSS.height) > 1
      ) {
        throw new Error(`Pagina ${indice + 1} non conforme al formato A4 CSS.`)
      }
    }

    await page.emulateMedia({ media: 'print' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return { pdf, numeroPagine }
  } finally {
    await browser.close()
  }
}

/** Produce il PDF cliente dalla medesima route HTML usata per l’anteprima CRM. */
export async function generaPdfPreventivo(
  _dati: DatiPdfPreventivo,
  opzioni: OpzioniGeneraPdf,
): Promise<Buffer> {
  const documenti = opzioni.documentiTecnici ?? []
  const caricati = await caricaDocumentiTecnici(documenti)
  const corpo = await stampaHtmlConChromium(
    opzioni.renderUrl,
    opzioni.cookieHeader,
  )

  // Le pagine tecniche sono in coda: il corpo e' tutto quello che le precede.
  const pagineAllegate = await espandiPagineTecniche(caricati)
  return assemblaPreventivoConDocumentiTecnici({
    corpoConWrapper: corpo.pdf,
    documenti: caricati,
    numeroPagineCorpo: corpo.numeroPagine - pagineAllegate.length,
  })
}
