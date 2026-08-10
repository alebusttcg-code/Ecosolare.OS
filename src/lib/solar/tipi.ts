/** Tipi minimi della Solar API usati dal laboratorio Sviluppo. */

export type QualitaImmagini = 'HIGH' | 'MEDIUM' | 'BASE'

export interface Coordinate {
  readonly latitude: number
  readonly longitude: number
}

export interface FaldaTetto {
  readonly indice: number
  readonly pitchDegrees: number
  readonly azimuthDegrees: number
  /** Area della falda (con tilt), m². */
  readonly areaMeters2: number
  readonly groundAreaMeters2: number | null
  readonly center: Coordinate | null
  /** Media grezza dei sunshine quantiles (ore equivalenti relative). */
  readonly sunshineMedio: number | null
}

export interface AnalisiTetto {
  readonly formattedAddress: string
  readonly location: Coordinate
  readonly imageryQuality: QualitaImmagini | null
  readonly imageryDate: string | null
  readonly maxArrayPanelsCount: number | null
  readonly maxSunshineHoursPerYear: number | null
  readonly wholeRoofAreaMeters2: number | null
  readonly falde: readonly FaldaTetto[]
}

export type ErroreSolar =
  | { readonly codice: 'non_configurato'; readonly messaggio: string }
  | { readonly codice: 'geocode'; readonly messaggio: string }
  | { readonly codice: 'edificio_non_trovato'; readonly messaggio: string }
  | { readonly codice: 'quota'; readonly messaggio: string }
  | { readonly codice: 'rete'; readonly messaggio: string }
  | { readonly codice: 'sconosciuto'; readonly messaggio: string }
