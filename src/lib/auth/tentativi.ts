/**
 * Blocco progressivo dei tentativi di accesso falliti.
 *
 * Il problema che risolve: senza, una password di dodici caratteri resta
 * attaccabile da uno script che ne prova qualche milione. Con questo, un
 * attaccante ottiene circa cinque tentativi all'ora.
 *
 * Progressivo e non fisso perché le due situazioni da distinguere sono
 * «la persona ha sbagliato a digitare» (deve poter riprovare subito) e
 * «qualcuno sta provando a indovinare» (deve rallentare fino a fermarsi).
 * Un blocco fisso di trenta minuti al terzo errore punisce solo la prima.
 */

/** Sotto questa soglia non si blocca: sono errori di digitazione. */
export const TENTATIVI_LIBERI = 4

const BASE_MS = 60_000
const MASSIMO_MS = 30 * 60_000

/**
 * Durata del blocco dopo `tentativi` fallimenti consecutivi, in millisecondi.
 * Zero significa nessun blocco.
 */
export function durataBlocco(tentativi: number): number {
  if (tentativi <= TENTATIVI_LIBERI) return 0
  const raddoppi = tentativi - TENTATIVI_LIBERI - 1
  return Math.min(BASE_MS * 2 ** Math.min(raddoppi, 20), MASSIMO_MS)
}

/** Il momento fino a cui l'accesso è bloccato, o `null`. */
export function bloccoFinoA(tentativi: number, adesso: Date): Date | null {
  const durata = durataBlocco(tentativi)
  return durata === 0 ? null : new Date(adesso.getTime() + durata)
}

/** Attesa residua in minuti, arrotondata per eccesso: zero non si mostra. */
export function minutiResidui(lockedUntil: Date, adesso: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - adesso.getTime()) / 60_000))
}
