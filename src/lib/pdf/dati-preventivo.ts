import { formattaImporto } from '@/lib/domain/money'

/**
 * Dati già formattati per il PDF cliente.
 *
 * Nessun costo, nessun margine: questo DTO è ciò che esce dall'azienda.
 */

export interface RigaPdfPreventivo {
  readonly descrizione: string
  readonly quantita: string
  readonly unita: string
  readonly prezzoUnitario: string
  readonly scontoPct: string | null
  readonly ivaPct: string
  readonly importo: string
}

export interface RipartizioneIvaPdf {
  readonly etichetta: string
  readonly imponibile: string
  readonly imposta: string
}

export interface DatiPdfPreventivo {
  readonly codice: string
  readonly titolo: string
  readonly versione: number
  readonly dataDocumento: string
  readonly validita: string | null
  readonly clienteNome: string
  readonly aziendaCliente: string | null
  readonly immobileEtichetta: string | null
  readonly immobileIndirizzo: string | null
  readonly righe: readonly RigaPdfPreventivo[]
  readonly scontoGlobalePct: string | null
  readonly imponibile: string
  readonly ripartizioneIva: readonly RipartizioneIvaPdf[]
  readonly totaleIva: string
  readonly totaleLordo: string
  readonly note: string | null
}

/** Nome file sicuro per Content-Disposition. */
export function nomeFilePreventivo(codice: string, versione: number): string {
  const pulito = codice.replace(/[^A-Za-z0-9._-]+/g, '-')
  return `Preventivo-${pulito}-v${versione}.pdf`
}

/** Da stringa numerica DB (es. "1234.56") a euro formattato. */
export function formattaEuroDb(valore: string | number): string {
  const numero = typeof valore === 'number' ? valore : Number.parseFloat(valore)
  if (!Number.isFinite(numero)) return formattaImporto(0)
  return formattaImporto(Math.round(numero * 100))
}

export function formattaPrezzoUnitario(valore: string | number): string {
  const numero = typeof valore === 'number' ? valore : Number.parseFloat(valore)
  if (!Number.isFinite(numero)) return '€ 0,00'
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
    useGrouping: true,
  }).format(numero)
}

export function formattaQuantita(valore: string | number): string {
  const numero = typeof valore === 'number' ? valore : Number.parseFloat(valore)
  if (!Number.isFinite(numero)) return '0'
  return new Intl.NumberFormat('it-IT', {
    maximumFractionDigits: 3,
  }).format(numero)
}

export function formattaDataIt(data: Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(data)
}
