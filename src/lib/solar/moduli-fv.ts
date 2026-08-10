/**
 * Formati modulo FV prestabiliti per anteprima layout (lab Sviluppo).
 * Dimensioni tipiche di mercato; non sono listino CRM.
 */

export interface FormatoModuloFv {
  readonly id: string
  readonly etichetta: string
  /** Watt picco nominali. */
  readonly wattPicco: number
  /** Lato corto (larghezza cella), m — orientamento landscape = questo lato “su”. */
  readonly larghezzaM: number
  /** Lato lungo, m. */
  readonly lunghezzaM: number
}

export const FORMATI_MODULO_FV: readonly FormatoModuloFv[] = [
  {
    id: 'mod-450-std',
    etichetta: '450 W · 1134 × 1722 mm',
    wattPicco: 450,
    larghezzaM: 1.134,
    lunghezzaM: 1.722,
  },
  {
    id: 'mod-500-std',
    etichetta: '500 W · 1134 × 1909 mm',
    wattPicco: 500,
    larghezzaM: 1.134,
    lunghezzaM: 1.909,
  },
  {
    id: 'mod-430-compatto',
    etichetta: '430 W · 1096 × 1722 mm',
    wattPicco: 430,
    larghezzaM: 1.096,
    lunghezzaM: 1.722,
  },
  {
    id: 'mod-400-compatto',
    etichetta: '400 W · 1038 × 1722 mm',
    wattPicco: 400,
    larghezzaM: 1.038,
    lunghezzaM: 1.722,
  },
] as const

export function formatoModuloById(id: string): FormatoModuloFv {
  return FORMATI_MODULO_FV.find((f) => f.id === id) ?? FORMATI_MODULO_FV[0]!
}
