/**
 * Trasposizione: dall'irraggiamento orizzontale a quello sul piano dei moduli.
 *
 * PVGIS ci dà tre numeri sull'orizzontale — globale (GHI), diretto normale (DNI),
 * diffuso (DHI). Un modulo però è inclinato e orientato: riceve il diretto sotto
 * un certo angolo, una parte del cielo diffuso, e un po' di riflesso dal terreno.
 * La somma di questi tre è il POA (Plane Of Array), l'irraggiamento che il
 * pannello vede davvero — l'ingresso di tutto il resto della catena.
 *
 * Modello **Hay-Davies** per la componente diffusa: anisotropo (tiene conto che
 * il cielo è più luminoso attorno al sole), è lo standard di PVGIS e pvlib, e
 * costa pochissimo in più dell'isotropo. Il riflesso dal terreno è isotropo con
 * albedo dichiarata.
 *
 * ## Proprietà da non perdere
 *
 * A inclinazione 0° il POA **coincide** col GHI: un piano orizzontale vede
 * esattamente ciò che misura l'orizzontale. È il controllo che smaschera un
 * errore di segno o di angolo.
 */

const RAD = Math.PI / 180

/** Albedo del terreno di default: erba/asfalto ~0,2 (standard PVGIS). */
export const ALBEDO_DEFAULT = 0.2

export interface IngressoTrasposizione {
  /** Globale orizzontale, W/m². */
  readonly ghi: number
  /** Diretto normale, W/m². */
  readonly dni: number
  /** Diffuso orizzontale, W/m². */
  readonly dhi: number
  /** Extraterrestre normale del giorno, W/m² (per l'indice di anisotropia). */
  readonly e0: number
  /** Zenit solare, gradi. */
  readonly zenitDeg: number
  /** Azimut del sole da Nord, gradi. */
  readonly azimutSoleDeg: number
  /** Inclinazione del modulo dall'orizzontale, gradi [0, 90]. */
  readonly tiltDeg: number
  /** Azimut del modulo da Nord, gradi. */
  readonly azimutModuloDeg: number
  /** Albedo del terreno; default {@link ALBEDO_DEFAULT}. */
  readonly albedo?: number
}

export interface RisultatoTrasposizione {
  readonly poa: number
  readonly poaDiretto: number
  readonly poaDiffuso: number
  readonly poaRiflesso: number
  /** Coseno dell'angolo di incidenza sul modulo, in [0, 1] (0 = radente/dietro). */
  readonly cosAoi: number
}

/** Coseno dell'angolo di incidenza fra sole e normale del modulo. */
export function cosAngoloIncidenza(
  zenitDeg: number,
  azimutSoleDeg: number,
  tiltDeg: number,
  azimutModuloDeg: number,
): number {
  const z = zenitDeg * RAD
  const t = tiltDeg * RAD
  const dAz = (azimutSoleDeg - azimutModuloDeg) * RAD
  const cos =
    Math.cos(z) * Math.cos(t) + Math.sin(z) * Math.sin(t) * Math.cos(dAz)
  return Math.max(0, cos) // < 0 = sole dietro il pannello: niente diretto.
}

export function trasponiHayDavies(
  input: IngressoTrasposizione,
): RisultatoTrasposizione {
  const albedo = input.albedo ?? ALBEDO_DEFAULT
  const t = input.tiltDeg * RAD
  const cosZen = Math.cos(input.zenitDeg * RAD)

  const cosAoi = cosAngoloIncidenza(
    input.zenitDeg,
    input.azimutSoleDeg,
    input.tiltDeg,
    input.azimutModuloDeg,
  )

  // Sole praticamente all'orizzonte o sotto: niente diretto, niente termine
  // circumsolare. Rb esploderebbe (cosZen→0): lo si annulla con onestà.
  const soleUtile = cosZen > 0.017 // zenit < ~89°
  const rb = soleUtile ? cosAoi / cosZen : 0

  // Diretto sul piano: DNI proiettato sull'angolo di incidenza.
  const poaDiretto = soleUtile ? input.dni * cosAoi : 0

  // Diffuso Hay-Davies: parte circumsolare (segue il sole, pesata dall'indice di
  // anisotropia Ai) + parte isotropa dalla volta celeste.
  const ai = input.e0 > 0 ? Math.min(1, Math.max(0, input.dni / input.e0)) : 0
  const fattoreIsotropo = (1 + Math.cos(t)) / 2
  const poaDiffuso = input.dhi * (ai * rb + (1 - ai) * fattoreIsotropo)

  // Riflesso dal terreno, isotropo.
  const poaRiflesso = input.ghi * albedo * ((1 - Math.cos(t)) / 2)

  const poa = Math.max(0, poaDiretto + poaDiffuso + poaRiflesso)

  return { poa, poaDiretto, poaDiffuso, poaRiflesso, cosAoi }
}
