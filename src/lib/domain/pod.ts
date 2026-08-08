/** Lunghezza ammessa del codice POD (Punto di Prelievo). */
export const POD_LUNGHEZZA_MIN = 14
export const POD_LUNGHEZZA_MAX = 15

/** Solo lettere e cifre, senza spazi o trattini. */
export const REGEX_POD = /^[A-Z0-9]{14,15}$/

export type EsitoPod =
  | { readonly ok: true; readonly normalizzato: string }
  | { readonly ok: false; readonly motivo: string }

/** Rimuove spazi e porta in maiuscolo: il POD si leguce cosi' in bolletta. */
export function normalizzaPod(valore: string): string {
  return valore.trim().toUpperCase().replace(/\s+/g, '')
}

export function validaPod(valore: string): EsitoPod {
  const normalizzato = normalizzaPod(valore)
  if (normalizzato.length === 0) {
    return { ok: false, motivo: 'Indicare il codice POD.' }
  }
  if (normalizzato.length < POD_LUNGHEZZA_MIN || normalizzato.length > POD_LUNGHEZZA_MAX) {
    return {
      ok: false,
      motivo: `Il codice POD deve essere alfanumerico e lungo ${POD_LUNGHEZZA_MIN} o ${POD_LUNGHEZZA_MAX} caratteri.`,
    }
  }
  if (!REGEX_POD.test(normalizzato)) {
    return {
      ok: false,
      motivo: 'Il codice POD accetta solo lettere e cifre (es. IT001E12345678).',
    }
  }
  return { ok: true, normalizzato }
}

/** Per campi facoltativi: stringa vuota e' ammessa. */
export function validaPodOpzionale(valore: string): EsitoPod {
  const normalizzato = normalizzaPod(valore)
  if (normalizzato.length === 0) return { ok: true, normalizzato: '' }
  return validaPod(valore)
}
