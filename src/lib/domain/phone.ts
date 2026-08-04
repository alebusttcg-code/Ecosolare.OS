/**
 * Normalizzazione dei numeri di telefono in formato E.164.
 *
 * Serve alla deduplica: lo stesso cliente scritto come "333 123 4567",
 * "+39 333 1234567" e "333-1234567" deve produrre la stessa chiave, altrimenti
 * si creano tre anagrafiche e lo storico si frammenta (US-02.1).
 *
 * Principio guida: **nell'incertezza non si indovina**. Se il numero non e'
 * riconoscibile con sicurezza si restituisce `null` e la deduplica su telefono
 * semplicemente non avviene per quel contatto. Un mancato accorpamento e'
 * fastidioso; una fusione sbagliata unisce due clienti diversi ed e' molto
 * peggio da scoprire e da disfare.
 */

const PREFISSO_ITALIA = '+39'

/** Cifre di un numero italiano valido, escluso il prefisso internazionale. */
const LUNGHEZZA_MIN_NAZIONALE = 6
const LUNGHEZZA_MAX_NAZIONALE = 11

export interface NumeroNormalizzato {
  /** Formato E.164, oppure null se non riconoscibile con certezza. */
  readonly e164: string | null
  /** Il valore originale, sempre conservato: e' quello che l'utente riconosce. */
  readonly raw: string
}

export function normalizePhone(input: string | null | undefined): NumeroNormalizzato {
  const raw = (input ?? '').trim()
  if (raw === '') return { e164: null, raw }

  // Via separatori, prefissi internazionali alternativi e interni telefonici.
  const pulito = raw
    .replace(/[\s.\-/()]/g, '')
    .replace(/^00/, '+')
    .replace(/^\+{2,}/, '+')

  if (!/^\+?\d+$/.test(pulito)) return { e164: null, raw }

  // Numero gia' internazionale.
  if (pulito.startsWith('+')) {
    const cifre = pulito.slice(1)
    if (cifre.length < 8 || cifre.length > 15) return { e164: null, raw }
    return { e164: `+${cifre}`, raw }
  }

  // Prefisso 39 senza segno: lo si accetta come Italia solo se cio' che segue
  // e' plausibile, per non trasformare un numero locale che inizia per 39.
  if (pulito.startsWith('39')) {
    const resto = pulito.slice(2)
    if (
      resto.length >= LUNGHEZZA_MIN_NAZIONALE &&
      resto.length <= LUNGHEZZA_MAX_NAZIONALE &&
      (resto.startsWith('3') || resto.startsWith('0'))
    ) {
      return { e164: `${PREFISSO_ITALIA}${resto}`, raw }
    }
  }

  // Numeri nazionali: i fissi italiani iniziano per 0, i mobili per 3.
  if (
    (pulito.startsWith('0') || pulito.startsWith('3')) &&
    pulito.length >= LUNGHEZZA_MIN_NAZIONALE &&
    pulito.length <= LUNGHEZZA_MAX_NAZIONALE
  ) {
    return { e164: `${PREFISSO_ITALIA}${pulito}`, raw }
  }

  // Tutto il resto (numeri brevi, interni, cifre incollate per errore)
  // resta non normalizzato di proposito.
  return { e164: null, raw }
}

/** Minuscolo e senza spazi: chiave di deduplica per l'email. */
export function normalizeEmail(input: string | null | undefined): string | null {
  const pulito = (input ?? '').trim().toLowerCase()
  if (pulito === '') return null
  // Validazione volutamente minima: qui serve una chiave, non una garanzia di
  // recapitabilita'. La validazione vera avviene con Zod al confine.
  if (!pulito.includes('@') || pulito.startsWith('@') || pulito.endsWith('@')) return null
  return pulito
}

/** Confronto di nomi tollerante ad accenti, maiuscole e spazi doppi. */
export function normalizeName(input: string | null | undefined): string {
  return (input ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}
