/**
 * Temperatura della cella e derating termico.
 *
 * Un modulo caldo rende meno: la potenza cala di ~0,35% per ogni grado sopra i
 * 25°C di targa. D'estate, quando il sole è forte, la cella può stare a 55–65°C
 * e perdere il 10–14% — è la perdita più grande e più variabile, e va calcolata,
 * non messa in una costante.
 *
 * Temperatura di cella: modello NOCT (Nominal Operating Cell Temperature), che
 * lega la temperatura al solo irraggiamento e all'aria — nessun dato di vento
 * richiesto, quindi robusto con ciò che il TMY ridotto conserva.
 */

/** Temperatura nominale della cella a 800 W/m², 20°C aria: moduli moderni ~45°C. */
export const NOCT_DEFAULT = 45

/** Coefficiente di potenza in temperatura, per °C. Moduli moderni ~ −0,0035/°C. */
export const COEFF_TEMPERATURA_DEFAULT = -0.0035

/** Temperatura della cella, °C, dal modello NOCT. */
export function temperaturaCella(
  temperaturaAriaC: number,
  poaWm2: number,
  noct: number = NOCT_DEFAULT,
): number {
  return temperaturaAriaC + ((noct - 20) / 800) * Math.max(0, poaWm2)
}

/**
 * Fattore moltiplicativo della potenza per effetto temperatura.
 *
 * 1 a 25°C; >1 quando la cella è più fredda (inverno), <1 quando è più calda.
 * Non scende mai sotto zero: una cella rovente rende poco, non «negativo».
 */
export function fattoreTemperatura(
  temperaturaCellaC: number,
  coeff: number = COEFF_TEMPERATURA_DEFAULT,
): number {
  return Math.max(0, 1 + coeff * (temperaturaCellaC - 25))
}
