import { fromArrayBuffer } from 'geotiff'
import geokeysToProj4 from 'geotiff-geokeys-to-proj4'
import proj4 from 'proj4'
import { env } from '@/env'
import {
  downsampleGriglia,
  DSM_INVALIDO,
  type BoundsGeo,
  type GrigliaDsm,
} from './griglia-dsm'
import type { Coordinate, ErroreSolar, QualitaImmagini } from './tipi'

const MAX_DIM_CLIENT = 120

export type EsitoDataLayers =
  | { readonly ok: true; readonly griglia: GrigliaDsm }
  | { readonly ok: false; readonly errore: ErroreSolar }

function chiaveApi(): string | null {
  return env().GOOGLE_MAPS_API_KEY?.trim() || null
}

function raggioMetriDaBbox(
  location: Coordinate,
  boundingBox: {
    sw: Coordinate
    ne: Coordinate
  } | null,
): number {
  if (!boundingBox) return 80
  const dLat =
    (boundingBox.ne.latitude - boundingBox.sw.latitude) * 111_320
  const midLat =
    ((boundingBox.ne.latitude + boundingBox.sw.latitude) / 2) * (Math.PI / 180)
  const dLng =
    (boundingBox.ne.longitude - boundingBox.sw.longitude) *
    111_320 *
    Math.cos(midLat)
  const semi = Math.sqrt(dLat * dLat + dLng * dLng) / 2 + 25
  return Math.min(150, Math.max(50, Math.ceil(semi)))
}

async function scaricaGeoTiff(
  url: string,
  apiKey: string,
): Promise<ArrayBuffer> {
  const solarUrl = url.includes('solar.googleapis.com')
    ? `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`
    : url
  const res = await fetch(solarUrl, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) {
    throw new Error(`GeoTIFF HTTP ${res.status}`)
  }
  return res.arrayBuffer()
}

/**
 * Parsing allineato alla doc Solar (geotiff + geokeys → WGS84).
 * @see https://developers.google.com/maps/documentation/solar/data-layers
 */
async function parseGeoTiffRaster(
  buffer: ArrayBuffer,
): Promise<{
  width: number
  height: number
  values: number[]
  bounds: BoundsGeo
}> {
  const tiff = await fromArrayBuffer(buffer)
  const image = await tiff.getImage()
  const width = image.getWidth()
  const height = image.getHeight()
  const rasters = await image.readRasters()
  const band = rasters[0]
  if (!band) throw new Error('GeoTIFF senza bande')

  const values = Array.from(band as ArrayLike<number>, (v) =>
    typeof v === 'number' && Number.isFinite(v) ? v : DSM_INVALIDO,
  )

  const geoKeys = image.getGeoKeys()
  const projObj = geokeysToProj4.toProj4(geoKeys)
  const projection = proj4(projObj.proj4, 'WGS84')
  const box = image.getBoundingBox()
  const scaleX = projObj.coordinatesConversionParameters.x
  const scaleY = projObj.coordinatesConversionParameters.y
  const sw = projection.forward({ x: box[0]! * scaleX, y: box[1]! * scaleY })
  const ne = projection.forward({ x: box[2]! * scaleX, y: box[3]! * scaleY })

  return {
    width,
    height,
    values,
    bounds: {
      south: Math.min(sw.y, ne.y),
      north: Math.max(sw.y, ne.y),
      west: Math.min(sw.x, ne.x),
      east: Math.max(sw.x, ne.x),
    },
  }
}

/**
 * Solar dataLayers: DSM (+ mask se disponibile). Solo server-side.
 */
export async function caricaGrigliaDsm(opzioni: {
  location: Coordinate
  boundingBox?: { sw: Coordinate; ne: Coordinate } | null
  radiusMeters?: number
}): Promise<EsitoDataLayers> {
  const apiKey = chiaveApi()
  if (!apiKey) {
    return {
      ok: false,
      errore: {
        codice: 'non_configurato',
        messaggio:
          'Analisi tetto non configurata su questo ambiente.',
      },
    }
  }

  const radius =
    opzioni.radiusMeters ??
    raggioMetriDaBbox(opzioni.location, opzioni.boundingBox ?? null)

  const url = new URL('https://solar.googleapis.com/v1/dataLayers:get')
  url.searchParams.set('location.latitude', opzioni.location.latitude.toFixed(6))
  url.searchParams.set(
    'location.longitude',
    opzioni.location.longitude.toFixed(6),
  )
  url.searchParams.set('radiusMeters', String(radius))
  // DSM + RGB + mask; scarichiamo solo DSM e mask.
  url.searchParams.set('view', 'IMAGERY_LAYERS')
  url.searchParams.set('requiredQuality', 'BASE')
  url.searchParams.set('pixelSizeMeters', '0.5')
  url.searchParams.set('key', apiKey)

  let meta: {
    dsmUrl?: string
    maskUrl?: string
    imageryQuality?: QualitaImmagini
    error?: { message?: string; status?: string; code?: number }
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(45_000) })
    meta = (await res.json()) as typeof meta
    if (!res.ok || meta.error || !meta.dsmUrl) {
      const status = meta.error?.status ?? ''
      if (res.status === 404 || status === 'NOT_FOUND') {
        return {
          ok: false,
          errore: {
            codice: 'edificio_non_trovato',
            messaggio:
              'Quote del tetto non disponibili per questa zona.',
          },
        }
      }
      if (res.status === 429 || status === 'RESOURCE_EXHAUSTED') {
        return {
          ok: false,
          errore: {
            codice: 'quota',
            messaggio: 'Servizio temporaneamente saturo. Riprova più tardi.',
          },
        }
      }
      return {
        ok: false,
        errore: {
          codice: 'sconosciuto',
          messaggio: `Quote del tetto non disponibili (errore ${res.status}).`,
        },
      }
    }
  } catch {
    return {
      ok: false,
      errore: {
        codice: 'rete',
        messaggio: 'Impossibile scaricare le quote del tetto.',
      },
    }
  }

  try {
    const dsmBuf = await scaricaGeoTiff(meta.dsmUrl, apiKey)
    const dsm = await parseGeoTiffRaster(dsmBuf)

    let maskValues: number[] | null = null
    if (meta.maskUrl) {
      try {
        const maskBuf = await scaricaGeoTiff(meta.maskUrl, apiKey)
        const mask = await parseGeoTiffRaster(maskBuf)
        if (mask.width === dsm.width && mask.height === dsm.height) {
          maskValues = mask.values.map((v) => (v > 0 ? 1 : 0))
        }
      } catch {
        // Mask opzionale: proseguiamo col solo DSM.
      }
    }

    const grezza: GrigliaDsm = {
      width: dsm.width,
      height: dsm.height,
      quote: dsm.values,
      bounds: dsm.bounds,
      imageryQuality: meta.imageryQuality ?? null,
      mask: maskValues,
    }

    return { ok: true, griglia: downsampleGriglia(grezza, MAX_DIM_CLIENT) }
  } catch {
    return {
      ok: false,
      errore: {
        codice: 'sconosciuto',
        messaggio: 'Impossibile leggere le quote del tetto.',
      },
    }
  }
}

export { raggioMetriDaBbox }
