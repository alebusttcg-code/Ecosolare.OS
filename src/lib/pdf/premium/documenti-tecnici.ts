import { createHash } from 'node:crypto'
import { PDFDocument } from 'pdf-lib'
import { getArchivio } from '@/lib/storage'

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

export interface PaginaTecnicaPreventivo {
  readonly documento: DocumentoTecnicoPreventivo
  readonly paginaDocumento: number
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
    ) return null

    const pagine = documento.includedPages
    if (
      pagine !== null &&
      (!Array.isArray(pagine) || !pagine.every((pagina) => Number.isInteger(pagina) && Number(pagina) > 0))
    ) return null

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

function pagineSelezionate(totale: number, selezione: readonly number[] | null): readonly number[] {
  const pagine = selezione?.length ? [...new Set(selezione)] : Array.from({ length: totale }, (_, indice) => indice + 1)
  for (const pagina of pagine) {
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > totale) {
      throw new Error(`Pagina tecnica ${pagina} non valida: il documento contiene ${totale} pagine.`)
    }
  }
  return pagine
}

export async function caricaDocumentiTecnici(
  documenti: readonly DocumentoTecnicoPreventivo[],
): Promise<readonly DocumentoTecnicoCaricato[]> {
  if (documenti.length === 0) return []
  const archivio = getArchivio()
  const ordinati = [...documenti].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'it'))
  const caricati: DocumentoTecnicoCaricato[] = []

  for (const documento of ordinati) {
    if (documento.mimeType !== 'application/pdf') {
      throw new Error(`La scheda tecnica “${documento.title}” non è un PDF.`)
    }
    const bytes = await archivio.leggi(documento.storageKey)
    if (!bytes) throw new Error(`Scheda tecnica non trovata in archivio: ${documento.storageKey}`)
    if (documento.checksum) {
      const checksum = createHash('sha256').update(bytes).digest('hex')
      if (checksum !== documento.checksum) {
        throw new Error(`Checksum non valido per la scheda tecnica “${documento.title}”.`)
      }
    }
    caricati.push({ ...documento, bytes })
  }
  return caricati
}

export async function espandiPagineTecniche(
  documenti: readonly DocumentoTecnicoCaricato[],
): Promise<readonly PaginaTecnicaPreventivo[]> {
  const pagine: PaginaTecnicaPreventivo[] = []
  for (const documento of documenti) {
    const pdf = await PDFDocument.load(documento.bytes)
    for (const paginaDocumento of pagineSelezionate(pdf.getPageCount(), documento.includedPages)) {
      pagine.push({ documento, paginaDocumento })
    }
  }
  return pagine
}

const PUNTI_PER_MM = 72 / 25.4
const A4_HEIGHT = 297 * PUNTI_PER_MM
const SLOT = {
  x: 15 * PUNTI_PER_MM,
  y: A4_HEIGHT - (71 + 188) * PUNTI_PER_MM,
  width: 180 * PUNTI_PER_MM,
  height: 188 * PUNTI_PER_MM,
} as const

/**
 * Il design del wrapper e' già nel PDF stampato da HTML. pdf-lib si limita a
 * incorporare, scalare e posizionare la pagina vettoriale originale nel box.
 */
export async function assemblaPreventivoConDocumentiTecnici(params: {
  readonly corpoConWrapper: Uint8Array
  readonly documenti: readonly DocumentoTecnicoCaricato[]
  readonly numeroPagineCorpo?: number
}): Promise<Buffer> {
  if (params.documenti.length === 0) return Buffer.from(params.corpoConWrapper)

  const numeroPagineCorpo = params.numeroPagineCorpo ?? 14
  const output = await PDFDocument.load(params.corpoConWrapper)
  const pagineTecniche = await espandiPagineTecniche(params.documenti)
  if (output.getPageCount() !== numeroPagineCorpo + pagineTecniche.length) {
    throw new Error(
      `Wrapper tecnici non coerenti: attese ${pagineTecniche.length} pagine dopo il corpo, trovate ${Math.max(0, output.getPageCount() - numeroPagineCorpo)}.`,
    )
  }

  const sorgenti = new Map<string, PDFDocument>()
  for (let indice = 0; indice < pagineTecniche.length; indice += 1) {
    const paginaTecnica = pagineTecniche[indice]!
    let sorgente = sorgenti.get(paginaTecnica.documento.id)
    if (!sorgente) {
      const caricato = params.documenti.find((d) => d.id === paginaTecnica.documento.id)
      if (!caricato) throw new Error(`Documento tecnico non caricato: ${paginaTecnica.documento.id}`)
      sorgente = await PDFDocument.load(caricato.bytes)
      sorgenti.set(paginaTecnica.documento.id, sorgente)
    }

    const [embedded] = await output.embedPdf(sorgente, [paginaTecnica.paginaDocumento - 1])
    if (!embedded) throw new Error('Impossibile incorporare la pagina tecnica.')
    const scala = Math.min(SLOT.width / embedded.width, SLOT.height / embedded.height)
    const width = embedded.width * scala
    const height = embedded.height * scala
    output.getPage(numeroPagineCorpo + indice).drawPage(embedded, {
      x: SLOT.x + (SLOT.width - width) / 2,
      y: SLOT.y + (SLOT.height - height) / 2,
      xScale: scala,
      yScale: scala,
    })
  }

  return Buffer.from(await output.save({ useObjectStreams: false }))
}
