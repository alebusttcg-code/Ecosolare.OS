import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'

export interface DocumentoTecnicoPreventivo {
  readonly id: string
  readonly productId: string
  readonly title: string
  readonly versionLabel: string
  readonly storageKey: string
  readonly mimeType: string
  readonly checksum: string | null
  readonly includedPages: readonly number[] | null
  readonly sortOrder: number
}

export interface DocumentoTecnicoCaricato extends DocumentoTecnicoPreventivo {
  readonly bytes: Uint8Array
}

/**
 * Legge la selezione congelata nello snapshot di una versione inviata.
 * `null` significa che lo snapshot e' precedente a questa funzione e consente
 * il ripiego sul catalogo corrente; `[]` significa invece "nessun allegato".
 */
export function leggiDocumentiTecniciSnapshot(
  snapshot: unknown,
): readonly DocumentoTecnicoPreventivo[] | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  if (!Object.prototype.hasOwnProperty.call(snapshot, 'documentiTecnici')) return null

  const valore = (snapshot as { documentiTecnici?: unknown }).documentiTecnici
  if (!Array.isArray(valore)) return null

  const documenti: DocumentoTecnicoPreventivo[] = []
  for (const voce of valore) {
    if (!voce || typeof voce !== 'object') return null
    const documento = voce as Record<string, unknown>
    if (
      typeof documento.id !== 'string' ||
      typeof documento.productId !== 'string' ||
      typeof documento.title !== 'string' ||
      typeof documento.versionLabel !== 'string' ||
      typeof documento.storageKey !== 'string' ||
      typeof documento.mimeType !== 'string' ||
      (documento.checksum !== null && typeof documento.checksum !== 'string') ||
      typeof documento.sortOrder !== 'number'
    ) {
      return null
    }

    const pagine = documento.includedPages
    if (
      pagine !== null &&
      (!Array.isArray(pagine) ||
        !pagine.every((pagina) => Number.isInteger(pagina) && Number(pagina) > 0))
    ) {
      return null
    }

    documenti.push({
      id: documento.id,
      productId: documento.productId,
      title: documento.title,
      versionLabel: documento.versionLabel,
      storageKey: documento.storageKey,
      mimeType: documento.mimeType,
      checksum: documento.checksum as string | null,
      includedPages: pagine as readonly number[] | null,
      sortOrder: documento.sortOrder,
    })
  }
  return documenti
}

export interface MetadatiShellTecnico {
  readonly codice: string
  readonly dataDocumento: string
  readonly logoPng: Uint8Array
}

const A4 = { width: 595.28, height: 841.89 } as const
const COLORE = {
  carta: rgb(1, 254 / 255, 250 / 255),
  navy: rgb(7 / 255, 29 / 255, 61 / 255),
  blue: rgb(31 / 255, 95 / 255, 214 / 255),
  gold: rgb(244 / 255, 197 / 255, 0),
  slate: rgb(101 / 255, 113 / 255, 131 / 255),
  border: rgb(220 / 255, 222 / 255, 220 / 255),
} as const

function pagineSelezionate(
  totale: number,
  selezione: readonly number[] | null,
): readonly number[] {
  const pagine = selezione?.length
    ? [...new Set(selezione)]
    : Array.from({ length: totale }, (_, indice) => indice + 1)
  for (const pagina of pagine) {
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > totale) {
      throw new Error(
        `Pagina tecnica ${pagina} non valida: il documento contiene ${totale} pagine.`,
      )
    }
  }
  return pagine
}

