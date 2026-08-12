import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Il percorso delle librerie condivise di Chromium.
 *
 * Questo file esiste per un difetto che in locale non si riproduce mai:
 * `@sparticuz/chromium` scompatta le sue `.so` in `/tmp/al2023/lib` e ci punta
 * `LD_LIBRARY_PATH`; una riga che lo reimpostava sulla cartella
 * dell'eseguibile buttava via quel percorso, e in produzione Chromium moriva
 * con «error while loading shared libraries: libnss3.so» — exit 127, dieci
 * righe prima della prima pagina stampata.
 */

const finto = {
  eseguibile: '/tmp/chromium',
  percorsoLibrerie: '/tmp/al2023/lib',
}

type OpzioniLancio = { readonly executablePath: string; readonly headless: boolean }
const lancio = vi.fn(async (opzioni: OpzioniLancio) => ({ chiuso: opzioni.headless }))

vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--no-sandbox'],
    setGraphicsMode: true,
    // Come il pacchetto vero: prepara l'ambiente e restituisce l'eseguibile.
    executablePath: async () => {
      process.env.LD_LIBRARY_PATH = finto.percorsoLibrerie
      return finto.eseguibile
    },
  },
}))

vi.mock('playwright-core', () => ({ chromium: { launch: lancio } }))

const { ambienteServerlessPdf, lanciaChromiumPerPdf } = await import('./lancia-chromium')

describe('ambienteServerlessPdf', () => {
  const originale = { ...process.env }

  afterEach(() => {
    process.env = { ...originale }
  })

  it('rileva Vercel', () => {
    delete process.env.AWS_LAMBDA_FUNCTION_NAME
    process.env.VERCEL = '1'
    expect(ambienteServerlessPdf()).toBe(true)
  })

  it('rileva AWS Lambda', () => {
    delete process.env.VERCEL
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'fn'
    expect(ambienteServerlessPdf()).toBe(true)
  })

  it('resta falso in locale', () => {
    delete process.env.VERCEL
    delete process.env.AWS_LAMBDA_FUNCTION_NAME
    expect(ambienteServerlessPdf()).toBe(false)
  })
})

describe('avvio di Chromium su Vercel', () => {
  const originale = { ...process.env }

  beforeEach(() => {
    lancio.mockClear()
    process.env.VERCEL = '1'
    delete process.env.LD_LIBRARY_PATH
  })

  afterEach(() => {
    process.env = { ...originale }
  })

  it('non tocca il percorso delle librerie preparato dal pacchetto', async () => {
    await lanciaChromiumPerPdf()
    expect(process.env.LD_LIBRARY_PATH).toBe(finto.percorsoLibrerie)
  })

  it('avvia l’eseguibile scompattato, in headless', async () => {
    await lanciaChromiumPerPdf()
    expect(lancio).toHaveBeenCalledTimes(1)
    expect(lancio.mock.calls[0]![0]).toMatchObject({
      executablePath: finto.eseguibile,
      headless: true,
    })
  })
})
