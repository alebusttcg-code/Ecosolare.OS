import { NextResponse } from 'next/server'
import { z } from 'zod'
import { env } from '@/env'
import { AuthorizationError } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'

/**
 * Proxy Static Maps (satellite): la key resta sul server.
 * Richiede Maps Static API abilitata sulla stessa GOOGLE_MAPS_API_KEY.
 */
const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  zoom: z.coerce.number().int().min(15).max(21).optional().default(19),
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
  })
  if (!parsed.success) {
    return NextResponse.json({ errore: 'Coordinate non valide' }, { status: 400 })
  }

  const { lat, lng, zoom } = parsed.data
  const staticUrl = new URL('https://maps.googleapis.com/maps/api/staticmap')
  staticUrl.searchParams.set('center', `${lat},${lng}`)
  staticUrl.searchParams.set('zoom', String(zoom))
  staticUrl.searchParams.set('size', '640x420')
  staticUrl.searchParams.set('scale', '2')
  staticUrl.searchParams.set('maptype', 'satellite')
  staticUrl.searchParams.set('markers', `color:0xd9a441|${lat},${lng}`)
  staticUrl.searchParams.set('key', chiave)

  try {
    const res = await fetch(staticUrl, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) {
      return NextResponse.json(
        { errore: `Static Maps non disponibile (${res.status})` },
        { status: 502 },
      )
    }
    const bytes = await res.arrayBuffer()
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('Content-Type') ?? 'image/png',
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch {
    return NextResponse.json({ errore: 'Impossibile scaricare la mappa' }, { status: 502 })
  }
}