function disegnaShell(params: {
  readonly page: PDFPage
  readonly logo: PDFImage
  readonly regular: PDFFont
  readonly bold: PDFFont
  readonly titolo: string
  readonly codice: string
  readonly dataDocumento: string
  readonly numero: number
}) {
  const { page, logo, regular, bold } = params
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: COLORE.carta })
  const logoWidth = 150
  const logoHeight = (logo.height / logo.width) * logoWidth
  page.drawImage(logo, {
    x: 34,
    y: A4.height - 32 - logoHeight,
    width: logoWidth,
    height: logoHeight,
  })
  page.drawText('Proposta n.', {
    x: 420,
    y: A4.height - 48,
    size: 7,
    font: regular,
    color: COLORE.slate,
  })
  page.drawText(params.codice, {
    x: 420,
    y: A4.height - 60,
    size: 9,
    font: bold,
    color: COLORE.navy,
  })
  page.drawText(params.dataDocumento, {
    x: 420,
    y: A4.height - 82,
    size: 8,
    font: regular,
    color: COLORE.navy,
  })
  page.drawLine({
    start: { x: 34, y: A4.height - 105 },
    end: { x: A4.width - 34, y: A4.height - 105 },
    thickness: 0.7,
    color: COLORE.slate,
  })
  page.drawText('DOCUMENTAZIONE TECNICA', {
    x: 34,
    y: A4.height - 127,
    size: 7.5,
    font: bold,
    color: COLORE.blue,
  })
  page.drawText(params.titolo.slice(0, 86), {
    x: 34,
    y: A4.height - 148,
    size: 12,
    font: regular,
    color: COLORE.navy,
  })
  page.drawLine({
    start: { x: 34, y: 39 },
    end: { x: A4.width - 34, y: 39 },
    thickness: 0.7,
    color: COLORE.navy,
  })
  page.drawText('EcoSolare • Con te verso il futuro', {
    x: 34,
    y: 23,
    size: 7,
    font: regular,
    color: COLORE.slate,
  })
  page.drawText(String(params.numero).padStart(2, '0'), {
    x: A4.width - 51,
    y: 20,
    size: 11,
    font: regular,
    color: COLORE.blue,
  })
  page.drawRectangle({ x: 0, y: 0, width: A4.width * 0.74, height: 6, color: COLORE.navy })
  page.drawRectangle({ x: A4.width * 0.74, y: 0, width: A4.width * 0.16, height: 6, color: COLORE.blue })
  page.drawRectangle({ x: A4.width * 0.9, y: 0, width: A4.width * 0.1, height: 6, color: COLORE.gold })
}

/**
 * Accoda le schede prodotto dopo le 14 pagine commerciali, senza permettere a
 * una scheda tecnica di modificare l'ordine del corpo principale.
 */
export async function assemblaPreventivoConDocumentiTecnici(params: {
  readonly corpo: Uint8Array
  readonly documenti: readonly DocumentoTecnicoCaricato[]
  readonly shell: MetadatiShellTecnico
}): Promise<Buffer> {
  if (params.documenti.length === 0) return Buffer.from(params.corpo)

  const output = await PDFDocument.create()
  const corpo = await PDFDocument.load(params.corpo)
  const pagineCorpo = await output.copyPages(corpo, corpo.getPageIndices())
  pagineCorpo.forEach((pagina) => output.addPage(pagina))

  const documenti = [...params.documenti].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'it'),
  )
  const sorgenti: Array<{
    readonly documento: DocumentoTecnicoCaricato
    readonly pdf: PDFDocument
    readonly indici: readonly number[]
  }> = []
  for (const documento of documenti) {
    const pdf = await PDFDocument.load(documento.bytes)
    const pagine = pagineSelezionate(pdf.getPageCount(), documento.includedPages)
    sorgenti.push({ documento, pdf, indici: pagine.map((pagina) => pagina - 1) })
  }

  const logo = await output.embedPng(params.shell.logoPng)
  const regular = await output.embedFont(StandardFonts.Helvetica)
  const bold = await output.embedFont(StandardFonts.HelveticaBold)

  let numero = pagineCorpo.length
  for (const sorgente of sorgenti) {
    for (const indice of sorgente.indici) {
      numero += 1
      const [embedded] = await output.embedPdf(sorgente.pdf, [indice])
      if (!embedded) throw new Error('Impossibile incorporare la pagina tecnica.')
      const page = output.addPage([A4.width, A4.height])
      disegnaShell({
        page,
        logo,
        regular,
        bold,
        titolo: `${sorgente.documento.title} · ${sorgente.documento.versionLabel}`,
        codice: params.shell.codice,
        dataDocumento: params.shell.dataDocumento,
        numero,
      })

      const area = { x: 34, y: 55, width: A4.width - 68, height: A4.height - 220 }
      const scala = Math.min(area.width / embedded.width, area.height / embedded.height)
      const width = embedded.width * scala
      const height = embedded.height * scala
      page.drawRectangle({
        x: area.x - 1,
        y: area.y - 1,
        width: area.width + 2,
        height: area.height + 2,
        borderWidth: 0.6,
        borderColor: COLORE.border,
        color: rgb(1, 1, 1),
      })
      page.drawPage(embedded, {
        x: area.x + (area.width - width) / 2,
        y: area.y + (area.height - height) / 2,
        xScale: scala,
        yScale: scala,
      })
    }
  }

  output.setTitle(`Preventivo ${params.shell.codice}`)
  output.setAuthor('EcoSolare')
  output.setSubject('Preventivo con documentazione tecnica prodotto')
  output.setProducer('EcoSolare PDF Design System')
  return Buffer.from(await output.save({ useObjectStreams: false }))
}
