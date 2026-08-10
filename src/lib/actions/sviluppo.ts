'use server'

import { z } from 'zod'
import { guard } from '@/lib/auth/session'
import { buildingInsights, geocodeIndirizzo, type AnalisiTetto } from '@/lib/solar'
import { caricaGrigliaDsm, raggioMetriDaBbox } from '@/lib/solar/data-layers'
import { chiaveCacheDsm, getDsmCached, setDsmCached } from '@/lib/solar/dsm-cache'
import type { GrigliaDsm } from '@/lib/solar/griglia-dsm'
import type { ActionResult } from './opportunities'

const schema = z.object({
  indirizzo: z.string().trim().min(5, 'Inserisci un indirizzo più completo.').max(300),
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

/**
 * Laboratorio Sviluppo: geocode + Solar buildingInsights.
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

  const solar = await buildingInsights(geo.location)
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
      errors: { _: 'Solar non configurato: manca GOOGLE_MAPS_API_KEY.' },
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
    return { ok: false, errors: { _: 'Coordinate non valide per il DSM.' } }
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
