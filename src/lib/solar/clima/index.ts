/**
 * Ingest e possesso della climatologia per-sito (ADR-016, tappa 2).
 *
 * Il principio: PVGIS si chiama **una volta per sito**, poi la climatologia è
 * nostra. Un preventivo non chiama nessuno. La climatologia di un luogo non
 * cambia da un preventivo all'altro, e il meteo non cambia dentro un chilometro:
 * per questo la chiave arrotonda le coordinate a una griglia, così case vicine
 * condividono lo stesso dato e la stessa (unica) chiamata.
 *
 * Lo store è **iniettabile**: qui la logica di cache è pura e testabile con un
 * archivio in memoria; l'adattatore su database è un dettaglio a valle.
 */

import { riduciTmyAClimatologia, type Climatologia } from './climatologia'
import { scaricaTmyPvgis, type OpzioniPvgis } from './pvgis'

/**
 * Dove la climatologia vive fra un preventivo e l'altro. Due sole operazioni,
 * perché non serve altro; l'implementazione su DB o su `app_settings` le
 * riempie senza che questa logica ne sappia nulla.
 */
export interface ArchivioClimatologia {
  leggi(chiave: string): Promise<Climatologia | null>
  scrivi(chiave: string, climatologia: Climatologia): Promise<void>
}

/**
 * Passi della griglia di cache, in gradi. ~0,01° ≈ 1,1 km: il meteo non cambia
 * su questa scala, e tetti vicini condividono la stessa climatologia (e la
 * stessa chiamata pagata una volta). Due decimali, come arrotonda la chiave.
 */
const PASSO_GRIGLIA = 0.01

/** Chiave di cache: coordinate arrotondate alla griglia, forma stabile. */
export function chiaveSito(lat: number, lng: number): string {
  const arrotonda = (v: number) =>
    (Math.round(v / PASSO_GRIGLIA) * PASSO_GRIGLIA).toFixed(2)
  return `${arrotonda(lat)},${arrotonda(lng)}`
}

export interface OpzioniGetClimatologia extends OpzioniPvgis {
  readonly archivio: ArchivioClimatologia
}

/**
 * La climatologia di un sito: dalla cache se c'è, altrimenti scaricata da PVGIS
 * una volta, ridotta a giorno-tipo mensile e salvata.
 *
 * È l'unico punto di tutto il motore che può toccare la rete, e lo fa solo al
 * primo passaggio su una griglia nuova. Da lì in poi risponde dallo store.
 */
export async function getClimatologia(
  lat: number,
  lng: number,
  opzioni: OpzioniGetClimatologia,
): Promise<Climatologia> {
  const chiave = chiaveSito(lat, lng)

  const inCache = await opzioni.archivio.leggi(chiave)
  if (inCache) return inCache

  const tmy = await scaricaTmyPvgis(lat, lng, opzioni)
  const climatologia = riduciTmyAClimatologia(tmy.outputs.tmy_hourly, {
    lat,
    lng,
    elevazioneM: tmy.inputs?.location?.elevation ?? null,
  })

  await opzioni.archivio.scrivi(chiave, climatologia)
  return climatologia
}

export { riduciTmyAClimatologia, type Climatologia } from './climatologia'
export {
  scaricaTmyPvgis,
  rigaTmy,
  type RigaTmy,
  type RispostaTmy,
  type OpzioniPvgis,
} from './pvgis'
