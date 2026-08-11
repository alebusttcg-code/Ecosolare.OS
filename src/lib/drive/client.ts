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
 * **Quota.** Un service account non ha spazio su «Il mio Drive»: creare file
 * lì fallisce con `storageQuotaExceeded` anche se la cartella è condivisa.
 * Funziona in uno di questi modi:
 *  1. radice = Drive condiviso Workspace + SA membro;
 *  2. radice = cartella personale + SA che **impersona** un utente Workspace
 *     (`GOOGLE_DRIVE_DELEGATED_USER`);
 *  3. radice = cartella personale + OAuth dell’utente proprietario
 *     (`GOOGLE_OAUTH_*`, vedi `npm run drive:autorizza`).
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

function oauthUtenteConfigurato(): boolean {
  const c = env()
  return Boolean(
    c.GOOGLE_OAUTH_CLIENT_ID &&
      c.GOOGLE_OAUTH_CLIENT_SECRET &&
      c.GOOGLE_OAUTH_REFRESH_TOKEN,
  )
}

function serviceAccountConfigurata(): boolean {
  const c = env()
  return Boolean(c.GOOGLE_SERVICE_ACCOUNT_EMAIL && c.GOOGLE_SERVICE_ACCOUNT_KEY)
}

export function driveConfigurato(): boolean {
  const c = env()
  return Boolean(c.GOOGLE_DRIVE_ID && (oauthUtenteConfigurato() || serviceAccountConfigurata()))
}

/* -------------------------------------------------------------------------- */
/*  Token di accesso                                                           */
/* -------------------------------------------------------------------------- */

let tokenInCache: { valore: string; scadeIl: number; chiave: string } | undefined

function base64url(dati: Buffer | string): string {
  return Buffer.from(dati).toString('base64url')
}

function chiaveCacheToken(): string {
  const c = env()
  if (oauthUtenteConfigurato()) return `oauth:${c.GOOGLE_OAUTH_REFRESH_TOKEN}`
  return `sa:${c.GOOGLE_SERVICE_ACCOUNT_EMAIL}:${c.GOOGLE_DRIVE_DELEGATED_USER ?? ''}`
}

async function tokenDaOAuth(): Promise<{ valore: string; scadeIl: number }> {
  const c = env()
  const adesso = Math.floor(Date.now() / 1000)
  const risposta = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: c.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: c.GOOGLE_OAUTH_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })
  if (!risposta.ok) {
    throw new Error(`Autenticazione Google (OAuth) fallita (${risposta.status}): ${await risposta.text()}`)
  }
  const dati = (await risposta.json()) as { access_token: string; expires_in: number }
  return { valore: dati.access_token, scadeIl: adesso + dati.expires_in }
}

async function tokenDaServiceAccount(): Promise<{ valore: string; scadeIl: number }> {
  const adesso = Math.floor(Date.now() / 1000)
  const c = env()
  const chiave = c.GOOGLE_SERVICE_ACCOUNT_KEY!.replace(/\\n/g, '\n')

  const claims: Record<string, string | number> = {
    iss: c.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    scope: AMBITO,
    aud: TOKEN_URL,
    iat: adesso,
    exp: adesso + 3600,
  }
  // Delegazione a livello di dominio: i file usano la quota dell’utente, non
  // quella (inesistente) del service account. Serve Workspace + DwD abilitata.
  if (c.GOOGLE_DRIVE_DELEGATED_USER) {
    claims.sub = c.GOOGLE_DRIVE_DELEGATED_USER
  }

  const intestazione = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const corpo = base64url(JSON.stringify(claims))

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
  return { valore: dati.access_token, scadeIl: adesso + dati.expires_in }
}

/**
 * Scambia credenziali con un token di accesso.
 *
 * Preferisce OAuth utente (cartella personale Gmail); altrimenti service
 * account, eventualmente con impersonazione Workspace.
 */
export async function tokenDiAccesso(): Promise<string> {
  const adesso = Math.floor(Date.now() / 1000)
  const chiave = chiaveCacheToken()
  if (tokenInCache && tokenInCache.chiave === chiave && tokenInCache.scadeIl > adesso + 60) {
    return tokenInCache.valore
  }

  if (!driveConfigurato()) throw new DriveNonConfigurato()

  const ottenuto = oauthUtenteConfigurato()
    ? await tokenDaOAuth()
    : await tokenDaServiceAccount()

  tokenInCache = { ...ottenuto, chiave }
  return ottenuto.valore
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
 * PDF e foto — stanno abbondantemente sotto i 5 MB oltre ai quali converrebbe
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

/**
 * Sposta un file nel cestino di Drive.
 *
 * Idempotente: se il file non c’è più (già cestinato o eliminato) non solleva.
 */
/**
 * Sposta un file nel cestino di Drive, o ce lo riporta fuori.
 *
 * Il cestino di Drive non e' il nostro meccanismo di sicurezza — quello e' la
 * riga con `deleted_at` in archivio, che non scade mai (D-017). Qui si tratta
 * solo di togliere il file dalla cartella che le persone sfogliano: lasciarcelo
 * dopo che qualcuno l'ha eliminato dal gestionale renderebbe le due viste
 * incoerenti, ed e' la cartella su Drive quella di cui ci si fida a colpo d'occhio.
 */
async function impostaCestino(fileId: string, nelCestino: boolean): Promise<void> {
  if (!driveConfigurato()) return
  const risposta = await fetch(
    `${API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${await tokenDiAccesso()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ trashed: nelCestino }),
    },
  )
  // 404 significa che il file non c'e' piu': lo stato voluto e' gia' quello.
  if (risposta.ok || risposta.status === 404) return
  const testo = await risposta.text()
  throw new Error(`Drive: aggiornamento cestino fallito (${risposta.status}): ${testo}`)
}

export function cestinaFile(fileId: string): Promise<void> {
  return impostaCestino(fileId, true)
}

export function ripristinaFile(fileId: string): Promise<void> {
  return impostaCestino(fileId, false)
}
