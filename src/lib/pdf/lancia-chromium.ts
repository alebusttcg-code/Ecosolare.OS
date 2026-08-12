/*
 * Solo il tipo: `playwright-core` si carica quando serve davvero.
 *
 * Con l'import statico il pacchetto veniva risolto al caricamento del modulo,
 * cioè prima che la rotta entrasse nel proprio try/catch: un problema di
 * impacchettamento usciva come 500 nudo del runtime invece che come il 503 con
 * il motivo scritto dentro. Chi scarica il preventivo merita di sapere perché
 * non è uscito.
 */
import type { Browser } from 'playwright-core'

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

    /*
     * `executablePath()` scompatta l'eseguibile in `/tmp/chromium` **e** le
     * librerie condivise in `/tmp/al2023/lib`, dove `LD_LIBRARY_PATH` punta già:
     * ci pensa il pacchetto, all'import.
     *
     * Qui c'era una riga che lo reimpostava sulla cartella dell'eseguibile
     * (`/tmp`), cancellando quel percorso. Le librerie restavano scompattate
     * dov'erano e Chromium moriva subito con «error while loading shared
     * libraries: libnss3.so», exit 127 — un errore che sembra un binario
     * mancante e invece è un percorso buttato via.
     */
    const executablePath = await sparticuz.executablePath()

    const { chromium: playwrightChromium } = await import('playwright-core')
    return playwrightChromium.launch({
      args: [...sparticuz.args, '--disable-dev-shm-usage', '--disable-gpu'],
      executablePath,
      headless: true,
    })
  }

  const { chromium } = await import(/* webpackIgnore: true */ 'playwright')
  return chromium.launch({ headless: true })
}
