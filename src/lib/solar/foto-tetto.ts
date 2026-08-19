import { fromArrayBuffer } from 'geotiff'
import geokeysToProj4 from 'geotiff-geokeys-to-proj4'
import proj4 from 'proj4'
import { pixelAGeo } from './layout-moduli'
import { codificaPngRgb } from './png'
import type { Coordinate } from './tipi'

/**
 * Foto aerea del tetto da Google Solar, come sfondo dell'anteprima moduli.
 *
 * Perché esiste: dal 2025 Google ha tolto il satellite dalla Static Maps API in
 * UE (403). Il satellite però resta disponibile via la Solar API, che restituisce
 * una foto aerea RGB dell'edificio — ma come **GeoTIFF** georeferenziato, non come
 * immagine pronta. Qui la si scarica, la si **ricampiona nella cornice esatta**
 * che l'editor si aspetta (stesso centro, zoom, dimensioni: la stessa proiezione
 * `pixelAGeo`), e la si ri-codifica in PNG. Ricampionando nel frame dell'editor,
 * l'allineamento con i moduli è garantito per costruzione, non per fortuna.
 */

async function scaricaGeoTiff(url: string, apiKey: string): Promise<ArrayBuffer> {
  const conKey = url.includes('solar.googleapis.com')
    ? `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`
    : url
  const res = await fetch(conKey, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`GeoTIFF HTTP ${res.status}`)
  return res.arrayBuffer()
}

interface RgbRaster {
  readonly width: number
  readonly height: number
  readonly r: ArrayLike<number>
  readonly g: ArrayLike<number>
  readonly b: ArrayLike<number>
  /** Estensione in WGS84 (approssimazione valida sulla piccola area di un tetto). */
  readonly bounds: { south: number; north: number; west: number; east: number }
}

async function parseRgb(buffer: ArrayBuffer): Promise<RgbRaster> {
  const tiff = await fromArrayBuffer(buffer)
  const image = await tiff.getImage()
  const width = image.getWidth()
  const height = image.getHeight()
  const rasters = await image.readRasters()
  const r = rasters[0] as ArrayLike<number> | undefined
  if (!r) throw new Error('GeoTIFF RGB senza bande')
  const g = (rasters[1] as ArrayLike<number> | undefined) ?? r
  const b = (rasters[2] as ArrayLike<number> | undefined) ?? r

  const projObj = geokeysToProj4.toProj4(image.getGeoKeys())
  const projezione = proj4(projObj.proj4, 'WGS84')
  const box = image.getBoundingBox()
  const sx = projObj.coordinatesConversionParameters.x
  const sy = projObj.coordinatesConversionParameters.y
  const sw = projezione.forward({ x: box[0]! * sx, y: box[1]! * sy })
  const ne = projezione.forward({ x: box[2]! * sx, y: box[3]! * sy })

  return {
    width,
    height,
    r,
    g,
    b,
    bounds: {
      south: Math.min(sw.y, ne.y),
      north: Math.max(sw.y, ne.y),
      west: Math.min(sw.x, ne.x),
      east: Math.max(sw.x, ne.x),
    },
  }
}

function ottetto(v: number): number {
  if (!Number.isFinite(v)) return 0
  return v < 0 ? 0 : v > 255 ? 255 : v | 0
}

export interface FotoTettoRichiesta {
  readonly centro: Coordinate
  readonly zoom: number
  readonly scale: number
  /** Dimensione CSS del frame (verrà moltiplicata per `scale`). */
  readonly widthBase: number
  readonly heightBase: number
  readonly apiKey: string
}

/**
 * Restituisce il PNG della foto aerea inquadrata come l'editor, o `null` se la
 * Solar non ha imagery per la zona (il chiamante degrada con grazia).
 */
