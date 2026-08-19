/**
 * Atterraggio dopo il login. Ora ogni ruolo ha la sua home su `/`: la direzione
 * il cruscotto, il commerciale e il campo la loro giornata, la contabilità le
 * fatture da chiudere. Non si manda più nessuno direttamente su un elenco — per
 * questo la destinazione non dipende più dal ruolo.
 */
export function homeDopoAccesso(): string {
  return '/'
}
