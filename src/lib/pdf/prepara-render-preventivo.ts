import { env } from '@/env'
import { arricchisciPlanimetriaConOrtofoto } from '@/lib/pdf/ortofoto-moduli-pdf'
import {
  caricaDocumentiTecnici,
  espandiPagineTecniche,
} from '@/lib/pdf/premium/documenti-tecnici'
import type { QuoteVersionPdfBundle } from '@/lib/queries/quotes'
import type { DatiPdfPreventivo } from '@/lib/pdf/dati-preventivo'
import type { PaginaTecnicaHtml } from '@/lib/pdf/html/preventivo-documento'

export interface RenderPreventivoPreparato {
  readonly dati: DatiPdfPreventivo
  readonly pagineTecniche: readonly PaginaTecnicaHtml[]
}

/** Arricchisce planimetria e pagine tecniche per anteprima HTML e stampa PDF. */
export async function preparaRenderPreventivo(
  bundle: QuoteVersionPdfBundle,
): Promise<RenderPreventivoPreparato> {
  let planimetria = bundle.dati.planimetria
  if (
    planimetria &&
    bundle.studio &&
    !planimetria.fotoSenzaModuliDataUri
  ) {
    planimetria = await arricchisciPlanimetriaConOrtofoto(
      planimetria,
      bundle.studio,
      env().GOOGLE_MAPS_API_KEY,
    )
  }

  const documentiCaricati = await caricaDocumentiTecnici(bundle.documentiTecnici)
  const pagineTecniche = await espandiPagineTecniche(documentiCaricati)

  return {
    dati: { ...bundle.dati, planimetria },
    pagineTecniche,
  }
}
