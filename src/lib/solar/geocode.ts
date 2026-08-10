import { z } from 'zod'
import { env } from '@/env'
import type { Coordinate, ErroreSolar } from './tipi'

const geocodeSchema = z.object({
  status: z.string(),
  error_message: z.string().optional(),
  results: z
    .array(
      z.object({
        formatted_address: z.string(),
        geometry: z.object({
          location: z.object({
            lat: z.number(),
            lng: z.number(),
          }),
        }),
      }),
    )
    .default([]),
})

export type EsitoGeocode =
  | { readonly ok: true; readonly formatted: string; readonly location: Coordinate }
  | { readonly ok: false; readonly errore: ErroreSolar }

/**
 * Geocoding indirizzo → lat/lng (Italia preferita).
 * Chiave solo server-side.
 */
export async function geocodeIndirizzo(indirizzo: string): Promise<EsitoGeocode> {
  const chiave = env().GOOGLE_MAPS_API_KEY?.trim()
  if (!chiave) {
    return {
      ok: false,
      errore: {
        codice: 'non_configurato',
        messaggio:
          'Solar non configurato: manca GOOGLE_MAPS_API_KEY (Geocoding + Solar API).',
      },
    }
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', indirizzo)
  url.searchParams.set('region', 'it')
  url.searchParams.set('language', 'it')
  url.searchParams.set('key', chiave)

  let json: unknown
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    json = await res.json()
  } catch {
    return {
      ok: false,
      errore: {
        codice: 'rete',
        messaggio: 'Impossibile contattare il servizio di geocoding.',
      },
    }
  }

  const parsed = geocodeSchema.safeParse(json)
  if (!parsed.success) {
    return {
      ok: false,
      errore: { codice: 'sconosciuto', messaggio: 'Risposta geocoding non valida.' },
    }
  }

  const { status, results, error_message: msg } = parsed.data
  if (status === 'ZERO_RESULTS' || results.length === 0) {
    return {
      ok: false,
      errore: {
        codice: 'geocode',
        messaggio: 'Indirizzo non trovato. Controlla via, civico e comune.',
      },
    }
  }
  if (status === 'OVER_QUERY_LIMIT' || status === 'REQUEST_DENIED') {
    return {
      ok: false,
      errore: {
        codice: 'quota',
        messaggio: msg ?? 'Geocoding rifiutato (quota o restrizioni della chiave).',
      },
    }
  }
  if (status !== 'OK') {
    return {
      ok: false,
      errore: {
        codice: 'geocode',
        messaggio: msg ?? `Geocoding non riuscito (${status}).`,
      },
    }
  }

  const primo = results[0]!
  return {
    ok: true,
    formatted: primo.formatted_address,
    location: {
      latitude: primo.geometry.location.lat,
      longitude: primo.geometry.location.lng,
    },
  }
}
