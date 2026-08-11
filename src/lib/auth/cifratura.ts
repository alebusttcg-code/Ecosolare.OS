import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '@/env'

/**
 * Cifratura dei segreti che devono poter tornare in chiaro.
 *
 * Serve per una cosa sola: il segreto TOTP. A differenza di una password, non
 * si può conservare come impronta — per verificare un codice bisogna
 * ricalcolarlo, e per ricalcolarlo serve il segreto originale.
 *
 * Il che significa che chi ottiene una copia del database ottiene anche il
 * secondo fattore di tutti, e la verifica in due passaggi smette di aggiungere
 * qualcosa. Cifrarlo con una chiave che sta nell'ambiente e non nel database
 * separa le due cose: per generare codici servono entrambi.
 *
 * AES-256-GCM e non CBC: GCM autentica il testo cifrato, quindi una riga
 * manomessa fallisce la decifratura invece di produrre un segreto diverso.
 */

const ALGORITMO = 'aes-256-gcm'
const LUNGHEZZA_IV = 12
const LUNGHEZZA_TAG = 16

export class ChiaveMancante extends Error {
  constructor() {
    super(
      'MFA_SECRET_KEY non configurata: la verifica in due passaggi non può essere attivata.',
    )
    this.name = 'ChiaveMancante'
  }
}

export function chiaveCifraturaConfigurata(): boolean {
  const chiave = env().MFA_SECRET_KEY
  return Boolean(chiave && /^[0-9a-fA-F]{64}$/.test(chiave))
}

function chiave(): Buffer {
  const valore = env().MFA_SECRET_KEY
  if (!valore || !/^[0-9a-fA-F]{64}$/.test(valore)) throw new ChiaveMancante()
  return Buffer.from(valore, 'hex')
}

/**
 * Restituisce `iv.tag.testoCifrato`, tutto in base64url.
 *
 * L'IV è nuovo a ogni chiamata: riusarlo con GCM non indebolisce un po' la
 * cifratura, la annulla.
 */
export function cifra(testo: string): string {
  const iv = randomBytes(LUNGHEZZA_IV)
  const cifratore = createCipheriv(ALGORITMO, chiave(), iv)
  const cifrato = Buffer.concat([cifratore.update(testo, 'utf8'), cifratore.final()])
  const tag = cifratore.getAuthTag()

  return [iv.toString('base64url'), tag.toString('base64url'), cifrato.toString('base64url')].join(
    '.',
  )
}

/**
 * Solleva se la chiave è cambiata o il testo è stato manomesso.
 *
 * Non restituisce `null`: un segreto TOTP che si decifra «a metà» produrrebbe
 * codici sbagliati e un utente convinto di avere l'app configurata male.
 * Meglio un errore netto.
 */
export function decifra(pacchetto: string): string {
  const parti = pacchetto.split('.')
  if (parti.length !== 3) throw new Error('Testo cifrato non valido.')

  const [ivB64, tagB64, cifratoB64] = parti
  const iv = Buffer.from(ivB64!, 'base64url')
  const tag = Buffer.from(tagB64!, 'base64url')
  if (iv.length !== LUNGHEZZA_IV || tag.length !== LUNGHEZZA_TAG) {
    throw new Error('Testo cifrato non valido.')
  }

  const decifratore = createDecipheriv(ALGORITMO, chiave(), iv)
  decifratore.setAuthTag(tag)

  return Buffer.concat([
    decifratore.update(Buffer.from(cifratoB64!, 'base64url')),
    decifratore.final(),
  ]).toString('utf8')
}
