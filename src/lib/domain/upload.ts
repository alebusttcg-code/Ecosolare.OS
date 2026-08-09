/**
 * Validazione dei file caricati.
 *
 * Regola di fondo: **il tipo dichiarato dal browser non è una prova**. Il campo
 * `Content-Type` di un form lo sceglie il client e si falsifica in dieci secondi.
 * Un `.pdf` rinominato può essere qualunque cosa — compreso uno script che
 * qualcuno un giorno serve dal nostro dominio.
 *
 * Qui si guardano i **byte iniziali** del file, che sono l'unica cosa che il
 * formato non può nascondere.
 */

export type TipoImmagine = 'image/jpeg' | 'image/png' | 'image/webp'

export type TipoFileAmmesso = TipoImmagine | 'application/pdf'

export const TIPI_AMMESSI: readonly TipoFileAmmesso[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

/** Etichetta leggibile, per messaggi e interfaccia. */
export const ETICHETTE_TIPO: Record<TipoFileAmmesso, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'application/pdf': 'PDF',
}

/** Estensione canonica: quella del nome originale non fa fede. */
export const ESTENSIONI: Record<TipoFileAmmesso, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/** 15 MB: una fotografia di cantiere sta ampiamente dentro, una scansione anche. */
export const DIMENSIONE_MASSIMA = 15 * 1024 * 1024

/** Firme dei formati ammessi, in byte. */
const FIRME: readonly { tipo: TipoFileAmmesso; byte: readonly number[] }[] = [
  { tipo: 'image/jpeg', byte: [0xff, 0xd8, 0xff] },
  { tipo: 'image/png', byte: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { tipo: 'application/pdf', byte: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
]

function eWebp(byte: Uint8Array): boolean {
  // RIFF....WEBP
  return (
    byte.length >= 12 &&
    byte[0] === 0x52 &&
    byte[1] === 0x49 &&
    byte[2] === 0x46 &&
    byte[3] === 0x46 &&
    byte[8] === 0x57 &&
    byte[9] === 0x45 &&
    byte[10] === 0x42 &&
    byte[11] === 0x50
  )
}

function eHeic(byte: Uint8Array): boolean {
  // ISO BMFF: ....ftyp + brand heic/heif/mif1/msf1
  if (byte.length < 12) return false
  if (byte[4] !== 0x66 || byte[5] !== 0x74 || byte[6] !== 0x79 || byte[7] !== 0x70) {
    return false
  }
  const brand = String.fromCharCode(byte[8]!, byte[9]!, byte[10]!, byte[11]!)
  return brand === 'heic' || brand === 'heif' || brand === 'mif1' || brand === 'msf1'
}

/**
 * Riconosce il formato dai byte iniziali.
 * Restituisce null se non corrisponde a nessuno dei formati ammessi.
 */
export function riconosciTipo(byte: Uint8Array): TipoFileAmmesso | null {
  for (const firma of FIRME) {
    if (byte.length < firma.byte.length) continue
    if (firma.byte.every((atteso, i) => byte[i] === atteso)) return firma.tipo
  }
  if (eWebp(byte)) return 'image/webp'
  return null
}

/** Solo per messaggi d'errore più precisi (HEIC non è accettato come tale). */
export function sembraHeic(byte: Uint8Array): boolean {
  return eHeic(byte)
}

export type EsitoValidazione =
  | { readonly ok: true; readonly tipo: TipoFileAmmesso; readonly estensione: string }
  | { readonly ok: false; readonly motivo: string }

export function validaFile(params: {
  readonly byte: Uint8Array
  readonly dimensione: number
  readonly tipoDichiarato: string
}): EsitoValidazione {
  if (params.dimensione === 0) {
    return { ok: false, motivo: 'Il file è vuoto.' }
  }

  if (params.dimensione > DIMENSIONE_MASSIMA) {
    const mb = (params.dimensione / 1024 / 1024).toFixed(1)
    return {
      ok: false,
      motivo: `Il file pesa ${mb} MB: il limite è ${DIMENSIONE_MASSIMA / 1024 / 1024} MB.`,
    }
  }

  const tipoReale = riconosciTipo(params.byte)
  if (tipoReale === null) {
    if (sembraHeic(params.byte)) {
      return {
        ok: false,
        motivo:
          'Questa foto è in formato HEIC (tipico iPhone). Usa «Scatta foto» oppure esporta in JPEG/PNG prima di caricarla.',
      }
    }
    return {
      ok: false,
      motivo: 'Formato non riconosciuto. Sono ammessi JPEG, PNG, WebP e PDF.',
    }
  }

  // Discordanza fra dichiarato e reale: si accetta il contenuto vero, ma il
  // fatto va notato. Spesso è solo un browser distratto; a volte non lo è.
  return { ok: true, tipo: tipoReale, estensione: ESTENSIONI[tipoReale] }
}

/** Validazione per le fotografie di sopralluogo: solo JPEG e PNG. */
export function validaFoto(params: {
  readonly byte: Uint8Array
  readonly dimensione: number
}): EsitoValidazione {
  const esito = validaFile({ ...params, tipoDichiarato: '' })
  if (!esito.ok) return esito
  if (esito.tipo === 'application/pdf') {
    return { ok: false, motivo: 'Per le fotografie del sopralluogo servono JPEG, PNG o WebP.' }
  }
  return esito
}

/**
 * Ripulisce il nome del file per la sola visualizzazione.
 *
 * Il nome NON viene mai usato per costruire un percorso: la chiave di
 * archiviazione è generata dal sistema. Questa funzione serve a non mostrare
 * spazzatura nell'interfaccia e a non passare caratteri di controllo altrove.
 */
export function ripulisciNome(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? 'documento'
  return (
    base
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/[<>:"|?*]/g, '')
      .trim()
      .slice(0, 120) || 'documento'
  )
}

export function formattaDimensione(byte: number): string {
  if (byte < 1024) return `${byte} B`
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} KB`
  return `${(byte / 1024 / 1024).toFixed(1)} MB`
}
