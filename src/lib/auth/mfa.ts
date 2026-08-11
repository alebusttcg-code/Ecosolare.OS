import { createHash } from 'node:crypto'
import type { Role } from './policy'

/**
 * Obbligo MFA per ruolo.
 *
 * Disattivato (D-018 revocata): accesso solo email + password. La funzione
 * resta per non rompere i call-site; restituisce sempre `false`.
 */
export function mfaObbligatoria(_ruolo: Role): boolean {
  return false
}

/**
 * Impronta di un codice di recupero.
 *
 * SHA-256 senza sale e senza costo, a differenza delle password: questi codici
 * sono generati dal sistema con cinquanta bit di entropia, quindi non esiste un
 * dizionario da cui indovinarli e rallentare il confronto non aggiunge niente.
 * Sale e scrypt servono contro le password *scelte da una persona*.
 */
export function improntaCodiceRecupero(codiceNormalizzato: string): string {
  return createHash('sha256').update(codiceNormalizzato).digest('hex')
}

/**
 * Consuma un codice di recupero, se corrisponde.
 *
 * Restituisce l'elenco aggiornato — il codice usato sparisce — oppure `null` se
 * nessuno corrisponde. Usa e getta perché un codice di recupero riutilizzabile
 * è una password scritta su un foglietto: il foglietto resta, ma almeno vale
 * una volta sola.
 */
export function consumaCodiceRecupero(
  improntePresenti: readonly string[],
  codiceNormalizzato: string,
): string[] | null {
  const impronta = improntaCodiceRecupero(codiceNormalizzato)
  if (!improntePresenti.includes(impronta)) return null
  return improntePresenti.filter((h) => h !== impronta)
}
