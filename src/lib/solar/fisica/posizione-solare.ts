/**
 * Posizione del sole nel cielo — il fondamento della trasposizione.
 *
 * Per portare l'irraggiamento dall'orizzontale al piano dei moduli serve sapere
 * dov'è il sole ora per ora: la sua altezza (elevazione) e la sua direzione
 * (azimut). Da lì nasce l'angolo di incidenza sul pannello, e quindi quanta
 * radiazione diretta lo colpisce.
 *
 * Algoritmo NOAA (Spencer 1971 per declinazione ed equazione del tempo): compatto
 * e accurato a una frazione di grado, più che sufficiente per l'energia annua.
 *
 * ## Convenzioni
 *
 *  - **azimut da Nord, orario**: N=0°, E=90°, S=180°, O=270°. È la stessa che
 *    usano PVGIS e SolarEdge nei dossier (174° = quasi sud), così le esposizioni
 *    delle falde entrano senza conversioni.
 *  - **tempo in UTC**: la climatologia PVGIS è in UTC. L'ora solare vera si
 *    ricava da UTC + longitudine + equazione del tempo, non dal fuso civile.
 */

const GRADI = 180 / Math.PI
const RAD = Math.PI / 180

/** Giorno dell'anno rappresentativo di ciascun mese (Klein 1977). */
export const GIORNO_RAPPRESENTATIVO: readonly number[] = [
  17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344,
]

export interface PosizioneSolare {
  /** Elevazione sopra l'orizzonte, gradi. Negativa = sole sotto l'orizzonte. */
  readonly elevazioneDeg: number
  /** Angolo zenitale, gradi (90 − elevazione). */
  readonly zenitDeg: number
  /** Azimut da Nord in senso orario, gradi [0, 360). */
  readonly azimutDeg: number
}

/**
 * Posizione del sole per una data e ora UTC a una certa latitudine/longitudine.
 *
 * `giornoDellAnno` è 1–365; `oraUtc` è decimale (12,5 = 12:30 UTC).
 */
export function posizioneSolare(
  latDeg: number,
  lngDeg: number,
  giornoDellAnno: number,
  oraUtc: number,
): PosizioneSolare {
  const lat = latDeg * RAD

  // Angolo dell'anno (frazione, radianti).
  const gamma =
    ((2 * Math.PI) / 365) * (giornoDellAnno - 1 + (oraUtc - 12) / 24)

  // Equazione del tempo, minuti (Spencer).
  const eqTempoMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))

  // Declinazione solare, radianti (Spencer).
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)

  // Tempo solare vero (minuti). Con l'ora in UTC, il meridiano di riferimento è
  // 0°, quindi niente termine di fuso: solo longitudine ed equazione del tempo.
  const tstMin = oraUtc * 60 + eqTempoMin + 4 * lngDeg
  // Angolo orario: 0 a mezzogiorno solare, negativo al mattino, positivo il pomeriggio.
  const ha = (tstMin / 4 - 180) * RAD

  const cosZen =
    Math.sin(lat) * Math.sin(decl) +
    Math.cos(lat) * Math.cos(decl) * Math.cos(ha)
  const cosZenLim = Math.min(1, Math.max(-1, cosZen))
  const zenit = Math.acos(cosZenLim)
  const elevazione = Math.PI / 2 - zenit

  // Azimut da Sud (positivo verso Ovest), poi convertito da Nord orario.
  const azSud = Math.atan2(
    Math.sin(ha),
    Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat),
  )
  const azNord = (azSud * GRADI + 180 + 360) % 360

  return {
    elevazioneDeg: elevazione * GRADI,
    zenitDeg: zenit * GRADI,
    azimutDeg: azNord,
  }
}

/**
 * Irraggiamento extraterrestre normale, W/m² — serve al modello di trasposizione
 * anisotropo (Hay-Davies) come riferimento del cielo limpido.
 */
export function irraggiamentoExtraterrestre(giornoDellAnno: number): number {
  const COSTANTE_SOLARE = 1361
  return (
    COSTANTE_SOLARE *
    (1 + 0.033 * Math.cos((2 * Math.PI * giornoDellAnno) / 365))
  )
}
