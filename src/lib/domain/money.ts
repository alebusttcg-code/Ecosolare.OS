/**
 * Aritmetica monetaria.
 *
 * Nessun calcolo economico usa numeri in virgola mobile: `0.1 + 0.2` non fa
 * `0.3`, e su un preventivo da 30.000 euro con quaranta righe l'errore diventa
 * visibile al cliente. Tutti i valori sono INTERI in unita' scalate:
 *
 *   - importi e totali .......... centesimi di euro           (scala 100)
 *   - prezzi e costi unitari .... decimillesimi di euro       (scala 10.000)
 *   - quantita' ................. millesimi di unita'         (scala 1.000)
 *   - percentuali ............... centesimi di punto (bp)     (scala 100)
 *
 * I prezzi unitari hanno quattro decimali perche' nel fotovoltaico si ragiona
 * anche in euro/Watt, dove il quarto decimale sposta centinaia di euro su un
 * impianto.
 */

export const SCALA_IMPORTO = 100
export const SCALA_PREZZO = 10_000
export const SCALA_QUANTITA = 1_000
export const SCALA_PERCENTUALE = 100

/** Converte un valore inserito dall'utente in unita' scalate intere. */
function aScala(valore: string | number, scala: number): number {
  const numero = typeof valore === 'number' ? valore : Number.parseFloat(valore.replace(',', '.'))
  if (!Number.isFinite(numero)) return 0
  return Math.round(numero * scala)
}

export const importoDaEuro = (valore: string | number): number => aScala(valore, SCALA_IMPORTO)
export const prezzoDaEuro = (valore: string | number): number => aScala(valore, SCALA_PREZZO)
export const quantitaDaNumero = (valore: string | number): number =>
  aScala(valore, SCALA_QUANTITA)
export const percentualeDaNumero = (valore: string | number): number =>
  aScala(valore, SCALA_PERCENTUALE)

/**
 * Divisione con arrotondamento commerciale (half away from zero).
 *
 * `Math.round` arrotonda -0,5 a 0 anziche' a -1: su valori negativi — sconti,
 * note di credito, margini in perdita — produrrebbe uno scarto di un centesimo
 * nella direzione sbagliata.
 */
export function dividiArrotondando(dividendo: number, divisore: number): number {
  if (divisore === 0) return 0
  const segno = dividendo < 0 !== divisore < 0 ? -1 : 1
  return segno * Math.round(Math.abs(dividendo) / Math.abs(divisore))
}

/** Da centesimi a stringa decimale, per il salvataggio in numeric(14,2). */
export function importoAStringa(centesimi: number): string {
  return (centesimi / SCALA_IMPORTO).toFixed(2)
}

/** Da decimillesimi a stringa decimale, per numeric(14,4). */
export function prezzoAStringa(decimillesimi: number): string {
  return (decimillesimi / SCALA_PREZZO).toFixed(4)
}

export function quantitaAStringa(millesimi: number): string {
  return (millesimi / SCALA_QUANTITA).toFixed(3)
}

const FORMATO_EURO = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

export function formattaImporto(centesimi: number): string {
  return FORMATO_EURO.format(centesimi / SCALA_IMPORTO)
}

export function formattaPercentuale(basisPoint: number): string {
  return `${(basisPoint / SCALA_PERCENTUALE).toFixed(1)}%`
}
