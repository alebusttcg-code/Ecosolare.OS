import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Codici a sei cifre per la verifica in due passaggi (TOTP, RFC 6238).
 *
 * Scritto a mano e non preso da una libreria per lo stesso motivo del client
 * Drive: l'algoritmo è un HMAC-SHA1 su un contatore, cioè quindici righe, e
 * `node:crypto` sa già fare tutto il lavoro difficile. Una dipendenza in più
 * nella catena di autenticazione è una superficie in più da fidarsi.
 *
 * Modulo puro: nessun database, nessun orologio implicito — il tempo arriva
 * come parametro. È ciò che permette di provarlo contro i vettori ufficiali.
 */

/** Passo temporale standard: ogni codice vale trenta secondi. */
export const PASSO_SECONDI = 30

const CIFRE = 6

/**
 * Quanti passi prima e dopo si accettano.
 *
 * Uno solo: copre l'orologio del telefono leggermente fuori fase e i secondi
 * che passano fra il momento in cui si legge il codice e quello in cui si
 * preme invio. Allargare la finestra allunga proporzionalmente il tempo in cui
 * un codice intercettato resta valido.
 */
const TOLLERANZA_PASSI = 1

/* -------------------------------------------------------------------------- */
/*  Base32 — l'alfabeto con cui le app di autenticazione leggono il segreto     */
/* -------------------------------------------------------------------------- */

const ALFABETO32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Codifica(dati: Buffer): string {
  let bit = 0
  let valore = 0
  let out = ''

  for (const byte of dati) {
    valore = (valore << 8) | byte
    bit += 8
    while (bit >= 5) {
      out += ALFABETO32[(valore >>> (bit - 5)) & 31]
      bit -= 5
    }
  }
  if (bit > 0) out += ALFABETO32[(valore << (5 - bit)) & 31]

  return out
}

export function base32Decodifica(testo: string): Buffer {
  // Gli spazi ci sono perché il segreto viene mostrato a gruppi di quattro:
  // se qualcuno lo ricopia con gli spazi, deve funzionare lo stesso.
  const pulito = testo.replace(/[\s=]/g, '').toUpperCase()

  let bit = 0
  let valore = 0
  const byte: number[] = []

  for (const carattere of pulito) {
    const indice = ALFABETO32.indexOf(carattere)
    if (indice === -1) throw new Error('Segreto non valido.')
    valore = (valore << 5) | indice
    bit += 5
    if (bit >= 8) {
      byte.push((valore >>> (bit - 8)) & 255)
      bit -= 8
    }
  }

  return Buffer.from(byte)
}

/* -------------------------------------------------------------------------- */
/*  Segreto e codici                                                           */
/* -------------------------------------------------------------------------- */

/** 20 byte: la lunghezza raccomandata da RFC 4226 per HMAC-SHA1. */
export function generaSegretoTotp(): string {
  return base32Codifica(randomBytes(20))
}

/** Il passo temporale corrispondente a un istante. */
export function passoDi(adesso: Date): number {
  return Math.floor(adesso.getTime() / 1000 / PASSO_SECONDI)
}

/**
 * Il codice valido per un dato passo.
 *
 * `truncate` dinamico dell'RFC: si prendono quattro byte a partire da un offset
 * ricavato dall'ultimo nibble, si azzera il bit di segno e si tengono le ultime
 * sei cifre decimali.
 */
export function codicePerPasso(segretoBase32: string, passo: number): string {
  const chiave = base32Decodifica(segretoBase32)

  const contatore = Buffer.alloc(8)
  contatore.writeUInt32BE(Math.floor(passo / 2 ** 32), 0)
  contatore.writeUInt32BE(passo >>> 0, 4)

  const digest = createHmac('sha1', chiave).update(contatore).digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const troncato =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff)

  return String(troncato % 10 ** CIFRE).padStart(CIFRE, '0')
}

