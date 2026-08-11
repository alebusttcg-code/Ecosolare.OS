import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { generaPdfPreventivo } from '@/lib/pdf/genera-preventivo'
import { WALTER_RICCI_HTML_FIXTURE } from '@/lib/pdf/html/fixture-walter'

const url = process.argv[2] ?? 'http://localhost:3000/pdf-render/demo/walter'
const output = path.resolve(process.argv[3] ?? 'tmp/pdfs/preventivo-html')

async function main() {
  await mkdir(path.join(output, 'html'), { recursive: true })

  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    viewport: { width: 1400, height: 1980 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  })
    const page = await context.newPage()
    const response = await page.goto(url, { waitUntil: 'networkidle' })
    if (!response?.ok()) throw new Error(`HTTP ${response?.status() ?? 'senza risposta'}`)

    await page.waitForFunction(() =>
      document.body.dataset.pdfReady === 'true' || Boolean(document.body.dataset.pdfError),
    )
    const pdfError = await page.locator('body').getAttribute('data-pdf-error')
    if (pdfError) throw new Error(pdfError)

    const pagine = page.locator('.pdf-page')
    const totale = await pagine.count()
    if (totale < 14) throw new Error(`Pagine HTML insufficienti: ${totale}`)
    for (let indice = 0; indice < totale; indice += 1) {
      await pagine.nth(indice).screenshot({
        path: path.join(output, 'html', `pagina-${String(indice + 1).padStart(2, '0')}.png`),
      })
    }

    const pdf = await generaPdfPreventivo(WALTER_RICCI_HTML_FIXTURE, {
      renderUrl: url,
    })
    await writeFile(path.join(output, 'preventivo.pdf'), pdf)
    console.log(`Verifica creata: ${output} (${totale} pagine)`)
  } finally {
    await browser.close()
  }
}

void main().catch((errore: unknown) => {
  console.error(errore)
  process.exitCode = 1
})
