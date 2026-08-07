/** Valori iniziali per il form indirizzo (lista lead, modifica, …). */
export interface IndirizzoIniziale {
  readonly streetType?: string
  readonly streetName?: string
  readonly houseNumber?: string
  readonly province?: string
  readonly city?: string
  readonly postalCode?: string
}

/** Tipologie toponomastiche italiane più comuni. */
export const TIPI_VIA = [
  'Via',
  'Viale',
  'Corso',
  'Piazza',
  'Piazzale',
  'Largo',
  'Vicolo',
  'Strada',
  'Località',
  'Contrada',
  'Traversa',
  'Lungomare',
  'Circonvallazione',
  'Galleria',
  'Salita',
  'Borgo',
  'Frazione',
] as const

/** Compone la riga indirizzo nel formato usato in anagrafica e documenti. */
export function componeIndirizzo(params: {
  tipoVia?: string | null
  nomeVia?: string | null
  civico?: string | null
}): string | null {
  const tipo = params.tipoVia?.trim()
  const nome = params.nomeVia?.trim()
  const civico = params.civico?.trim()
  if (!tipo || !nome) return null
  return civico ? `${tipo} ${nome}, ${civico}` : `${tipo} ${nome}`
}

/**
 * Tenta di rileggere tipo / nome / civico da una riga composta.
 * Se il formato non è riconosciuto, tutto finisce in `nomeVia`.
 */
export function scomponiIndirizzo(riga: string | null | undefined): {
  tipoVia: string
  nomeVia: string
  civico: string
} {
  const grezza = (riga ?? '').trim()
  if (!grezza) return { tipoVia: '', nomeVia: '', civico: '' }

  const ordinati = [...TIPI_VIA].sort((a, b) => b.length - a.length)
  const tipo = ordinati.find((t) => grezza === t || grezza.startsWith(`${t} `))
  if (!tipo) return { tipoVia: '', nomeVia: grezza, civico: '' }

  const resto = grezza.slice(tipo.length).trim()
  const match = resto.match(/^(.*),\s*([^,]+)$/)
  if (match) {
    return {
      tipoVia: tipo,
      nomeVia: match[1]!.trim(),
      civico: match[2]!.trim(),
    }
  }
  return { tipoVia: tipo, nomeVia: resto, civico: '' }
}
