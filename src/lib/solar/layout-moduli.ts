import type { Coordinate } from './tipi'
import type { FormatoModuloFv } from './moduli-fv'

export interface RettangoloModulo {
  /** Quattro angoli WGS84 in senso orario. */
  readonly angoli: readonly [Coordinate, Coordinate, Coordinate, Coordinate]
  readonly centro: Coordinate
  /**
   * Rotazione aggiuntiva rispetto all’allineamento falda (gradi orari).
   * 0 = landscape/portrait rispetto all’azimuth Solar.
   */
  readonly rotazioneDegrees: number
}

export interface LayoutModuli {
  readonly moduli: readonly RettangoloModulo[]
  readonly richiesti: number
  readonly collocati: number
  readonly kWp: number
  readonly areaModuliM2: number
}

function centroide(vertici: readonly Coordinate[]): Coordinate {
  const n = vertici.length || 1
  return {
    latitude: vertici.reduce((s, v) => s + v.latitude, 0) / n,
    longitude: vertici.reduce((s, v) => s + v.longitude, 0) / n,
  }
}

function aMetriLocali(
  c: Coordinate,
  origine: Coordinate,
): { e: number; n: number } {
  const mPerDegLat = (Math.PI / 180) * 6_371_000
  const mPerDegLng =
    mPerDegLat * Math.cos((origine.latitude * Math.PI) / 180)
  return {
    e: (c.longitude - origine.longitude) * mPerDegLng,
    n: (c.latitude - origine.latitude) * mPerDegLat,
  }
}

function daMetriLocali(
  e: number,
  n: number,
  origine: Coordinate,
): Coordinate {
  const mPerDegLat = (Math.PI / 180) * 6_371_000
  const mPerDegLng =
    mPerDegLat * Math.cos((origine.latitude * Math.PI) / 180)
  return {
    latitude: origine.latitude + n / mPerDegLat,
    longitude: origine.longitude + e / mPerDegLng,
  }
}

function puntoInPoligonoUV(
  u: number,
  v: number,
  poli: readonly { u: number; v: number }[],
): boolean {
  let inside = false
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const xi = poli[i]!.u
    const yi = poli[i]!.v
    const xj = poli[j]!.u
    const yj = poli[j]!.v
    const intersect =
      yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi + 1e-15) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function rettangoloInPoligonoUV(
  cu: number,
  cv: number,
  w: number,
  h: number,
  poli: readonly { u: number; v: number }[],
): boolean {
  const hw = w / 2
  const hh = h / 2
  const corners = [
    { u: cu - hw, v: cv - hh },
    { u: cu + hw, v: cv - hh },
    { u: cu + hw, v: cv + hh },
    { u: cu - hw, v: cv + hh },
  ]
  return corners.every((c) => puntoInPoligonoUV(c.u, c.v, poli))
}

/**
 * Dispone fino a `quantita` moduli nella falda, allineati all’azimuth
 * (lato lungo lungo la gronda ≈ azimuth+90° se landscape).
 */
