'use server'

import { z } from 'zod'
import { guard } from '@/lib/auth/session'
import {
  buildingInsightsNelRaggio,
  geocodeIndirizzo,
  suggerisciIndirizziPlaces,
  type AnalisiTetto,
  type SuggerimentoIndirizzo,
} from '@/lib/solar'
import { caricaGrigliaDsm, raggioMetriDaBbox } from '@/lib/solar/data-layers'
import { chiaveCacheDsm, getDsmCached, setDsmCached } from '@/lib/solar/dsm-cache'
import type { GrigliaDsm } from '@/lib/solar/griglia-dsm'
import type { ActionResult } from './opportunities'

const schema = z.object({
  indirizzo: z.string().trim().min(5, 'Inserisci un indirizzo più completo.').max(300),
})

const schemaPunto = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Etichetta da mantenere in UI (indirizzo precedente). */
  formattedAddress: z.string().trim().min(1).max(400).optional(),
})

const schemaDsm = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  boundingBox: z
    .object({
      sw: z.object({ latitude: z.number(), longitude: z.number() }),
      ne: z.object({ latitude: z.number(), longitude: z.number() }),
    })
    .nullable()
    .optional(),
})

const schemaSuggerimenti = z.object({
  input: z.string().trim().min(1).max(200),
})

/**
 * Autocomplete indirizzo (Places API New), solo Italia.
 */
export async function suggerisciIndirizzi(
  input: z.input<typeof schemaSuggerimenti>,
): Promise<ActionResult<{ suggerimenti: readonly SuggerimentoIndirizzo[] }>> {
  await guard('read', 'sviluppo')

  const parsed = schemaSuggerimenti.safeParse(input)
  if (!parsed.success) {
    return { ok: false, errors: { _: 'Testo di ricerca non valido.' } }
  }

  const esito = await suggerisciIndirizziPlaces(parsed.data.input)
  if (!esito.ok) {
    return { ok: false, errors: { _: esito.messaggio } }
  }
  return { ok: true, data: { suggerimenti: esito.suggerimenti } }
}

/**
 * Laboratorio Sviluppo: geocode + Solar buildingInsights (raggio ~200 m).
 * Non persiste nulla sul CRM (step 1).
 */
export async function analizzaTetto(
  input: z.input<typeof schema>,
): Promise<ActionResult<AnalisiTetto>> {
  await guard('update', 'sviluppo')

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: { indirizzo: parsed.error.issues[0]?.message ?? 'Indirizzo non valido.' },
    }
  }

  const geo = await geocodeIndirizzo(parsed.data.indirizzo)
  if (!geo.ok) {
    return { ok: false, errors: { _: geo.errore.messaggio } }
  }

  const solar = await buildingInsightsNelRaggio(geo.location)
  if (!solar.ok) {
    return { ok: false, errors: { _: solar.errore.messaggio } }
  }

  return {
    ok: true,
    data: {
      formattedAddress: geo.formatted,
      ...solar.dati,
    },
  }
}

/**
 * Riesegue Solar su un punto scelto in mappa (cambio tetto).
 */
export async function analizzaTettoAlPunto(
  input: z.input<typeof schemaPunto>,
): Promise<ActionResult<AnalisiTetto>> {
  await guard('update', 'sviluppo')

  const parsed = schemaPunto.safeParse(input)
  if (!parsed.success) {
    return { ok: false, errors: { _: 'Coordinate non valide.' } }
  }

  const location = {
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
  }
  const solar = await buildingInsightsNelRaggio(location)
  if (!solar.ok) {
    return { ok: false, errors: { _: solar.errore.messaggio } }
  }

  const etichetta =
    parsed.data.formattedAddress?.trim() ||
    `Punto ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`

  return {
    ok: true,
    data: {
      formattedAddress: etichetta,
      ...solar.dati,
    },
  }
}

/**
 * Chiave Maps per il browser (solo utenti autorizzati a Sviluppo).
 * Serve Maps JavaScript API sulla stessa key. Non loggare il valore.
 */
export async function chiaveMapsPerMappa(): Promise<ActionResult<{ apiKey: string }>> {
  await guard('read', 'sviluppo')
  const { env } = await import('@/env')
  const apiKey = env().GOOGLE_MAPS_API_KEY?.trim()
  if (!apiKey) {
    return {
      ok: false,
      errors: { _: 'Analisi tetto non configurata su questo ambiente.' },
    }
  }
  return { ok: true, data: { apiKey } }
}

/**
 * Scarica DSM (+ mask) Solar per l’edificio. Griglia downsampled, cache process-local.
 * Billable: evitare refetch inutili lato client.
 */
export async function caricaDsmEdificio(
  input: z.input<typeof schemaDsm>,
): Promise<ActionResult<GrigliaDsm>> {
  await guard('read', 'sviluppo')

  const parsed = schemaDsm.safeParse(input)
  if (!parsed.success) {
    return { ok: false, errors: { _: 'Coordinate non valide per le quote.' } }
  }

  const location = {
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
  }
  const boundingBox = parsed.data.boundingBox ?? null
  const radius = raggioMetriDaBbox(location, boundingBox)
  const chiave = chiaveCacheDsm(location.latitude, location.longitude, radius)
  const cached = getDsmCached(chiave)
  if (cached) {
    return { ok: true, data: cached }
  }

  const esito = await caricaGrigliaDsm({ location, boundingBox, radiusMeters: radius })
  if (!esito.ok) {
    return { ok: false, errors: { _: esito.errore.messaggio } }
  }

  setDsmCached(chiave, esito.griglia)
  return { ok: true, data: esito.griglia }
}