export async function fotoTettoPng(req: FotoTettoRichiesta): Promise<Buffer | null> {
  const W = req.widthBase * req.scale
  const H = req.heightBase * req.scale

  // Proiezione target→geo: `pixelAGeo` è lineare in (x,y), quindi bastano tre
  // angoli per ricostruirla per interpolazione — stessa identica mappa usata
  // dall'editor/PDF, ma senza chiamarla un milione di volte.
  const g00 = pixelAGeo(0, 0, req.centro, req.zoom, req.scale, W, H)
  const gX = pixelAGeo(W - 1, 0, req.centro, req.zoom, req.scale, W, H)
  const gY = pixelAGeo(0, H - 1, req.centro, req.zoom, req.scale, W, H)

  // Raggio dataLayers: quanto basta a coprire la cornice (il PDF può inquadrare
  // più largo dell'editor). Mezza diagonale del frame, con margine.
  const R = 6_378_137
  const distanzaM = (c: Coordinate) => {
    const dLat = ((c.latitude - req.centro.latitude) * Math.PI) / 180
    const dLng =
      ((c.longitude - req.centro.longitude) * Math.PI) / 180 *
      Math.cos((req.centro.latitude * Math.PI) / 180)
    return Math.hypot(dLat, dLng) * R
  }
  const raggio = Math.min(
    175,
    Math.max(50, Math.ceil(Math.max(distanzaM(g00), distanzaM(gX), distanzaM(gY))) + 15),
  )

  const url = new URL('https://solar.googleapis.com/v1/dataLayers:get')
  url.searchParams.set('location.latitude', req.centro.latitude.toFixed(6))
  url.searchParams.set('location.longitude', req.centro.longitude.toFixed(6))
  url.searchParams.set('radiusMeters', String(raggio))
  url.searchParams.set('view', 'IMAGERY_LAYERS')
  url.searchParams.set('requiredQuality', 'LOW')
  url.searchParams.set('pixelSizeMeters', '0.1')
  url.searchParams.set('key', req.apiKey)

  let rgbUrl: string | undefined
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(45_000) })
    const meta = (await res.json()) as { rgbUrl?: string; error?: unknown }
    if (!res.ok || !meta.rgbUrl) return null
    rgbUrl = meta.rgbUrl
  } catch {
    return null
  }

  let rgb: RgbRaster
  try {
    rgb = await parseRgb(await scaricaGeoTiff(rgbUrl, req.apiKey))
  } catch {
    return null
  }

  const dLngX = (gX.longitude - g00.longitude) / (W - 1)
  const dLatX = (gX.latitude - g00.latitude) / (W - 1)
  const dLngY = (gY.longitude - g00.longitude) / (H - 1)
  const dLatY = (gY.latitude - g00.latitude) / (H - 1)

  const spanLng = rgb.bounds.east - rgb.bounds.west
  const spanLat = rgb.bounds.north - rgb.bounds.south
  const out = new Uint8Array(W * H * 3)

  for (let ty = 0; ty < H; ty += 1) {
    const lngRiga = g00.longitude + dLngY * ty
    const latRiga = g00.latitude + dLatY * ty
    for (let tx = 0; tx < W; tx += 1) {
      const lng = lngRiga + dLngX * tx
      const lat = latRiga + dLatX * tx
      const fx = (lng - rgb.bounds.west) / spanLng
      const fy = (rgb.bounds.north - lat) / spanLat
      const o = (ty * W + tx) * 3
      if (fx < 0 || fx > 1 || fy < 0 || fy > 1) {
        // Fuori dalla foto: neutro scuro (bordo dell'inquadratura).
        out[o] = 10
        out[o + 1] = 21
        out[o + 2] = 40
        continue
      }
      const col = Math.min(rgb.width - 1, Math.round(fx * (rgb.width - 1)))
      const row = Math.min(rgb.height - 1, Math.round(fy * (rgb.height - 1)))
      const idx = row * rgb.width + col
      out[o] = ottetto(rgb.r[idx]!)
      out[o + 1] = ottetto(rgb.g[idx]!)
      out[o + 2] = ottetto(rgb.b[idx]!)
    }
  }

  return codificaPngRgb(W, H, out)
}
