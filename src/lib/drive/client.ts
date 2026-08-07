import { createSign } from 'node:crypto'
import { env } from '@/env'

/**
 * Client minimo per Google Drive.
 *
 * Perché scritto a mano invece di usare `googleapis`: quel pacchetto porta
 * dentro l'intero catalogo delle API di Google — decine di megabyte per usarne
 * due chiamate. Qui servono «crea cartella» e «carica file», che sono due
 * richieste HTTP, e l'autenticazione è un JWT firmato con una chiave RSA che
 * `node:crypto` sa già firmare.
 *
 * **Serve una radice con permesso di scrittura.** In Workspace è un Drive
 * condiviso; con Gmail personale basta una cartella in «Il mio Drive» condivisa
 * con il service account come Editor. Senza `GOOGLE_DRIVE_ID` che punta a
 * quella radice, ogni creazione fallisce con «storage quota exceeded».
 */

const AMBITO = 'https://www.googleapis.com/auth/drive'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export class DriveNonConfigurato extends Error {
  constructor() {
    super('Google Drive non è configurato: mancano le variabili GOOGLE_DRIVE_*.')
    this.name = 'DriveNonConfigurato'
  }
}

export function driveConfigurato(): boolean {
  const c = env()
  return Boolean(
    c.GOOGLE_DRIVE_ID && c.GOOGLE_SERVICE_ACCOUNT_EMAIL && c.GOOGLE_SERVICE_ACCOUNT_KEY,
  )
}

/* -------------------------------------------------------------------------- */
/*  Token di accesso                                                           */
/* -------------------------------------------------------------------------- */

let tokenInCache: { valore: string; scadeIl: number } | undefined

function base64url(dati: Buffer | string): string {
  return Buffer.from(dati).toString('base64url')
}

/**
 * Scambia un JWT firmato con un token di accesso.
 *
 * Il token dura un'ora e viene riusato: rifirmare un JWT a ogni chiamata
 * aggiungerebbe un giro di rete e una firma RSA per ogni file caricato.
 * Si rinnova con un minuto di anticipo, perché un token che scade a metà
 * di una richiesta è indistinguibile da una credenziale sbagliata.
 */
async function tokenDiAccesso(): Promise<string> {
  const adesso = Math.floor(Date.now() / 1000)
  if (tokenInCache && tokenInCache.scadeIl > adesso + 60) return tokenInCache.valore

  const c = env()
  if (!driveConfigurato()) throw new DriveNonConfigurato()

  // Nelle variabili d'ambiente gli a capo della chiave sono scritti come «\n»:
  // senza questa sostituzione la chiave non è leggibile e l'errore non lo dice.
  const chiave = c.GOOGLE_SERVICE_ACCOUNT_KEY!.replace(/\\n/g, '\n')

  const intestazione = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const corpo = base64url(
    JSON.stringify({
      iss: c.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: AMBITO,
      aud: TOKEN_URL,
      iat: adesso,
      exp: adesso + 3600,
    }),
  )

  const firma = createSign('RSA-SHA256')
  firma.update(`${intestazione}.${corpo}`)
  const jwt = `${intestazione}.${corpo}.${base64url(firma.sign(chiave))}`

  const risposta = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!risposta.ok) {
    throw new Error(`Autenticazione Google fallita (${risposta.status}): ${await risposta.text()}`)
  }

  const dati = (await risposta.json()) as { access_token: string; expires_in: number }
  tokenInCache = { valore: dati.access_token, scadeIl: adesso + dati.expires_in }
  return dati.access_token
}

async function chiama(url: string, init: RequestInit): Promise<Response> {
  const token = await tokenDiAccesso()
  const risposta = await fetch(url, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}` },
  })

  if (!risposta.ok) {
    // Il corpo dell'errore di Drive dice quasi sempre cosa manca (permessi,
    // cartella inesistente, quota): perderlo costa un'ora di indagine.
    throw new Error(`Google Drive ha risposto ${risposta.status}: ${await risposta.text()}`)
  }
  return risposta
}

/* -------------------------------------------------------------------------- */
/*  Operazioni                                                                 */
/* -------------------------------------------------------------------------- */

const MIME_CARTELLA = 'application/vnd.google-apps.folder'

/** Apici singoli e backslash vanno protetti o la query viene interpretata male. */
function perQuery(valore: string): string {
  return valore.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/**
 * Crea una cartella, oppure restituisce quella che esiste già con lo stesso
 * nome nello stesso genitore.
 *
 * La ricerca prima della creazione non è un'ottimizzazione: Drive accetta
 * volentieri due cartelle sorelle con lo stesso nome, e due cartelle «Rossi
 * Mario» sono peggio di nessuna. La deduplica dell'outbox copre il caso del
 * doppio evento; questa copre la cartella creata a mano da una persona.
 */
export async function creaCartella(params: {
  nome: string
  genitoreId?: string
}): Promise<string> {
  const c = env()
  const genitore = params.genitoreId ?? c.GOOGLE_DRIVE_ID!

  const query = [
    `name = '${perQuery(params.nome)}'`,
    `'${perQuery(genitore)}' in parents`,
    `mimeType = '${MIME_CARTELLA}'`,
    'trashed = false',
  ].join(' and ')

  const trovate = await chiama(
    `${API}/files?${new URLSearchParams({
      q: query,
      fields: 'files(id)',
      // allDrives copre sia Drive condivisi Workspace sia cartelle Gmail condivise
      // con il service account — corpora=drive richiede un id di Drive condiviso.
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      corpora: 'allDrives',
    })}`,
    { method: 'GET' },
  )

  const esistenti = (await trovate.json()) as { files?: { id: string }[] }
  const gia = esistenti.files?.[0]?.id
  if (gia) return gia

  const creata = await chiama(`${API}/files?supportsAllDrives=true&fields=id`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: params.nome,
      mimeType: MIME_CARTELLA,
      parents: [genitore],
    }),
  })

  return ((await creata.json()) as { id: string }).id
}

/**
 * Carica un file dentro una cartella.
 *
 * Caricamento multipart in una sola richiesta: i documenti di cui si parla —
 * PDF e foto — stanno abbondantemente sotto i 5 MB oltre i quali converrebbe
 * il caricamento a blocchi.
 */
export async function caricaFile(params: {
  nome: string
  mimeType: string
  contenuto: Uint8Array
  cartellaId: string
}): Promise<string> {
  const confine = `ecosolare-${Date.now().toString(36)}`
  const metadati = JSON.stringify({ name: params.nome, parents: [params.cartellaId] })

  const corpo = Buffer.concat([
    Buffer.from(
      `--${confine}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${metadati}\r\n` +
        `--${confine}\r\ncontent-type: ${params.mimeType}\r\n\r\n`,
    ),
    Buffer.from(params.contenuto),
    Buffer.from(`\r\n--${confine}--`),
  ])

  const risposta = await chiama(
    `${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id`,
    {
      method: 'POST',
      headers: { 'content-type': `multipart/related; boundary=${confine}` },
      body: corpo,
    },
  )

  return ((await risposta.json()) as { id: string }).id
}