export function layoutModuliInFalda(opzioni: {
  poligono: readonly Coordinate[]
  formato: FormatoModuloFv
  quantita: number
  /** Azimuth falda (0 = Nord). */
  azimuthDegrees: number
  /** true = lato lungo lungo la gronda (tipico). */
  landscape?: boolean
  gapM?: number
}): LayoutModuli {
  const {
    poligono,
    formato,
    quantita,
    azimuthDegrees,
    landscape = true,
    gapM = 0.03,
  } = opzioni

  const richiesti = Math.max(0, Math.min(500, Math.floor(quantita)))
  if (poligono.length < 3 || richiesti === 0) {
    return {
      moduli: [],
      richiesti,
      collocati: 0,
      kWp: 0,
      areaModuliM2: 0,
    }
  }

  const origine = centroide(poligono)
  // u = lungo gronda (azimuth+90), v = salita falda (azimuth)
  const θ = ((azimuthDegrees + 90) * Math.PI) / 180
  const cosA = Math.cos(θ)
  const sinA = Math.sin(θ)

  const en = poligono.map((p) => aMetriLocali(p, origine))
  const poliUV = en.map(({ e, n }) => ({
    u: e * cosA + n * sinA,
    v: -e * sinA + n * cosA,
  }))

  const minU = Math.min(...poliUV.map((p) => p.u))
  const maxU = Math.max(...poliUV.map((p) => p.u))
  const minV = Math.min(...poliUV.map((p) => p.v))
  const maxV = Math.max(...poliUV.map((p) => p.v))

  const w = landscape ? formato.lunghezzaM : formato.larghezzaM
  const h = landscape ? formato.larghezzaM : formato.lunghezzaM
  const stepU = w + gapM
  const stepV = h + gapM

  const costruisci = (u: number, v: number): RettangoloModulo => {
    const hw = w / 2
    const hh = h / 2
    const cornersUV = [
      { u: u - hw, v: v - hh },
      { u: u + hw, v: v - hh },
      { u: u + hw, v: v + hh },
      { u: u - hw, v: v + hh },
    ]
    const angoli = cornersUV.map((c) => {
      // Inverso: e/n da u/v
      const e = c.u * cosA - c.v * sinA
      const n = c.u * sinA + c.v * cosA
      return daMetriLocali(e, n, origine)
    }) as [Coordinate, Coordinate, Coordinate, Coordinate]
    const ce = u * cosA - v * sinA
    const cn = u * sinA + v * cosA
    return {
      angoli,
      centro: daMetriLocali(ce, cn, origine),
      rotazioneDegrees: 0,
    }
  }

  const startU = minU + w / 2
  const startV = minV + h / 2
  // Colonne/righe che stanno nel bounding box della falda…
  const colBbox = Math.max(1, Math.floor((maxU - w / 2 - startU) / stepU + 1e-6) + 1)
  const rigBbox = Math.max(1, Math.floor((maxV - h / 2 - startV) / stepV + 1e-6) + 1)
  // …estese quanto basta a piazzare TUTTI i moduli richiesti, anche se sforano il
  // tetto: qui si mette il numero desiderato e gli esuberi si tolgono a mano se
  // non ci stanno. Senza, il layout si fermava a quelli che entravano (e sembrava
  // che «non ce ne stessero di più» pur avendone chiesti di più).
  let nCol = colBbox
  let nRig = rigBbox
  while (nCol * nRig < richiesti) {
    if (nCol <= nRig) nCol += 1
    else nRig += 1
  }

  // Prima i moduli interni alla falda (in ordine di riga: la disposizione ordinata
  // di sempre), poi gli altri per arrivare al numero richiesto — questi finiscono
  // ai bordi, pronti da eliminare.
  const dentro: { u: number; v: number }[] = []
  const fuori: { u: number; v: number }[] = []
  for (let r = 0; r < nRig; r += 1) {
    for (let c = 0; c < nCol; c += 1) {
      const u = startU + c * stepU
      const v = startV + r * stepV
      const punto = { u, v }
      if (rettangoloInPoligonoUV(u, v, w, h, poliUV)) dentro.push(punto)
      else fuori.push(punto)
    }
  }
  const moduli = [...dentro, ...fuori]
    .slice(0, richiesti)
    .map(({ u, v }) => costruisci(u, v))

  const areaUno = formato.larghezzaM * formato.lunghezzaM
  return {
    moduli,
    richiesti,
    collocati: moduli.length,
    kWp: (moduli.length * formato.wattPicco) / 1000,
    areaModuliM2: moduli.length * areaUno,
  }
}

/** Ricostruisce il rettangolo modulo attorno a un centro (WGS84). */
export function moduloDaCentro(opzioni: {
  centro: Coordinate
  formato: FormatoModuloFv
  azimuthDegrees: number
  landscape?: boolean
  /** Rotazione extra rispetto all’allineamento falda (gradi). */
  rotazioneDegrees?: number
  /** Origine della proiezione locale (centroid falda). */
  origineProiezione: Coordinate
}): RettangoloModulo {
  const {
    centro,
    formato,
    azimuthDegrees,
    landscape = true,
    rotazioneDegrees = 0,
    origineProiezione,
  } = opzioni
  const w = landscape ? formato.lunghezzaM : formato.larghezzaM
  const h = landscape ? formato.larghezzaM : formato.lunghezzaM
  const θ =
    ((azimuthDegrees + 90 + rotazioneDegrees) * Math.PI) / 180
  const cosA = Math.cos(θ)
  const sinA = Math.sin(θ)
  const { e: cx, n: cy } = aMetriLocali(centro, origineProiezione)
  const hw = w / 2
  const hh = h / 2
  const corners = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((c) => {
    const e = cx + c.x * cosA - c.y * sinA
    const n = cy + c.x * sinA + c.y * cosA
    return daMetriLocali(e, n, origineProiezione)
  }) as [Coordinate, Coordinate, Coordinate, Coordinate]

  return { angoli: corners, centro, rotazioneDegrees }
}

