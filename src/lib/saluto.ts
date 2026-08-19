/**
 * Il saluto d'ingresso, uguale per ogni home per ruolo.
 *
 * Sta qui e non dentro la pagina perché ora lo usano tre home diverse
 * (direzione, commerciale/campo, contabilità): un'unica fonte evita che il
 * «Buongiorno» cambi soglia a seconda della schermata.
 */

/** Saluto secondo l'ora italiana: è la prima riga che si legge ogni mattina. */
export function saluto(adesso: Date = new Date()): string {
  const ora = Number(
    new Intl.DateTimeFormat('it-IT', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Europe/Rome',
    }).format(adesso),
  )
  if (ora >= 5 && ora < 13) return 'Buongiorno'
  if (ora < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

/** «Martedì 19 agosto», in ora italiana, con l'iniziale maiuscola. */
export function dataEstesa(adesso: Date = new Date()): string {
  const testo = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Rome',
  }).format(adesso)
  return testo.charAt(0).toUpperCase() + testo.slice(1)
}

/** Il nome con cui rivolgersi alla persona: primo nome, o l'utente dell'email. */
export function primoNome(nome: string | null, email: string): string {
  return (nome ?? email).split(/[\s@]/)[0] || email
}
