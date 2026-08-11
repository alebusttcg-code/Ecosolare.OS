import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  assemblaPreventivoConDocumentiTecnici,
  leggiDocumentiTecniciSnapshot,
} from './documenti-tecnici'

const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ),
)

async function pdfConPagine(numero: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  for (let indice = 0; indice < numero; indice += 1) {
    const page = pdf.addPage([595.28, 841.89])
    page.drawText(`Pagina ${indice + 1}`, { x: 40, y: 780, size: 12 })
  }
  return pdf.save()
}

describe('appendice tecnica del preventivo', () => {
  it('distingue uno snapshot senza selezione da una selezione vuota congelata', () => {
    expect(leggiDocumentiTecniciSnapshot({ inviatoIl: '2026-08-11' })).toBeNull()
    expect(leggiDocumentiTecniciSnapshot({ documentiTecnici: [] })).toEqual([])
  })

  it('rilegge versione, hash e pagine della scheda congelata', () => {
    expect(
      leggiDocumentiTecniciSnapshot({
        documentiTecnici: [
          {
            id: 'doc-1',
            productId: 'prodotto-1',
            title: 'Modulo fotovoltaico',
            versionLabel: '2026.1',
            storageKey: 'prodotti/modulo-2026-1.pdf',
            mimeType: 'application/pdf',
            checksum: 'sha256:test',
            includedPages: [1, 3],
            sortOrder: 10,
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        versionLabel: '2026.1',
        checksum: 'sha256:test',
        includedPages: [1, 3],
      }),
    ])
  })

  it('mantiene il corpo davanti e accoda solo le pagine selezionate', async () => {
    const output = await assemblaPreventivoConDocumentiTecnici({
      corpo: await pdfConPagine(14),
      documenti: [
        {
          id: 'doc-1',
          productId: 'prodotto-1',
          title: 'Modulo fotovoltaico',
          versionLabel: '2026.1',
          storageKey: 'prodotti/modulo.pdf',
          mimeType: 'application/pdf',
          checksum: null,
          includedPages: [2],
          sortOrder: 10,
          bytes: await pdfConPagine(3),
        },
      ],
      shell: {
        codice: 'T-2026-0167',
        dataDocumento: '03/08/2026',
        logoPng: PNG_1X1,
      },
    })

    const pdf = await PDFDocument.load(output)
    expect(pdf.getPageCount()).toBe(15)
    expect(pdf.getPage(14).getSize()).toEqual({ width: 595.28, height: 841.89 })
  })

  it('blocca una selezione pagine non valida', async () => {
    await expect(
      assemblaPreventivoConDocumentiTecnici({
        corpo: await pdfConPagine(1),
        documenti: [
          {
            id: 'doc-1',
            productId: 'prodotto-1',
            title: 'Inverter',
            versionLabel: '1',
            storageKey: 'prodotti/inverter.pdf',
            mimeType: 'application/pdf',
            checksum: null,
            includedPages: [4],
            sortOrder: 0,
            bytes: await pdfConPagine(2),
          },
        ],
        shell: {
          codice: 'TEST',
          dataDocumento: '01/01/2026',
          logoPng: PNG_1X1,
        },
      }),
    ).rejects.toThrow('Pagina tecnica 4 non valida')
  })
})
