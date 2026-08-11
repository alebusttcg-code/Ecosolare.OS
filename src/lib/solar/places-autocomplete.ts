import { z } from 'zod'
import { env } from '@/env'

export interface SuggerimentoIndirizzo {
  readonly placeId: string
  readonly testo: string
  readonly principale: string
  readonly secondario: string
}

const suggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string().optional(),
            text: z.object({ text: z.string().optional() }).optional(),
            structuredFormat: z
              .object({
                mainText: z.object({ text: z.string().optional() }).optional(),
                secondaryText: z
                  .object({ text: z.string().optional() })
                  .optional(),
              })
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  error: z
    .object({
      code: z.number().optional(),
      message: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
})

/**
 * Places API (New) Autocomplete — solo IT, testo libero.
 * @see https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
 */
export async function suggerisciIndirizziPlaces(
  input: string,
): Promise<
  | { readonly ok: true; readonly suggerimenti: readonly SuggerimentoIndirizzo[] }
  | { readonly ok: false; readonly messaggio: string }
> {
  const chiave = env().GOOGLE_MAPS_API_KEY?.trim()
  if (!chiave) {
    return { ok: false, messaggio: 'Suggerimenti indirizzo non disponibili.' }
  }

  const testo = input.trim()
  if (testo.length < 3) {
    return { ok: true, suggerimenti: [] }
  }

  let res: Response
  let json: unknown
  try {
    res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': chiave,
      },
      body: JSON.stringify({
        input: testo,
        languageCode: 'it',
        regionCode: 'IT',
        includedRegionCodes: ['IT'],
      }),
      signal: AbortSignal.timeout(12_000),
    })
    json = await res.json()
  } catch {
    return { ok: false, messaggio: 'Impossibile contattare i suggerimenti indirizzo.' }
  }

  const parsed = suggestionSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false, messaggio: 'Risposta suggerimenti non valida.' }
  }

  if (parsed.data.error || !res.ok) {
    const status = parsed.data.error?.status ?? ''
    if (res.status === 403 || status === 'PERMISSION_DENIED') {
      return {
        ok: false,
        messaggio:
          'Suggerimenti indirizzo non autorizzati su questo ambiente.',
      }
    }
    return {
      ok: false,
      messaggio: 'Suggerimenti indirizzo non disponibili. Riprova più tardi.',
    }
  }

  const suggerimenti: SuggerimentoIndirizzo[] = []
  for (const s of parsed.data.suggestions ?? []) {
    const pred = s.placePrediction
    if (!pred?.placeId) continue
    const testoCompleto = pred.text?.text?.trim()
    const principale =
      pred.structuredFormat?.mainText?.text?.trim() || testoCompleto || ''
    const secondario =
      pred.structuredFormat?.secondaryText?.text?.trim() || ''
    if (!testoCompleto && !principale) continue
    suggerimenti.push({
      placeId: pred.placeId,
      testo: testoCompleto || [principale, secondario].filter(Boolean).join(', '),
      principale,
      secondario,
    })
  }

  return { ok: true, suggerimenti }
}
