import { NextResponse } from 'next/server'
import { z } from 'zod'
import { env } from '@/env'
import { AuthorizationError } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import { fotoTettoPng } from '@/lib/solar/foto-tetto'

/**
 * Sfondo dell'anteprima moduli: foto aerea del tetto da Google Solar.
 *
 * Prima usava la Static Maps satellite, ma dal 2025 Google la blocca in UE
 * (403). La Solar API dà la stessa foto aerea (via GeoTIFF RGB): la
 * ricampioniamo qui nella cornice dell'editor e la serviamo come PNG. La key
 * resta sul server. Se la Solar non ha imagery per la zona si risponde 502 e
 * l'editor disegna comunque falda e moduli su sfondo neutro.
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

  const { lat, lng, zoom } = parsed.data
  const png = await fotoTettoPng({
    centro: { latitude: lat, longitude: lng },
    zoom,
    scale: 2,
    widthBase: 640,
    heightBase: 420,
    apiKey: chiave,
  })

  if (!png) {
    return NextResponse.json(
      { errore: 'Foto aerea non disponibile per questa zona' },
      { status: 502 },
    )
  }

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // La foto di un tetto non cambia: cache lunga lato client.
      'Cache-Control': 'private, max-age=86400',
    },
  })
}
