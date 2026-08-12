import path from 'node:path'
import {
  chromium as playwrightChromium,
  type Browser,
} from 'playwright-core'

/** Vercel e Lambda non hanno il browser Playwright preinstallato. */
export function ambienteServerlessPdf(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
}

/**
 * Avvia Chromium per la stampa PDF.
 *
 * In locale usa il browser di `playwright` (devDependency + `npx playwright install chromium`).
 * Su Vercel usa `@sparticuz/chromium`, pensato per funzioni serverless.
 */
export async function lanciaChromiumPerPdf(): Promise<Browser> {
  if (ambienteServerlessPdf()) {
    const sparticuz = (await import('@sparticuz/chromium')).default
    sparticuz.setGraphicsMode = false

    const executablePath = await sparticuz.executablePath()

    // Su Lambda/Vercel le shared library stanno accanto all'eseguibile.
    process.env.LD_LIBRARY_PATH = path.dirname(executablePath)

    return playwrightChromium.launch({
      args: [...sparticuz.args, '--disable-dev-shm-usage', '--disable-gpu'],
      executablePath,
      headless: true,
    })
  }

  const { chromium } = await import(/* webpackIgnore: true */ 'playwright')
  return chromium.launch({ headless: true })
}
