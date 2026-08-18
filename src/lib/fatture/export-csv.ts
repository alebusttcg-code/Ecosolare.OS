/**
 * Registro delle fatture emesse in formato CSV, per il commercialista.
 *
 * È l'export dell'ambito A6 del blueprint: il gestionale non trasmette allo SdI,
 * ma consegna al commercialista un registro importabile in qualunque software.
 *
 * Convenzioni **italiane**, perché è lì che finisce: separatore `;` (l'Excel
 * italiano lo usa come predefinito), numeri con la virgola decimale, date
 * `gg/mm/aaaa`. Funzione pura: si prova l'escaping e la formattazione senza
 * database.
 */

export interface RigaRegistro {
  readonly numero: string
  readonly data: Date | null
  readonly tipo: string
  readonly cliente: string
  readonly codiceFiscale: string | null
  readonly partitaIva: string | null
  readonly imponibileCents: number
  readonly impostaCents: number
  readonly totaleCents: number
  /** Aliquote presenti nella fattura, in percentuale (es. [10] o [10, 22]). */
  readonly aliquote: readonly number[]
}

const INTESTAZIONI = [
  'Numero',
  'Data',
  'Tipo',
  'Cliente',
  'Codice fiscale',
  'Partita IVA',
  'Imponibile',
  'Imposta',
  'Totale',
  'Aliquote',
] as const

/** Un campo CSV: fra virgolette se contiene separatore, virgolette o a-capo. */
function campo(valore: string): string {
  if (/[;"\n\r]/.test(valore)) {
    return `"${valore.replace(/"/g, '""')}"`
  }
  return valore
}

/** Centesimi → euro con la virgola decimale, senza separatore di migliaia. */
function euro(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function dataItaliana(data: Date | null): string {
  if (!data) return ''
  const gg = String(data.getUTCDate()).padStart(2, '0')
  const mm = String(data.getUTCMonth() + 1).padStart(2, '0')
  return `${gg}/${mm}/${data.getUTCFullYear()}`
}

export function csvRegistroFatture(righe: readonly RigaRegistro[]): string {
  const linee = [INTESTAZIONI.join(';')]

  for (const r of righe) {
    linee.push(
      [
        campo(r.numero),
        campo(dataItaliana(r.data)),
        campo(r.tipo),
        campo(r.cliente),
        campo(r.codiceFiscale ?? ''),
        campo(r.partitaIva ?? ''),
        campo(euro(r.imponibileCents)),
        campo(euro(r.impostaCents)),
        campo(euro(r.totaleCents)),
        campo(r.aliquote.map((a) => `${String(a).replace('.', ',')}%`).join(' ')),
      ].join(';'),
    )
  }

  // A-capo Windows: è il formato che l'Excel italiano si aspetta.
  return linee.join('\r\n')
}

/** Nome file suggerito per il download, per periodo. */
export function nomeFileRegistro(dal: Date, al: Date): string {
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return `registro-fatture_${iso(dal)}_${iso(al)}.csv`
}
