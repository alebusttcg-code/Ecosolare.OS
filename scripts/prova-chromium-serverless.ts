import { lanciaChromiumPerPdf } from '@/lib/pdf/lancia-chromium'

async function main() {
  const browser = await lanciaChromiumPerPdf()
  try {
    const page = await browser.newPage()
    await page.setContent('<html><body><h1>test</h1></body></html>')
    const pdf = await page.pdf({ format: 'A4' })
    console.log('OK pdf bytes', pdf.length)
  } finally {
    await browser.close()
  }
}

void main().catch((errore: unknown) => {
  console.error('FAIL', errore)
  process.exitCode = 1
})
