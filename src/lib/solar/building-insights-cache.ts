/**
 * Cache persistente dei buildingInsights (ADR-016, tappa 4b — difetto D11).
 *
 * `buildingInsightsNelRaggio` sonda fino a venticinque punti a pagamento per
 * trovare l'edificio, e finora non veniva salvato: lo stesso tetto si ripagava a
 * ogni click nel laboratorio. Questo wrapper lo cerca **una volta** e poi lo
 * possiede, con la stessa disciplina della climatologia.
 *
 * È puro: l'archivio è iniettato, così la logica di cache si prova senza
 * database e senza chiamare Google. L'adattatore su PostgreSQL sta a parte
 * (`building-insights-cache-db.ts`).
 */

import { buildingInsightsNelRaggio, type EsitoBuildingInsights } from './building-insights'
import type { AnalisiTetto, Coordinate } from './tipi'

/** Il dato del tetto salvabile: l'analisi senza l'indirizzo formattato, che è del geocode. */
export type DatiTetto = Omit<AnalisiTetto, 'formattedAddress'>

export interface ArchivioBuildingInsights {
  leggi(chiave: string): Promise<DatiTetto | null>
  scrivi(chiave: string, dati: DatiTetto): Promise<void>
}

/**
 * Passo della griglia, ~11 m (quarto decimale di grado): fine da distinguere due
 * edifici su lotti diversi, largo da ritrovare lo stesso tetto ricliccato a
 * pochi metri di distanza.
 */
const PASSO_GRIGLIA = 0.0001

export function chiaveEdificio(lat: number, lng: number): string {
  const arrotonda = (v: number) =>
    (Math.round(v / PASSO_GRIGLIA) * PASSO_GRIGLIA).toFixed(4)
  return `${arrotonda(lat)},${arrotonda(lng)}`
}

export interface OpzioniBuildingInsightsCache {
  readonly archivio: ArchivioBuildingInsights
  /** Iniettabile nei test; di default la ricerca reale a pagamento. */
  readonly cerca?: (location: Coordinate) => Promise<EsitoBuildingInsights>
}

/**
 * I buildingInsights di un tetto: dalla cache se ci sono, altrimenti cercati una
 * volta e salvati. Solo i **successi** si salvano — un «edificio non trovato» o
 * un errore di quota è transitorio e non va congelato.
 *
 * Drop-in per `buildingInsightsNelRaggio`: stesso tipo di ritorno, così i punti
 * d'uso cambiano solo la sorgente, non la logica.
 */
export async function buildingInsightsConCache(
  location: Coordinate,
  opzioni: OpzioniBuildingInsightsCache,
): Promise<EsitoBuildingInsights> {
  const chiave = chiaveEdificio(location.latitude, location.longitude)

  const inCache = await opzioni.archivio.leggi(chiave)
  if (inCache) return { ok: true, dati: inCache }

  const cerca = opzioni.cerca ?? buildingInsightsNelRaggio
  const esito = await cerca(location)
  if (!esito.ok) return esito

  // La scrittura è un'ottimizzazione: se la cache inciampa, il risultato c'è
  // comunque e non deve far fallire l'analisi.
  try {
    await opzioni.archivio.scrivi(chiave, esito.dati)
  } catch (errore) {
    console.error('Cache buildingInsights: scrittura fallita', errore)
  }

  return esito
}
