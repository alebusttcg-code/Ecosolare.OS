/**
 * Client PVGIS (Photovoltaic Geographical Information System, Centro Comune di
 * Ricerca UE) — endpoint TMY (Typical Meteorological Year).
 *
 * PVGIS è la fonte fisica pubblica di riferimento in Europa: gratuita, senza
 * chiave, con copertura eccellente sull'Italia. Non è un rivale come SolarEdge —
 * è un dato, come lo è l'ombra di Google. Lo chiamiamo **una volta per sito**,
 * all'ingest, e da lì la climatologia è nostra (ADR-016).
 *
 * L'endpoint TMY restituisce 8.760 ore-tipo (una per ora dell'anno), cucite dai
 * mesi più rappresentativi di più anni reali. Per ogni ora dà:
 *   - `G(h)`  irraggiamento globale sul piano orizzontale, W/m²  (GHI)
 *   - `Gb(n)` diretto normale, W/m²                              (DNI)
 *   - `Gd(h)` diffuso sull'orizzontale, W/m²                     (DHI)
 *   - `T2m`   temperatura dell'aria a 2 m, °C
 * che sono esattamente gli ingressi della catena fisica (trasposizione,
 * temperatura di cella). Il resto (umidità, vento, pressione) qui non serve.
 */

import { z } from 'zod'

const BASE_PVGIS = 'https://re.jrc.ec.europa.eu/api/v5_2/tmy'

/** Una riga oraria del TMY: solo i campi che alimentano la fisica. */
export const rigaTmy = z.object({
  'time(UTC)': z.string(),
  'T2m': z.number(),
  'G(h)': z.number(),
  'Gb(n)': z.number(),
  'Gd(h)': z.number(),
})
export type RigaTmy = z.infer<typeof rigaTmy>

const rispostaTmy = z.object({
  inputs: z
    .object({
      location: z
        .object({
          latitude: z.number(),
          longitude: z.number(),
          elevation: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  outputs: z.object({
    tmy_hourly: z.array(rigaTmy).min(8000),
  }),
})
export type RispostaTmy = z.infer<typeof rispostaTmy>

export interface OpzioniPvgis {
  /** Timeout della richiesta, ms. Il TMY pesa ~1,3 MB: si dà respiro. */
  readonly timeoutMs?: number
  /** Iniettabile nei test; di default il `fetch` globale. */
  readonly fetchImpl?: typeof fetch
}

/**
 * Scarica il TMY per una coppia lat/lng e ne valida la struttura.
 *
 * Solleva su rete, su HTTP non-200 e su risposta che non rispetta lo schema:
 * meglio fermarsi con un errore leggibile che salvare in cache una climatologia
 * monca su cui poi gireranno tutti i preventivi del sito.
 */
export async function scaricaTmyPvgis(
  lat: number,
  lng: number,
  opzioni: OpzioniPvgis = {},
): Promise<RispostaTmy> {
  const fetchImpl = opzioni.fetchImpl ?? fetch
  const url = `${BASE_PVGIS}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&outputformat=json`

  const controllo = new AbortController()
  const timeout = setTimeout(() => controllo.abort(), opzioni.timeoutMs ?? 30_000)
  try {
    const risposta = await fetchImpl(url, { signal: controllo.signal })
    if (!risposta.ok) {
      throw new Error(`PVGIS ha risposto ${risposta.status} per ${lat},${lng}`)
    }
    const grezzo = await risposta.json()
    return rispostaTmy.parse(grezzo)
  } finally {
    clearTimeout(timeout)
  }
}
