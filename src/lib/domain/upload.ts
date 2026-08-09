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

export type TipoImmagine =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif'

export type TipoFileAmmesso = TipoImmagine | 'application/pdf'

export const TIPI_AMMESSI: readonly TipoFileAmmesso[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]

/** Etichetta leggibile, per messaggi e interfaccia. */
export const ETICHETTE_TIPO: Record<TipoFileAmmesso, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/heic': 'HEIC',
  'image/heif': 'HEIF',
  'application/pdf': 'PDF',
}

/** Estensione canonica: quella del nome originale non fa fede. */
export const ESTENSIONI: Record<TipoFileAmmesso, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}

/** 15 MB: limite applicativo sul contenuto (validazione server). */
export const DIMENSIONE_MASSIMA = 15 * 1024 * 1024

/**
 * Limite del corpo HTTP delle Server Action, allineato al tetto Vercel (~4.5 MB).
 * Le foto dalla galleria vanno compresse sotto questa soglia prima dell'upload.
 */
export const DIMENSIONE_MASSIMA_UPLOAD = 4 * 1024 * 1024

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

/** Brand ISO-BMFF tipici delle foto Apple / HEIF. */
function tipoHeif(byte: Uint8Array): 'image/heic' | 'image/heif' | null {
  if (byte.length < 12) return null
  if (byte[4] !== 0x66 || byte[5] !== 0x74 || byte[6] !== 0x79 || byte[7] !== 0x70) {
    return null
  }
  const brand = String.fromCharCode(byte[8]!, byte[9]!, byte[10]!, byte[11]!)
  if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx') {
    return 'image/heic'
  }
  if (brand === 'heif' || brand === 'mif1' || brand === 'msf1') {
    return 'image/heif'
  }
  return null
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
  const heif = tipoHeif(byte)
  if (heif) return heif
  return null
}

/** True se i byte sembrano un contenitore HEIC/HEIF (anche se non accettato). */
export function sembraHeic(byte: Uint8Array): boolean {
  return tipoHeif(byte) !== null
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
    return {
      ok: false,
      motivo: 'Formato non riconosciuto. Sono ammessi JPEG, PNG, WebP, HEIC/HEIF e PDF.',
    }
  }

  // Discordanza fra dichiarato e reale: si accetta il contenuto vero, ma il
  // fatto va notato. Spesso è solo un browser distratto; a volte non lo è.
  return { ok: true, tipo: tipoReale, estensione: ESTENSIONI[tipoReale] }
}

/** Validazione per le fotografie di sopralluogo: immagini, non PDF. */
export function validaFoto(params: {
  readonly byte: Uint8Array
  readonly dimensione: number
}): EsitoValidazione {
  const esito = validaFile({ ...params, tipoDichiarato: '' })
  if (!esito.ok) return esito
  if (esito.tipo === 'application/pdf') {
    return {
      ok: false,
      motivo: 'Per le fotografie del sopralluogo servono JPEG, PNG, WebP o HEIC.',
    }
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
