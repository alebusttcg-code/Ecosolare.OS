import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { ECOSOLARE } from '@/lib/brand/ecosolare'
import type { DatiPdfPreventivo } from '@/lib/pdf/dati-preventivo'
import { DocumentoPreventivo } from '@/lib/pdf/preventivo'

let logoCache: Buffer | null = null

async function logoBuffer(): Promise<Buffer> {
  if (logoCache) return logoCache
  const percorso = path.join(process.cwd(), ECOSOLARE.logoRelativo)
  logoCache = await readFile(percorso)
  return logoCache
}

/** Produce il PDF del preventivo come buffer, pronto per la risposta HTTP. */
export async function generaPdfPreventivo(dati: DatiPdfPreventivo): Promise<Buffer> {
  const logo = await logoBuffer()
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`
  // DocumentoPreventivo restituisce <Document>: il cast allinea i tipi di react-pdf.
  const documento = (
    <DocumentoPreventivo dati={dati} logoSrc={logoSrc} />
  ) as ReactElement<DocumentProps>
  return renderToBuffer(documento)
}
