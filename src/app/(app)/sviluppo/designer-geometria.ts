import { centroide, zoomPerContenere, type Coordinate } from '@/lib/solar'

/** Funzioni pure di geometria del designer moduli, isolate per essere testabili
 * a parte dal componente (che resta grosso di suo con canvas e interazione). */

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/**
 * Limita il pan della vista così l'immagine non si può staccare dal frame più di
 * uno sfrido (48px), qualunque sia lo zoom.
 */
export function clampPan(
  w: number,
  h: number,
  dw: number,
  dh: number,
  pan: { x: number; y: number },
): { x: number; y: number } {
  const maxX = Math.max(0, (dw - w) / 2 + 48)
  const maxY = Math.max(0, (dh - h) / 2 + 48)
  return {
    x: clamp(pan.x, -maxX, maxX),
    y: clamp(pan.y, -maxY, maxY),
  }
}

/**
 * Frame della foto per una falda: centro = centroide del poligono, zoom un
 * livello più largo del fit esatto, così attorno resta contesto (tetto intero,
 * vicini) e c'è margine per rifinire i vertici dentro. Va calcolato una volta e
 * congelato per falda (vedi `editor-moduli.tsx`): se seguisse il poligono vivo,
 * la foto si ricaricherebbe a ogni vertice mosso.
 */
export function calcolaFrameFoto(
  poligono: readonly Coordinate[] | null,
  larghezzaPx: number,
  altezzaPx: number,
  scale: number,
  zoomMin = 17,
): { centro: Coordinate; zoom: number } | null {
  if (!poligono || poligono.length < 3) return null
  const centro = centroide(poligono)
  const zoom = Math.max(
    zoomMin,
    zoomPerContenere(poligono, centro, larghezzaPx, altezzaPx, scale) - 1,
  )
  return { centro, zoom }
}
