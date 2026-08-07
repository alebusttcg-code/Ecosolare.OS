import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type BinaryLike,
  type ScryptOptions,
} from 'node:crypto'

/**
 * Impronte delle password.
 *
 * Perché scrypt e non Argon2id, che sarebbe la scelta migliore in assoluto:
 * Argon2 in Node richiede un modulo nativo, e un binario compilato in più nella
 * catena di build è una dipendenza che può rompersi al deploy. `node:crypto`
 * offre scrypt, che è memory-hard e progettato esattamente per questo uso.
 * La differenza pratica rispetto ad Argon2id, ai parametri qui sotto, è
 * trascurabile davanti al rischio di un deploy che non parte.
 *
 * Se un giorno si passa ad Argon2: il formato dell'impronta porta il nome
 * dell'algoritmo davanti, quindi le due famiglie possono convivere e le vecchie
 * password si riscrivono al primo accesso riuscito.
 */

/**
 * `promisify` non conserva l'overload con le opzioni, che è proprio quello che
 * serve qui: senza i parametri espliciti scrypt userebbe i suoi valori di
 * default, molto più deboli.
 */
function scrypt(
  password: BinaryLike,
  sale: BinaryLike,
  lunghezza: number,
  opzioni: ScryptOptions,
): Promise<Buffer> {
  return new Promise((risolvi, rifiuta) => {
    scryptCallback(password, sale, lunghezza, opzioni, (errore, derivata) => {
      if (errore) rifiuta(errore)
      else risolvi(derivata)
    })
  })
}

/** 2^15 iterazioni: ~100 ms per verifica su hardware da server. */
const COSTO = 32_768
const BLOCCO = 8
const PARALLELISMO = 1
const LUNGHEZZA = 64
/** scrypt richiede 128 * N * r byte; il default di Node (32 MB) non basta. */
const MEMORIA_MAX = 128 * COSTO * BLOCCO * 2

/**
 * Nessuna policy di complessità (lunghezza minima, maiuscole, numeri…):
 * produce password prevedibili e frustrazione senza guadagno reale qui.
 * Resta solo il rifiuto del vuoto e un tetto tecnico contro abusi di CPU
 * su scrypt (una password di megabyte occuperebbe il server a ogni login).
 */
export function validaPassword(password: string): string | null {
  if (password.length === 0) {
    return 'Inserire una password.'
  }
  if (password.length > 200) {
    return 'La password non può superare i 200 caratteri.'
  }
  return null
}

export async function calcolaImpronta(password: string): Promise<string> {
  const sale = randomBytes(16)
  const derivata = await scrypt(password.normalize('NFKC'), sale, LUNGHEZZA, {
    N: COSTO,
    r: BLOCCO,
    p: PARALLELISMO,
    maxmem: MEMORIA_MAX,
  })

  return [
    'scrypt',
    COSTO,
    BLOCCO,
    PARALLELISMO,
    sale.toString('base64'),
    derivata.toString('base64'),
  ].join('$')
}

/**
 * Verifica in tempo costante rispetto al contenuto dell'impronta.
 *
 * Non solleva mai su un'impronta malformata: restituisce `false`. Un errore qui
 * distinguerebbe «utente inesistente» da «impronta corrotta», che è
 * esattamente l'informazione che non vogliamo dare a chi prova a entrare.
 */
export async function verificaPassword(
  password: string,
  impronta: string,
): Promise<boolean> {
  const parti = impronta.split('$')
  if (parti.length !== 6 || parti[0] !== 'scrypt') return false

  const [, costo, blocco, parallelismo, sale, atteso] = parti
  const N = Number(costo)
  const r = Number(blocco)
  const p = Number(parallelismo)
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false
  // I parametri arrivano dal database, non dall'utente, ma se una riga fosse
  // manomessa un N enorme bloccherebbe il processo.
  if (N < 1024 || N > 1_048_576 || r < 1 || r > 32 || p < 1 || p > 16) return false

  const attesoBuffer = Buffer.from(atteso!, 'base64')
  if (attesoBuffer.length === 0) return false

  try {
    const derivata = await scrypt(
      password.normalize('NFKC'),
      Buffer.from(sale!, 'base64'),
      attesoBuffer.length,
      { N, r, p, maxmem: 128 * N * r * 2 },
    )
    return timingSafeEqual(derivata, attesoBuffer)
  } catch {
    return false
  }
}

/**
 * Password iniziale generata dal sistema, da comunicare alla persona.
 *
 * Alfabeto senza `0/O/1/l/I`: queste password vengono lette ad alta voce o
 * copiate a mano, e una `l` scambiata per `1` è una chiamata di assistenza.
 */
const ALFABETO = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generaPasswordIniziale(lunghezza = 16): string {
  const byte = randomBytes(lunghezza * 2)
  let out = ''
  // Scarto per rifiuto: il modulo puro darebbe ai primi caratteri
  // dell'alfabeto una probabilità leggermente più alta.
  const soglia = 256 - (256 % ALFABETO.length)
  for (const b of byte) {
    if (out.length === lunghezza) break
    if (b >= soglia) continue
    out += ALFABETO[b % ALFABETO.length]
  }
  return out.length === lunghezza ? out : out + generaPasswordIniziale(lunghezza - out.length)
}
