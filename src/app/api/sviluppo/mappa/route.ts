import { NextResponse } from 'next/server'
import { z } from 'zod'
import { env } from '@/env'
import { AuthorizationError } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import { scaricaStaticMap } from '@/lib/solar/static-map'

/**
 * Proxy Static Maps (satellite): la key resta sul server.
 * Richiede Maps Static API abilitata sulla stessa GOOGLE_MAPS_API_KEY.
 */
const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  zoom: z.coerce.number().int().min(15).max(21).optional().default(19),
  marker: z
    .enum(['0', '1'])
    .optional()
    .default('1'),
})

export async function GET(request: Request) {
  try {
    await guard('read', 'sviluppo')
  } catch (errore) {
    if (errore instanceof AuthorizationError) {
      return NextResponse.json({ errore: 'Accesso non consentito' }, { status: 403 })
    }
    throw errore
  }

  const chiave = env().GOOGLE_MAPS_API_KEY?.trim()
  if (!chiave) {
    return NextResponse.json({ errore: 'Maps non configurato' }, { status: 503 })
  }

  const urlReq = new URL(request.url)
  const parsed = querySchema.safeParse({
    lat: urlReq.searchParams.get('lat'),
    lng: urlReq.searchParams.get('lng'),
    zoom: urlReq.searchParams.get('zoom') ?? undefined,
    marker: urlReq.searchParams.get('marker') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ errore: 'Coordinate non valide' }, { status: 400 })
  }

  const { lat, lng, zoom, marker } = parsed.data
  const mappa = await scaricaStaticMap({
    centro: { latitude: lat, longitude: lng },
    zoom,
    width: 640,
    height: 420,
    scale: 2,
    maptype: 'satellite',
    marker: marker === '1',
    apiKey: chiave,
  })

  if (!mappa) {
    return NextResponse.json(
      { errore: 'Static Maps non disponibile' },
      { status: 502 },
    )
  }

  return new NextResponse(new Uint8Array(mappa.bytes), {
    status: 200,
    headers: {
      'Content-Type': mappa.contentType,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
