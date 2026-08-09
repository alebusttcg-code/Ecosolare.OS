/**
 * Finestra oraria reminder follow-up (D-015), fuso Europe/Rome.
 */

const ZONA = 'Europe/Rome'
const ORA_MINIMA_REMINDER = 8

/** Data civile YYYY-MM-DD in Europe/Rome. */
export function giornoRoma(quando: Date = new Date()): string {
  return quando.toLocaleDateString('en-CA', { timeZone: ZONA })
}

/** Ora 0–23 in Europe/Rome. */
export function oraRoma(quando: Date = new Date()): number {
  const pezzo = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(quando)
  const ora = pezzo.find((p) => p.type === 'hour')?.value
  return Number(ora ?? '0')
}

/** True se siamo nel giorno di scadenza e non prima delle 08:00 locali. */
export function eOraDiReminderFollowUp(
  dueAt: Date | null | undefined,
  adesso: Date = new Date(),
): boolean {
  if (!dueAt) return false
  if (giornoRoma(dueAt) !== giornoRoma(adesso)) return false
  return oraRoma(adesso) >= ORA_MINIMA_REMINDER
}
