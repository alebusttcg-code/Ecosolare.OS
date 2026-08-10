import type { GrigliaDsm } from './griglia-dsm'

/** Cache in-memory per processo (evita refetch Data Layers nella stessa sessione server). */
const cache = new Map<string, { griglia: GrigliaDsm; expiresAt: number }>()

const TTL_MS = 30 * 60 * 1000

export function chiaveCacheDsm(lat: number, lng: number, radius: number): string {
  return `${lat.toFixed(5)}:${lng.toFixed(5)}:r${Math.round(radius)}`
}

export function getDsmCached(chiave: string): GrigliaDsm | null {
  const hit = cache.get(chiave)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    cache.delete(chiave)
    return null
  }
  return hit.griglia
}

export function setDsmCached(chiave: string, griglia: GrigliaDsm): void {
  cache.set(chiave, { griglia, expiresAt: Date.now() + TTL_MS })
}
