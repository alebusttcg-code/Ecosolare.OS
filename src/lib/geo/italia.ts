import dati from './italia-dati.json'
import { componeIndirizzo, TIPI_VIA } from './tipi-via'

export { TIPI_VIA, componeIndirizzo }

export interface Regione {
  readonly codice: string
  readonly nome: string
}

export interface Provincia {
  readonly sigla: string
  readonly nome: string
  readonly regioneCodice: string
}

export interface Comune {
  /** Nome del comune. */
  readonly n: string
  /** Sigla provincia. */
  readonly s: string
  /** CAP unico oppure elenco. */
  readonly c: string | readonly string[]
}

const REGIONI = dati.regioni as Regione[]
const PROVINCE = dati.province as Provincia[]
const COMUNI = dati.comuni as Comune[]

export function elencoRegioni(): readonly Regione[] {
  return REGIONI
}

export function elencoProvince(regioneCodice?: string): readonly Provincia[] {
  if (!regioneCodice) return PROVINCE
  return PROVINCE.filter((p) => p.regioneCodice === regioneCodice)
}

export function elencoComuni(siglaProvincia?: string): readonly Comune[] {
  if (!siglaProvincia) return []
  return COMUNI.filter((c) => c.s === siglaProvincia)
}

export function regioneDiProvincia(sigla: string): string | null {
  return PROVINCE.find((p) => p.sigla === sigla)?.regioneCodice ?? null
}

export function capDelComune(comune: Comune): readonly string[] {
  return typeof comune.c === 'string' ? [comune.c] : [...comune.c]
}
