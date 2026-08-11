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

let logoCache: Buffer | null = null

/** JPEG compressi per il PDF (i PNG sorgente restano in template/). */
const MARKETING_RELATIVI = [
  'public/preventivo/template/perche-qualita.jpg',
  'public/preventivo/template/altroconsumo.jpg',
  'public/preventivo/template/recensioni.jpg',
  'public/preventivo/template/garanzie.jpg',
  'public/preventivo/template/garanzia-10-anni.jpg',
] as const

const marketingCache = new Map<string, string>()

async function logoBuffer(): Promise<Buffer> {
  if (logoCache) return logoCache
  const percorso = path.join(process.cwd(), ECOSOLARE.logoRelativo)
  logoCache = await readFile(percorso)
  return logoCache
}

async function marketingDataUri(relativo: string): Promise<string | null> {
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
}

/** Produce il PDF del preventivo come buffer, pronto per la risposta HTTP. */
export async function generaPdfPreventivo(
  dati: DatiPdfPreventivo,
  opzioni?: OpzioniGeneraPdf,
): Promise<Buffer> {
  registraFontiPreventivo()

  const logo = await logoBuffer()
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`
  const pagineMarketing = (
    await Promise.all(MARKETING_RELATIVI.map((r) => marketingDataUri(r)))
  ).filter((u): u is string => !!u)

  let planimetria = dati.planimetria
  if (planimetria && opzioni?.studio) {
    const chiave = env().GOOGLE_MAPS_API_KEY
    planimetria = await arricchisciPlanimetriaConOrtofoto(
      planimetria,
      opzioni.studio,
      chiave,
    )
  }

  const documento = (
    <DocumentoPreventivo
      dati={{ ...dati, planimetria, pagineMarketing }}
      logoSrc={logoSrc}
    />
  ) as ReactElement<DocumentProps>
  return renderToBuffer(documento)
}