/** Sposta un modulo di Δ lat/lng mantenendo rotazione. */
export function spostaModulo(
  m: RettangoloModulo,
  deltaLat: number,
  deltaLng: number,
  formato: FormatoModuloFv,
  azimuthDegrees: number,
  landscape: boolean,
  origineProiezione: Coordinate,
): RettangoloModulo {
  return moduloDaCentro({
    centro: {
      latitude: m.centro.latitude + deltaLat,
      longitude: m.centro.longitude + deltaLng,
    },
    formato,
    azimuthDegrees,
    landscape,
    rotazioneDegrees: m.rotazioneDegrees,
    origineProiezione,
  })
}

/** Interspazio tipico tra moduli (come nel layout automatico). */
export const GAP_MODULI_M = 0.03

/** Raggio della calamita: entro questa distanza (m) scatta lo snap. */
export const SOGLIA_SNAP_MODULI_M = 0.32

function diffRotazioneDegrees(a: number, b: number): number {
  let d = Math.abs(a - b) % 360
  if (d > 180) d = 360 - d
  return d
}

function dimensioniModuloM(
  formato: FormatoModuloFv,
  landscape: boolean,
): { w: number; h: number } {
  return landscape
    ? { w: formato.lunghezzaM, h: formato.larghezzaM }
    : { w: formato.larghezzaM, h: formato.lunghezzaM }
}

/**
 * Calamita: avvicina il centro a un allineamento preciso con i moduli fissi
 * (bordo a bordo + gap, o allineamento degli assi), nello spazio locale
 * della rotazione del pannello.
 */
export function snapCentroModulo(opzioni: {
  centro: Coordinate
  rotazioneDegrees: number
  formato: FormatoModuloFv
  azimuthDegrees: number
  landscape: boolean
  origineProiezione: Coordinate
  /** Moduli già posizionati (non trascinate). */
  fissi: readonly RettangoloModulo[]
  sogliaM?: number
  gapM?: number
}): Coordinate {
  const {
    centro,
    rotazioneDegrees,
    formato,
    azimuthDegrees,
    landscape,
    origineProiezione,
    fissi,
    sogliaM = SOGLIA_SNAP_MODULI_M,
    gapM = GAP_MODULI_M,
  } = opzioni

  if (fissi.length === 0 || sogliaM <= 0) return centro

  const { w, h } = dimensioniModuloM(formato, landscape)
  const θ = ((azimuthDegrees + 90 + rotazioneDegrees) * Math.PI) / 180
  const cosA = Math.cos(θ)
  const sinA = Math.sin(θ)

  const toUV = (c: Coordinate) => {
    const { e, n } = aMetriLocali(c, origineProiezione)
    return { u: e * cosA + n * sinA, v: -e * sinA + n * cosA }
  }
  const fromUV = (u: number, v: number): Coordinate => {
    const e = u * cosA - v * sinA
    const n = u * sinA + v * cosA
    return daMetriLocali(e, n, origineProiezione)
  }

  const { u, v } = toUV(centro)
  let bestDu = 0
  let bestDuAbs = sogliaM
  let bestDv = 0
  let bestDvAbs = sogliaM

  const considera = (
    target: number,
    attuale: number,
    asse: 'u' | 'v',
  ) => {
    const d = target - attuale
    const a = Math.abs(d)
    if (asse === 'u') {
      if (a < bestDuAbs) {
        bestDuAbs = a
        bestDu = d
      }
    } else if (a < bestDvAbs) {
      bestDvAbs = a
      bestDv = d
    }
  }

  for (const fisso of fissi) {
    if (diffRotazioneDegrees(fisso.rotazioneDegrees, rotazioneDegrees) > 1) {
      continue
    }
    const { u: fu, v: fv } = toUV(fisso.centro)
    // Stesso formato → stessi w/h nello spazio di rotazione.
    const semiU = w + gapM
    const semiV = h + gapM

    considera(fu + semiU, u, 'u')
    considera(fu - semiU, u, 'u')
    considera(fu, u, 'u')
    considera(fv + semiV, v, 'v')
    considera(fv - semiV, v, 'v')
    considera(fv, v, 'v')
  }

  if (bestDu === 0 && bestDv === 0) return centro
  return fromUV(u + bestDu, v + bestDv)
}

