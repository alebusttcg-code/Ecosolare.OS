import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { env } from '@/env'
import { ECOSOLARE } from '@/lib/brand/ecosolare'
import type { SnapshotStudioTetto } from '@/lib/domain/studio-tetto'
import type { DatiPdfPreventivo } from '@/lib/pdf/dati-preventivo'
import { registraFontiPreventivo } from '@/lib/pdf/fonti-preventivo'
import { arricchisciPlanimetriaConOrtofoto } from '@/lib/pdf/ortofoto-moduli-pdf'
import { DocumentoPreventivo } from '@/lib/pdf/preventivo'
import {
  assemblaPreventivoConDocumentiTecnici,
  type DocumentoTecnicoCaricato,
  type DocumentoTecnicoPreventivo,
} from '@/lib/pdf/premium/documenti-tecnici'
import { PAGINE_MARKETING } from '@/lib/pdf/testi-marketing'
import { getArchivio } from '@/lib/storage'

let logoCache: Buffer | null = null

const marketingCache = new Map<string, string>()

async function logoBuffer(): Promise<Buffer> {
  if (logoCache) return logoCache
  const percorso = path.join(process.cwd(), ECOSOLARE.logoRelativo)
  logoCache = await readFile(percorso)
  return logoCache
}

async function immagineDataUri(relativo: string): Promise<string | null> {
  const cached = marketingCache.get(relativo)
  if (cached) return cached
  try {
    const buf = await readFile(path.join(process.cwd(), relativo))
    const mime = relativo.endsWith('.jpg') || relativo.endsWith('.jpeg')
      ? 'image/jpeg'
      : 'image/png'
    const uri = `data:${mime};base64,${buf.toString('base64')}`
    marketingCache.set(relativo, uri)
    return uri
  } catch {
    return null
  }
}

export type OpzioniGeneraPdf = {
  readonly studio?: SnapshotStudioTetto | null
  readonly documentiTecnici?: readonly DocumentoTecnicoPreventivo[]
}

/** Produce il PDF del preventivo come buffer, pronto per la risposta HTTP. */
export async function generaPdfPreventivo(
  dati: DatiPdfPreventivo,
  opzioni?: OpzioniGeneraPdf,
): Promise<Buffer> {
  registraFontiPreventivo()

  const logo = await logoBuffer()
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`
  /*
   * Le immagini delle pagine marketing, risolte una volta sola e nell'ordine in
   * cui il testo se le aspetta. Una che manca lascia il suo posto vuoto senza
   * far saltare la generazione: un PDF senza un logo è consegnabile, un PDF che
   * non esiste no.
   */
  const immaginiMarketing = await Promise.all(
    PAGINE_MARKETING.map(async (pagina) =>
      (
        await Promise.all(
          pagina.immagini.map((relativo) =>
            immagineDataUri(path.join('public', relativo)),
          ),
        )
      ).filter((u): u is string => !!u),
    ),
  )

  let planimetria = dati.planimetria
  // Anteprima Moduli già nello snapshot: non ricomporre ortofoto+SVG.
  if (planimetria && opzioni?.studio && !planimetria.fotoDataUri) {
    const chiave = env().GOOGLE_MAPS_API_KEY
    planimetria = await arricchisciPlanimetriaConOrtofoto(
      planimetria,
      opzioni.studio,
      chiave,
    )
  }

  const documento = (
    <DocumentoPreventivo
      dati={{ ...dati, planimetria }}
      immaginiMarketing={immaginiMarketing}
      logoSrc={logoSrc}
      copertinaPremium={process.env.PREVENTIVO_PDF_PREMIUM_V2 === '1'}
    />
  ) as ReactElement<DocumentProps>
  const corpo = await renderToBuffer(documento)
  const documenti = opzioni?.documentiTecnici ?? []
  if (documenti.length === 0) return corpo

  const archivio = getArchivio()
  const caricati: DocumentoTecnicoCaricato[] = []
  for (const documentoTecnico of documenti) {
    if (documentoTecnico.mimeType !== 'application/pdf') {
      throw new Error(
        `La scheda tecnica “${documentoTecnico.title}” non è un PDF.`,
      )
    }
    const bytes = await archivio.leggi(documentoTecnico.storageKey)
    if (!bytes) {
      throw new Error(
        `Scheda tecnica non trovata in archivio: ${documentoTecnico.storageKey}`,
      )
    }
    if (documentoTecnico.checksum) {
      const checksum = createHash('sha256').update(bytes).digest('hex')
      if (checksum !== documentoTecnico.checksum) {
        throw new Error(
          `Checksum non valido per la scheda tecnica “${documentoTecnico.title}”.`,
        )
      }
    }
    caricati.push({ ...documentoTecnico, bytes })
  }

  return assemblaPreventivoConDocumentiTecnici({
    corpo,
    documenti: caricati,
    shell: {
      codice: dati.codice,
      dataDocumento: dati.dataDocumento,
      logoPng: logo,
    },
  })
}
