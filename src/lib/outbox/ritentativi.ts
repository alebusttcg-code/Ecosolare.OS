/**
 * Politica di ritentativo dell'outbox.
 *
 * Separata dal resto perché è la parte che va provata senza database e senza
 * rete: quante volte riprovare e quanto aspettare è una decisione, non un
 * dettaglio di implementazione.
 */

/** Oltre questo numero l'evento resta fallito e va guardato da una persona. */
export const TENTATIVI_MASSIMI = 12

const BASE_MS = 30_000
const TETTO_MS = 6 * 60 * 60_000

/**
 * Attesa prima del tentativo successivo, in millisecondi.
 *
 * Cresce esponenzialmente: un servizio esterno che è giù resta giù per minuti,
 * non per millisecondi, e riprovare subito significa solo sprecare tentativi
 * mentre l'attesa massima serve a non abbandonare troppo presto.
 */
export function attesaPrimaDelProssimo(tentativiFatti: number): number {
  const esponente = Math.max(0, Math.min(tentativiFatti - 1, 20))
  return Math.min(BASE_MS * 2 ** esponente, TETTO_MS)
}

export function haAncoraTentativi(tentativiFatti: number): boolean {
  return tentativiFatti < TENTATIVI_MASSIMI
}

/**
 * Quando riprovare, oppure `null` se i tentativi sono finiti.
 *
 * Con questi parametri l'ultimo tentativo cade circa venti ore dopo il primo:
 * abbastanza da attraversare un guasto notturno senza intervento, abbastanza
 * poco da accorgersene entro il giorno dopo.
 */
export function prossimoTentativo(
  tentativiFatti: number,
  adesso: Date,
): Date | null {
  if (!haAncoraTentativi(tentativiFatti)) return null
  return new Date(adesso.getTime() + attesaPrimaDelProssimo(tentativiFatti))
}
