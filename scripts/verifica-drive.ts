/**
 * Controlla autenticazione Drive e la cartella GOOGLE_DRIVE_ID.
 *
 *   npm run drive:verifica
 */
import { env } from '../src/env'
import { driveConfigurato, tokenDiAccesso } from '../src/lib/drive/client'

async function main(): Promise<void> {
  const c = env()
  if (!driveConfigurato()) {
    console.log('Drive non configurato (servono GOOGLE_DRIVE_ID e SA oppure OAuth).')
    process.exit(1)
  }

  const modo = c.GOOGLE_OAUTH_REFRESH_TOKEN
    ? 'OAuth utente (ok per cartella personale)'
    : c.GOOGLE_DRIVE_DELEGATED_USER
      ? `Service account + impersonazione di ${c.GOOGLE_DRIVE_DELEGATED_USER}`
      : 'Service account diretto (ok solo su Drive condiviso)'

  console.log('Modo:', modo)
  console.log('GOOGLE_DRIVE_ID:', c.GOOGLE_DRIVE_ID)

  const token = await tokenDiAccesso()
  console.log('Auth: OK')

  const about = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)', {
    headers: { authorization: `Bearer ${token}` },
  })
  console.log('\n— Identità Google —')
  console.log(await about.text())

  const meta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(c.GOOGLE_DRIVE_ID!)}?supportsAllDrives=true&fields=id,name,mimeType,driveId,owners(emailAddress),capabilities(canAddChildren)`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  console.log('\n— Destinazione —')
  console.log('HTTP', meta.status)
  const destinazione = (await meta.json()) as {
    name?: string
    driveId?: string
    owners?: { emailAddress?: string }[]
    capabilities?: { canAddChildren?: boolean }
    error?: { message?: string }
  }
  console.log(JSON.stringify(destinazione, null, 2))

  if (destinazione.error) {
    console.log('\nESITO: destinazione non accessibile con queste credenziali.')
    process.exit(1)
  }

  if (!destinazione.capabilities?.canAddChildren) {
    console.log('\nESITO: non puoi creare file in questa cartella.')
    process.exit(1)
  }

  if (destinazione.driveId) {
    console.log('\nESITO: OK — Drive condiviso.')
    return
  }

  if (c.GOOGLE_OAUTH_REFRESH_TOKEN || c.GOOGLE_DRIVE_DELEGATED_USER) {
    console.log(
      '\nESITO: OK — cartella personale; i file useranno la quota di',
      destinazione.owners?.[0]?.emailAddress ?? 'questo utente',
    )
    return
  }

  console.log(
    '\nESITO: cartella di Il mio Drive con solo service account → i file falliranno (quota).',
  )
  console.log('Per usarla: npm run drive:autorizza  (OAuth) oppure Drive condiviso Workspace.')
  process.exit(1)
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
