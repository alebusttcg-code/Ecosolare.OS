/**
 * Selezione delle pagine di un allegato, scritta a mano.
 *
 * Le schede tecniche dei produttori sono spesso opuscoli da otto pagine di cui
 * al cliente ne interessa una: la tabella delle caratteristiche. Chi carica il
 * file scrive «3» o «2-4», come si scrive in una finestra di stampa, perché
 * quella è la sintassi che tutti conoscono già.
 *
 * Vive fuori dalla server action perché un file `'use server'` può esportare
 * solo funzioni asincrone, e questa deve restare verificabile da sola.
 */

export type SelezionePagine = readonly number[] | null

/** Limite di sicurezza: nessuna scheda tecnica ha 200 pagine da allegare. */
const AMPIEZZA_MASSIMA_INTERVALLO = 200

/**
 * `null` significa «tutte le pagine» — il caso normale, che è anche quello che
 * si ottiene lasciando il campo vuoto. `'errore'` significa che il testo non è
 * interpretabile: meglio dirlo che indovinare, perché indovinare qui vuol dire
 * allegare al cliente una pagina diversa da quella voluta.
 */
export function leggiSelezionePagine(testo: string): SelezionePagine | 'errore' {
  const pulito = testo.trim()
  if (pulito === '') return null

  const pagine = new Set<number>()
  for (const pezzo of pulito.split(',')) {
    const voce = pezzo.trim()
    const intervallo = voce.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (intervallo) {
      const da = Number(intervallo[1])
      const a = Number(intervallo[2])
      if (da < 1 || a < da || a - da >= AMPIEZZA_MASSIMA_INTERVALLO) return 'errore'
      for (let pagina = da; pagina <= a; pagina += 1) pagine.add(pagina)
      continue
    }
    if (!/^\d+$/.test(voce)) return 'errore'
    const numero = Number(voce)
    if (numero < 1) return 'errore'
    pagine.add(numero)
  }

  if (pagine.size === 0) return 'errore'
  return [...pagine].sort((a, b) => a - b)
}

/** Come si riscrive una selezione per rimetterla nel campo del modulo. */
export function scriviSelezionePagine(selezione: SelezionePagine): string {
  if (!selezione || selezione.length === 0) return ''
  return selezione.join(', ')
}
