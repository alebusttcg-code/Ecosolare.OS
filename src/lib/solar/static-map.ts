import type { Coordinate } from './tipi'

export type StaticMapRichiesta = {
  readonly centro: Coordinate
  readonly zoom: number
  /** Dimensione CSS richiesta a Google (prima di `scale`). */
  readonly width: number
  readonly height: number
  readonly scale?: number
  readonly maptype?: 'satellite' | 'hybrid' | 'roadmap' | 'terrain'
  /** Se true, marker oro sul centro. */
  readonly marker?: boolean
  readonly apiKey: string
  readonly timeoutMs?: number
}

export type StaticMapRisposta = {
  readonly bytes: Buffer
  readonly contentType: string
  /** Dimensioni effettive dell’immagine (width×scale, height×scale). */
  readonly pixelW: number
  readonly pixelH: number
  readonly zoom: number
  readonly centro: Coordinate
  readonly scale: number
}

/**
 * Scarica una Static Map Google (satellite di default).
 * La API key resta solo sul server; nessun retry aggressivo (billable).
 */
export async function scaricaStaticMap(
  req: StaticMapRichiesta,
): Promise<StaticMapRisposta | null> {
  const scale = req.scale ?? 2
  const maptype = req.maptype ?? 'satellite'
  const timeoutMs = req.timeoutMs ?? 15_000

  if (
    !req.apiKey ||
    !Number.isFinite(req.centro.latitude) ||
    !Number.isFinite(req.centro.longitude) ||
    req.width < 1 ||
    req.height < 1
  ) {
    return null
  }

  const staticUrl = new URL('https://maps.googleapis.com/maps/api/staticmap')
  staticUrl.searchParams.set(
    'center',
    `${req.centro.latitude},${req.centro.longitude}`,
  )
  staticUrl.searchParams.set('zoom', String(req.zoom))
  staticUrl.searchParams.set('size', `${req.width}x${req.height}`)
  staticUrl.searchParams.set('scale', String(scale))
  staticUrl.searchParams.set('maptype', maptype)
  if (req.marker) {
    staticUrl.searchParams.set(
      'markers',
      `color:0xd9a441|${req.centro.latitude},${req.centro.longitude}`,
    )
  }
  staticUrl.searchParams.set('key', req.apiKey)

  try {
    const res = await fetch(staticUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      // Il motivo vero (es. 403 «satellite non disponibile in UE») altrimenti
      // sparisce: senza questo log si vede solo il canvas nero senza spiegazione.
      const dettaglio = await res.text().catch(() => '')
      console.warn(
        `[static-map] Google ${res.status}: ${dettaglio.slice(0, 200)}`,
      )
      return null
    }
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length < 32) return null
    return {
      bytes,
      contentType: res.headers.get('Content-Type') ?? 'image/png',
      pixelW: req.width * scale,
      pixelH: req.height * scale,
      zoom: req.zoom,
      centro: req.centro,
      scale,
    }
  } catch {
    return null
  }
}
