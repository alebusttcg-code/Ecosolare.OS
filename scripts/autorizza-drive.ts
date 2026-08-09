/**
 * Ottiene un refresh token OAuth per scrivere nella cartella Drive personale.
 *
 * Serve quando GOOGLE_DRIVE_ID punta a «Il mio Drive» (non a un Drive
 * condiviso): il service account da solo non ha quota.
 *
 * Prerequisiti (una tantum in Google Cloud Console):
 *  1. APIs & Services → Credentials → Create credentials → OAuth client ID
 *  2. Tipo: «Desktop app»
 *  3. Copia client_id e client_secret in .env.local
 *
 * Poi:
 *   npm run drive:autorizza
 *
 * Apri l’URL, accedi con l’account proprietario di «EcoSolare OS», autorizza.
 * Lo script stampa GOOGLE_OAUTH_REFRESH_TOKEN da mettere in .env.local e Vercel.
 */
import { createServer } from 'node:http'
import { env } from '../src/env'

const AMBITO = 'https://www.googleapis.com/auth/drive'
const REDIRECT = 'http://127.0.0.1:53682/callback'
const PORTA = 53682

async function main(): Promise<void> {
  const c = env()
  if (!c.GOOGLE_OAUTH_CLIENT_ID || !c.GOOGLE_OAUTH_CLIENT_SECRET) {
    console.error(
      'Imposta prima GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET in .env.local\n' +
        '(OAuth client tipo «Desktop app» in Google Cloud Console).',
    )
    process.exit(1)
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', c.GOOGLE_OAUTH_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', AMBITO)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  console.log('\n1. Apri questo URL nel browser (account proprietario della cartella):\n')
  console.log(authUrl.toString())
  console.log('\n2. Autorizza EcoSolare OS. Attendo il redirect…\n')

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', REDIRECT)
        if (url.pathname !== '/callback') {
          res.writeHead(404)
          res.end()
          return
        }
        const errore = url.searchParams.get('error')
        const autorizzazione = url.searchParams.get('code')
        if (errore || !autorizzazione) {
          res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
          res.end(`<p>Autorizzazione non riuscita: ${errore ?? 'codice assente'}</p>`)
          server.close()
          reject(new Error(errore ?? 'Codice OAuth assente'))
          return
        }
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end('<p>Autorizzazione ok. Puoi chiudere questa scheda e tornare al terminale.</p>')
        server.close()
        resolve(autorizzazione)
      } catch (e) {
        reject(e)
      }
    })
    server.listen(PORTA, '127.0.0.1')
    server.on('error', reject)
  })

  const risposta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: c.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: 'authorization_code',
    }),
  })

  if (!risposta.ok) {
    console.error('Scambio codice fallito:', await risposta.text())
    process.exit(1)
  }

  const dati = (await risposta.json()) as { refresh_token?: string; access_token?: string }
  if (!dati.refresh_token) {
    console.error(
      'Google non ha restituito un refresh_token. Riprova: nello script usiamo prompt=consent;\n' +
        'se hai già autorizzato in passato, revoca l’accesso su https://myaccount.google.com/permissions e riesegui.',
    )
    process.exit(1)
  }

  console.log('Metti queste righe in .env.local (e su Vercel):\n')
  console.log(`GOOGLE_OAUTH_CLIENT_ID=${c.GOOGLE_OAUTH_CLIENT_ID}`)
  console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${c.GOOGLE_OAUTH_CLIENT_SECRET}`)
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${dati.refresh_token}`)
  console.log('\nPoi: npm run outbox')
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