/**
 * Applica la calamita a un modulo (ricostruisce angoli dal centro snappato).
 */
export function snapModuloTraVicini(
  m: RettangoloModulo,
  fissi: readonly RettangoloModulo[],
  formato: FormatoModuloFv,
  azimuthDegrees: number,
  landscape: boolean,
  origineProiezione: Coordinate,
  sogliaM?: number,
  gapM?: number,
): RettangoloModulo {
  const centro = snapCentroModulo({
    centro: m.centro,
    rotazioneDegrees: m.rotazioneDegrees,
    formato,
    azimuthDegrees,
    landscape,
    origineProiezione,
    fissi,
    sogliaM,
    gapM,
  })
  if (
    centro.latitude === m.centro.latitude &&
    centro.longitude === m.centro.longitude
  ) {
    return m
  }
  return moduloDaCentro({
    centro,
    formato,
    azimuthDegrees,
    landscape,
    rotazioneDegrees: m.rotazioneDegrees,
    origineProiezione,
  })
}

/** Ruota un modulo di `deltaDegrees` attorno al suo centro. */
export function ruotaModulo(
  m: RettangoloModulo,
  deltaDegrees: number,
  formato: FormatoModuloFv,
  azimuthDegrees: number,
  landscape: boolean,
  origineProiezione: Coordinate,
): RettangoloModulo {
  const rot = ((m.rotazioneDegrees + deltaDegrees) % 360 + 360) % 360
  return moduloDaCentro({
    centro: m.centro,
    formato,
    azimuthDegrees,
    landscape,
    rotazioneDegrees: rot,
    origineProiezione,
  })
}

/** Metri/pixel per Static Maps (immagine già a `scale`). */
export function metriPerPixelStaticMap(
  latitude: number,
  zoom: number,
  scale: number,
): number {
  return (
    (156_543.03392 * Math.cos((latitude * Math.PI) / 180)) /
    Math.pow(2, zoom) /
    scale
  )
}

export function geoAPixel(
  c: Coordinate,
  centro: Coordinate,
  zoom: number,
  scale: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const mpp = metriPerPixelStaticMap(centro.latitude, zoom, scale)
  const { e, n } = aMetriLocali(c, centro)
  return {
    x: canvasW / 2 + e / mpp,
    y: canvasH / 2 - n / mpp,
  }
}

export function pixelAGeo(
  x: number,
  y: number,
  centro: Coordinate,
  zoom: number,
  scale: number,
  canvasW: number,
  canvasH: number,
): Coordinate {
  const mpp = metriPerPixelStaticMap(centro.latitude, zoom, scale)
  const e = (x - canvasW / 2) * mpp
  const n = (canvasH / 2 - y) * mpp
  return daMetriLocali(e, n, centro)
}

/**
 * Il massimo zoom (intero) a cui tutti i punti entrano nel frame, con margine.
 *
 * Serve a inquadrare l'anteprima moduli sulla **falda** invece che su un'area
 * fissa: una singola falda in un frame da ~70 m resta minuscola, persa nel
 * contorno. Con lo zoom giusto riempie la vista, come sulla mappa.
 */
export function zoomPerContenere(
  punti: readonly Coordinate[],
  centro: Coordinate,
  larghezzaPx: number,
  altezzaPx: number,
  scale: number,
  margine = 0.1,
  zoomMin = 17,
  zoomMax = 21,
): number {
  if (punti.length === 0) return zoomMax
  const mx = larghezzaPx * margine
  const my = altezzaPx * margine
  for (let zoom = zoomMax; zoom >= zoomMin; zoom -= 1) {
    const dentro = punti.every((p) => {
      const { x, y } = geoAPixel(p, centro, zoom, scale, larghezzaPx, altezzaPx)
      return x >= mx && x <= larghezzaPx - mx && y >= my && y <= altezzaPx - my
    })
    if (dentro) return zoom
  }
  return zoomMin
}

export function puntoInRettangoloSchermo(
  x: number,
  y: number,
  angoliSchermo: readonly { x: number; y: number }[],
): boolean {
  if (angoliSchermo.length < 3) return false
  let inside = false
  for (let i = 0, j = angoliSchermo.length - 1; i < angoliSchermo.length; j = i++) {
    const xi = angoliSchermo[i]!.x
    const yi = angoliSchermo[i]!.y
    const xj = angoliSchermo[j]!.x
    const yj = angoliSchermo[j]!.y
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-15) + xi
    if (intersect) inside = !inside
  }
  return inside
}
