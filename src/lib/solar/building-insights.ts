import { z } from 'zod'
import { env } from '@/env'
import type { AnalisiTetto, Coordinate, ErroreSolar, FaldaTetto } from './tipi'

const latLng = z.object({
  latitude: z.number(),
  longitude: z.number(),
})

const sizeStats = z.object({
  areaMeters2: z.number().optional(),
  groundAreaMeters2: z.number().optional(),
  sunshineQuantiles: z.array(z.number()).optional(),
})

const boundingBox = z.object({
  sw: latLng,
  ne: latLng,
})

const roofSegment = z.object({
  pitchDegrees: z.number().optional(),
  azimuthDegrees: z.number().optional(),
  stats: sizeStats.optional(),
  center: latLng.optional(),
  boundingBox: boundingBox.optional(),
  planeHeightAtCenterMeters: z.number().optional(),
})

const buildingInsightsSchema = z.object({
  center: latLng.optional(),
  boundingBox: boundingBox.optional(),
  imageryQuality: z.enum(['HIGH', 'MEDIUM', 'BASE']).optional(),
  imageryDate: z
    .object({
      year: z.number(),
      month: z.number(),
      day: z.number(),
    })
    .optional(),
  solarPotential: z
    .object({
      maxArrayPanelsCount: z.number().optional(),
      maxSunshineHoursPerYear: z.number().optional(),
      wholeRoofStats: sizeStats.optional(),
      roofSegmentStats: z.array(roofSegment).optional(),
    })
    .optional(),
  error: z
    .object({
      code: z.number().optional(),
      message: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
})

export type EsitoBuildingInsights =
  | { readonly ok: true; readonly dati: Omit<AnalisiTetto, 'formattedAddress'> }
  | { readonly ok: false; readonly errore: ErroreSolar }

function mediaSunshine(quantiles: readonly number[] | undefined): number | null {
  if (!quantiles || quantiles.length === 0) return null
  const somma = quantiles.reduce((a, b) => a + b, 0)
  return somma / quantiles.length
}

function formattaDataImmagine(d: {
  year: number
  month: number
  day: number
}): string {
  return `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`
}

/**
 * Solar API: edificio più vicino alle coordinate.
 * @see https://developers.google.com/maps/documentation/solar/building-insights
 */
export async function buildingInsights(
  location: Coordinate,
): Promise<EsitoBuildingInsights> {
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

  const url = new URL(
    'https://solar.googleapis.com/v1/buildingInsights:findClosest',
  )
  url.searchParams.set('location.latitude', location.latitude.toFixed(6))
  url.searchParams.set('location.longitude', location.longitude.toFixed(6))
  // Accetta la migliore qualità disponibile sul territorio.
  url.searchParams.set('requiredQuality', 'BASE')
  url.searchParams.set('key', chiave)

  let res: Response
  let json: unknown
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    json = await res.json()
  } catch {
    return {
      ok: false,
      errore: {
        codice: 'rete',
        messaggio: 'Impossibile contattare la Solar API.',
      },
    }
  }

  const parsed = buildingInsightsSchema.safeParse(json)
  if (!parsed.success) {
    return {
      ok: false,
      errore: { codice: 'sconosciuto', messaggio: 'Risposta Solar non valida.' },
    }
  }

  const body = parsed.data
  const erroreApi = body.error
  const messaggioApi = erroreApi?.message
  const statusApi = erroreApi?.status ?? ''

  if (erroreApi || !res.ok) {
    if (res.status === 404 || statusApi === 'NOT_FOUND') {
      return {
        ok: false,
        errore: {
          codice: 'edificio_non_trovato',
          messaggio:
            'Nessun edificio con dati Solar vicino a questo indirizzo (copertura o qualità insufficiente).',
        },
      }
    }
    if (res.status === 429 || statusApi === 'RESOURCE_EXHAUSTED') {
      return {
        ok: false,
        errore: {
          codice: 'quota',
          messaggio: 'Quota Solar esaurita. Riprova più tardi.',
        },
      }
    }
    if (res.status === 403) {
      return {
        ok: false,
        errore: {
          codice: 'quota',
          messaggio:
            messaggioApi ??
            'Solar API non autorizzata: abilita Solar API e controlla la chiave.',
        },
      }
    }
    return {
      ok: false,
      errore: {
        codice: 'sconosciuto',
        messaggio: messaggioApi ?? `Solar API: errore ${res.status}.`,
      },
    }
  }

  const potential = body.solarPotential
  const segmenti = potential?.roofSegmentStats ?? []
  const falde: FaldaTetto[] = segmenti.map((s, indice) => ({
    indice,
    pitchDegrees: s.pitchDegrees ?? 0,
    azimuthDegrees: s.azimuthDegrees ?? 0,
    areaMeters2: s.stats?.areaMeters2 ?? 0,
    groundAreaMeters2: s.stats?.groundAreaMeters2 ?? null,
    center: s.center
      ? { latitude: s.center.latitude, longitude: s.center.longitude }
      : null,
    boundingBox: s.boundingBox
      ? {
          sw: {
            latitude: s.boundingBox.sw.latitude,
            longitude: s.boundingBox.sw.longitude,
          },
          ne: {
            latitude: s.boundingBox.ne.latitude,
            longitude: s.boundingBox.ne.longitude,
          },
        }
      : null,
    sunshineMedio: mediaSunshine(s.stats?.sunshineQuantiles),
    planeHeightAtCenterMeters: s.planeHeightAtCenterMeters ?? null,
  }))

  return {
    ok: true,
    dati: {
      location: body.center ?? location,
      boundingBox: body.boundingBox
        ? {
            sw: {
              latitude: body.boundingBox.sw.latitude,
              longitude: body.boundingBox.sw.longitude,
            },
            ne: {
              latitude: body.boundingBox.ne.latitude,
              longitude: body.boundingBox.ne.longitude,
            },
          }
        : null,
      imageryQuality: body.imageryQuality ?? null,
      imageryDate: body.imageryDate ? formattaDataImmagine(body.imageryDate) : null,
      maxArrayPanelsCount: potential?.maxArrayPanelsCount ?? null,
      maxSunshineHoursPerYear: potential?.maxSunshineHoursPerYear ?? null,
      wholeRoofAreaMeters2: potential?.wholeRoofStats?.areaMeters2 ?? null,
      falde,
    },
  }
}
