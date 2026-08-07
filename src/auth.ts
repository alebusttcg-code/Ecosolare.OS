import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { getDb } from '@/db'
import { sessions } from '@/db/schema'

/**
 * Sessioni.
 *
 * Perché scritte a mano invece di usare Auth.js: il provider `Credentials` di
 * Auth.js non è compatibile con `strategy: 'database'`, obbliga ai JWT. Un JWT
 * non è revocabile, quindi un utente disattivato resterebbe dentro fino alla
 * scadenza — e la revoca immediata è un requisito (US-01.1), non una
 * preferenza. Fra riscrivere questo file e rinunciare alla revoca, questo file.
 *
 * Due regole tengono in piedi tutto il resto:
 *
 *  1. Nel cookie c'è un valore casuale; nel database c'è solo la sua impronta
 *     SHA-256. Un dump del database non permette di impersonare nessuno.
 *  2. La sessione dice solo CHI è l'utente. Ruolo, capacità e stato attivo si
 *     rileggono dal database a ogni richiesta (`src/lib/auth/session.ts`):
 *     una revoca ha effetto al colpo successivo.
 */

const COOKIE = 'ecosolare.sessione'

/** Inattività oltre la quale la sessione non vale più. */
const DURATA_MS = 12 * 60 * 60 * 1000

/**
 * Il cookie dura più della sessione: l'autorità sulla scadenza è la riga nel
 * database, che è l'unica revocabile. Un cookie più corto scollegherebbe
 * l'utente senza che nessuno possa impedirlo o prolungarlo.
 */
const COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60

function impronta(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Apre una sessione e imposta il cookie.
 *
 * Da chiamare solo da una server action o da un route handler: altrove Next non
 * permette di scrivere cookie.
 */
export async function creaSessione(params: {
  userId: string
  ipAddress?: string | undefined
  userAgent?: string | undefined
}): Promise<void> {
  const token = randomBytes(32).toString('base64url')

  await getDb()
    .insert(sessions)
    .values({
      sessionToken: impronta(token),
      userId: params.userId,
      expires: new Date(Date.now() + DURATA_MS),
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent?.slice(0, 400) ?? null,
    })

  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_S,
  })
}

/**
 * L'id dell'utente collegato, o `null`.
 *
 * Prolunga la sessione quando è passata oltre metà della sua durata: senza,
 * chi lavora tutto il giorno verrebbe scollegato a metà di un preventivo.
 * Si aggiorna solo la riga, mai il cookie: questa funzione viene chiamata
 * anche durante il rendering, dove scrivere cookie non è permesso.
 */
export async function sessioneCorrente(): Promise<{ userId: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null

  const chiave = impronta(token)
  const adesso = new Date()

  const sessione = await getDb().query.sessions.findFirst({
    where: and(eq(sessions.sessionToken, chiave), gt(sessions.expires, adesso)),
    columns: { userId: true, expires: true },
  })
  if (!sessione) return null

  const restante = sessione.expires.getTime() - adesso.getTime()
  if (restante < DURATA_MS / 2) {
    await getDb()
      .update(sessions)
      .set({ expires: new Date(adesso.getTime() + DURATA_MS) })
      .where(eq(sessions.sessionToken, chiave))
  }

  return { userId: sessione.userId }
}

/** Chiude la sessione corrente: riga cancellata e cookie rimosso. */
export async function chiudiSessione(): Promise<void> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value

  if (token) {
    await getDb().delete(sessions).where(eq(sessions.sessionToken, impronta(token)))
  }
  store.delete(COOKIE)
}

/**
 * Chiude tutte le sessioni di un utente.
 *
 * Serve dopo un cambio password e dopo una disattivazione: senza, chi ha rubato
 * la password resta collegato proprio mentre il legittimo proprietario crede di
 * avere risolto.
 */
export async function chiudiSessioniDi(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId))
}

/** Sessioni scadute: nessuno le userà più, ma restano finché non si cancellano. */
export async function eliminaSessioniScadute(): Promise<number> {
  const eliminate = await getDb()
    .delete(sessions)
    .where(lt(sessions.expires, new Date()))
    .returning({ token: sessions.sessionToken })
  return eliminate.length
}
