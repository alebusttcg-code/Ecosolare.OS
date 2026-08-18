import { intestazioniStampa } from '@/lib/pdf/intestazioni-stampa'
import { lanciaChromiumPerPdf } from '@/lib/pdf/lancia-chromium'

/**
 * PDF di cortesia di una fattura, dalla stessa route HTML/CSS A4 stampata da
 * Playwright (ADR-015). Documento a pagina singola: non ha le pagine tecniche
 * del preventivo, quindi il core è autonomo e non tocca il generatore dei
 * preventivi — che ha una storia di errori in produzione da non riaprire.
 */
const VIEWPORT = { width: 1400, height: 1980 } as const

export async function generaPdfFattura(
  renderUrl: string,
  extraHeaders?: Readonly<Record<string, string>>,
): Promise<Buffer> {
  const url = new URL(renderUrl)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('La route HTML della fattura deve usare HTTP o HTTPS.')
  }

  const browser = await lanciaChromiumPerPdf()
  try {
    const context = await browser.newContext({
      locale: 'it-IT',
      timezoneId: 'Europe/Rome',
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      colorScheme: 'light',
      extraHTTPHeaders: intestazioniStampa({
        'Accept-Language': 'it-IT,it;q=0.9',
        ...extraHeaders,
      }),
    })
    const page = await context.newPage()

    const risposta = await page.goto(url.toString(), { waitUntil: 'load', timeout: 120_000 })
    if (!risposta?.ok()) {
      throw new Error(
        `Anteprima HTML non disponibile (${risposta?.status() ?? 'nessuna risposta'}).`,
      )
    }
    const destinazione = new URL(page.url())
    if (destinazione.origin !== url.origin || destinazione.pathname !== url.pathname) {
      throw new Error('La route HTML della fattura ha reindirizzato la generazione PDF.')
    }

    await page.waitForFunction(
      () => {
        const body = document.body
        return body.dataset.pdfReady === 'true' || Boolean(body.dataset.pdfError)
      },
      { timeout: 120_000 },
    )
    const erroreReady = await page.locator('body').getAttribute('data-pdf-error')
    if (erroreReady) throw new Error(`Anteprima HTML non pronta: ${erroreReady}`)

    await page.emulateMedia({ media: 'print' })
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
  } finally {
    await browser.close()
  }
}
