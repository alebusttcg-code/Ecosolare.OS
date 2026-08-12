/** Origine pubblica dell'app: serve ad asset statici nel documento HTML di stampa. */
export function baseUrlApplicazione(richiesta?: string): string {
  const daEnv = process.env.APP_BASE_URL?.replace(/\/$/, '')
  if (daEnv) return daEnv
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (richiesta) return new URL(richiesta).origin
  return 'http://localhost:3000'
}