export interface EsitoVerifica {
  readonly valido: boolean
  /**
   * Il passo consumato. Va conservato: **un codice non si accetta due volte**.
   * Senza, chi legge il codice sopra la spalla ha trenta secondi per usarlo.
   */
  readonly passo: number | null
}

export function verificaCodiceTotp(params: {
  segretoBase32: string
  codice: string
  adesso: Date
  /** L'ultimo passo già usato da questo utente, se c'è. */
  ultimoPassoUsato?: number | null
}): EsitoVerifica {
  const fornito = params.codice.replace(/\s/g, '')
  if (!/^\d{6}$/.test(fornito)) return { valido: false, passo: null }

  const corrente = passoDi(params.adesso)

  for (let scarto = -TOLLERANZA_PASSI; scarto <= TOLLERANZA_PASSI; scarto += 1) {
    const passo = corrente + scarto

    // Riuso: il codice è giusto ma è già stato speso.
    if (params.ultimoPassoUsato != null && passo <= params.ultimoPassoUsato) continue

    const atteso = codicePerPasso(params.segretoBase32, passo)
    if (confrontoCostante(atteso, fornito)) return { valido: true, passo }
  }

  return { valido: false, passo: null }
}

function confrontoCostante(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}

/* -------------------------------------------------------------------------- */
/*  Presentazione                                                              */
/* -------------------------------------------------------------------------- */

/**
 * L'indirizzo `otpauth://` che le app di autenticazione capiscono.
 *
 * Su telefono si può toccare e l'app si configura da sola; su computer si
 * inserisce il segreto a mano.
 */
export function uriOtpauth(params: {
  segretoBase32: string
  email: string
  emittente?: string
}): string {
  const emittente = params.emittente ?? 'EcoSolare OS'
  const etichetta = `${emittente}:${params.email}`

  const parametri = new URLSearchParams({
    secret: params.segretoBase32,
    issuer: emittente,
    algorithm: 'SHA1',
    digits: String(CIFRE),
    period: String(PASSO_SECONDI),
  })

  return `otpauth://totp/${encodeURIComponent(etichetta)}?${parametri.toString()}`
}

/** Il segreto a gruppi di quattro: si ricopia a mano senza perdere il segno. */
export function segretoLeggibile(segretoBase32: string): string {
  return segretoBase32.replace(/(.{4})/g, '$1 ').trim()
}

/* -------------------------------------------------------------------------- */
/*  Codici di recupero                                                         */
/* -------------------------------------------------------------------------- */

/** Alfabeto senza caratteri che si confondono: vengono trascritti a mano. */
const ALFABETO_RECUPERO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const NUMERO_CODICI_RECUPERO = 10

/**
 * Codici usa e getta per quando il telefono si perde.
 *
 * Senza, perdere il telefono significa restare chiusi fuori dal proprio
 * gestionale e dipendere da un altro amministratore — che in un'azienda di
 * cinque persone può benissimo essere in ferie.
 */
export function generaCodiciRecupero(quanti = NUMERO_CODICI_RECUPERO): string[] {
  const codici: string[] = []
  for (let i = 0; i < quanti; i += 1) {
    let codice = ''
    const byte = randomBytes(16)
    const soglia = 256 - (256 % ALFABETO_RECUPERO.length)
    for (const b of byte) {
      if (codice.length === 10) break
      if (b >= soglia) continue
      codice += ALFABETO_RECUPERO[b % ALFABETO_RECUPERO.length]
    }
    // In pratica non capita mai, ma un codice corto sarebbe più debole.
    if (codice.length < 10) {
      i -= 1
      continue
    }
    codici.push(`${codice.slice(0, 5)}-${codice.slice(5)}`)
  }
  return codici
}

/** Forma canonica: maiuscolo, senza trattini né spazi. */
export function normalizzaCodiceRecupero(codice: string): string {
  return codice.replace(/[\s-]/g, '').toUpperCase()
}
